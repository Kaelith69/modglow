import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, media, reddit, redis } from '@devvit/web/server';
import { RichTextBuilder } from '@devvit/reddit';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { ANNOUNCEMENT_FLAIRS, buildAnnouncementHeaderSvg, buildAnnouncementSvg, MAX_ANNOUNCEMENT_CHARS } from '../core/render.ts';
import { appendAnnouncementFooter, buildAnnouncementImageOnlyRichText, appendAnnouncementRulesLink, buildAnnouncementRichText } from '../core/richtext.ts';
import { countGraphemes, hasMarkdownContent, MAX_ANNOUNCEMENT_BODY_CHARS } from '../core/markdown.ts';
import { renderAnnouncementPng } from '../core/rasterize.ts';
import { belongsToSubreddit, belongsToSubredditId, canModeratorCommentOnPost, hasPostModerationPermission, isModeratorPinnedComment, isNotFoundError, isPostId, isUserId } from '../core/moderation.ts';
import { announcementMetadataKey, isCommentId, isManagedAnnouncementComment, isDeleteConfirmed, shouldRegenerateAnnouncementImage, type AnnouncementMetadata } from '../core/announcement.ts';

type AnnouncementFormValues = {
  announcement?: string;
  flair?: string | string[];
  bodyBelowSvg?: boolean;
  includeRulesLink?: boolean;
};

export const forms = new Hono();

const LOCK_PREFIX = 'modglow:v1:announcement-lock:';
const LOCK_TTL_SECONDS = 45;

function toast(message: string): UiResponse {
  return { showToast: message };
}

async function acquirePostLock(postId: string): Promise<string | undefined> {
  const key = `${LOCK_PREFIX}${postId}`;
  const token = `${Date.now()}:${randomUUID()}`;

  // SET NX is atomic. The 45 second lease exceeds Devvit's 30 second
  // request limit, so a live request cannot normally outlast its lock.
  await redis.set(key, token, {
    nx: true,
    expiration: new Date(Date.now() + LOCK_TTL_SECONDS * 1000),
  });

  return (await redis.get(key)) === token ? token : undefined;
}

async function releasePostLock(postId: string, token: string): Promise<void> {
  const key = `${LOCK_PREFIX}${postId}`;
  // Compare the token before release so this request never deletes another
  // request's lock. The lease duration prevents a live request reaching expiry.
  if ((await redis.get(key)) === token) await redis.del(key);
}

async function verifyModerator(subredditName: string, userId: `t2_${string}`): Promise<boolean> {
  const moderator = await reddit.getUserById(userId);
  if (!moderator) return false;
  const permissions = await moderator.getModPermissionsForSubreddit(subredditName);
  return hasPostModerationPermission(permissions);
}

forms.post('/create-announcement-submit', async (c) => {
  const values = await c.req.json<AnnouncementFormValues | null>().catch(() => null);
  const postId = context.postId ?? '';
  const announcement = values && typeof values === 'object' && typeof values.announcement === 'string'
    ? values.announcement.trim()
    : '';
  const selectedFlair = Array.isArray(values?.flair) ? values.flair[0] : values?.flair;
  const flair = ANNOUNCEMENT_FLAIRS.find((candidate) => candidate === selectedFlair);
  const bodyBelowSvg = values?.bodyBelowSvg !== false;
  const includeRulesLink = values?.includeRulesLink === true;

  if (!announcement) {
    return c.json<UiResponse>(toast('Enter announcement text.'));
  }
  if (!flair) {
    return c.json<UiResponse>(toast('Choose a flair.'));
  }
  const characterLimit = bodyBelowSvg ? MAX_ANNOUNCEMENT_BODY_CHARS : MAX_ANNOUNCEMENT_CHARS;
  const announcementLength = countGraphemes(announcement, characterLimit);
  if (announcementLength > characterLimit) {
    return c.json<UiResponse>(toast(
      bodyBelowSvg
        ? `Text limit: ${MAX_ANNOUNCEMENT_BODY_CHARS}.`
        : `Text limit: ${MAX_ANNOUNCEMENT_CHARS}.`,
    ));
  }
  if (bodyBelowSvg && !hasMarkdownContent(announcement)) {
    return c.json<UiResponse>(toast('Enter Markdown text.'));
  }
  if (!isPostId(postId) || !isUserId(context.userId) || !context.subredditName || !context.subredditId) {
    return c.json<UiResponse>(toast('Invalid post context.'));
  }

  let lockToken: string | undefined;
  let publishedComment: Awaited<ReturnType<typeof reddit.submitComment>> | undefined;
  let commentSubmissionStarted = false;
  let pinnedAndVerified = false;
  let pinMismatchConfirmed = false;
  let cleanupFailed = false;
  let cleanupCompleted = false;
  let preserveLockUntilExpiry = false;

  try {
    if (!(await verifyModerator(context.subredditName, context.userId))) {
      return c.json<UiResponse>(toast('Moderator permission required.'));
    }

    lockToken = await acquirePostLock(postId);
    if (!lockToken) {
      return c.json<UiResponse>(toast('Announcement already processing.'));
    }

    const post = await reddit.getPostById(postId);
    if (!belongsToSubreddit(post.subredditName, context.subredditName) || !belongsToSubredditId(post.subredditId, context.subredditId)) {
      return c.json<UiResponse>(toast('Wrong subreddit.'));
    }
    if (!canModeratorCommentOnPost(post)) {
      return c.json<UiResponse>(toast(
        post.removed
          ? 'Post removed.'
          : 'Post archived.',
      ));
    }

    const svg = bodyBelowSvg
      ? buildAnnouncementHeaderSvg(flair)
      : buildAnnouncementSvg(announcement, flair);
    const png = await renderAnnouncementPng(svg);
    const imageDataUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    const uploaded = await media.upload({ url: imageDataUrl, type: 'image' });

    const richtext = bodyBelowSvg
      ? buildAnnouncementRichText(uploaded.mediaUrl, announcement, context.subredditName, includeRulesLink)
: buildAnnouncementImageOnlyRichText(uploaded.mediaUrl, context.subredditName, includeRulesLink);
    commentSubmissionStarted = true;
    publishedComment = await reddit.submitComment({
      id: postId,
      richtext,
      runAs: 'APP',
    });

    try {
      await publishedComment.distinguish(true);
    } catch (error) {
      // The request may have succeeded remotely even if its response failed.
      // Read back the persisted comment before deciding whether cleanup is safe.
      console.error('[ModGlow] Pin request returned an error; checking the comment state.', error);
    }

    const verifiedComment = await reddit.getCommentById(publishedComment.id);
    if (!isModeratorPinnedComment(verifiedComment)) {
      pinMismatchConfirmed = true;
      throw new Error('Reddit confirmed that the ModGlow comment is not both pinned and moderator distinguished.');
    }

    pinnedAndVerified = true;
    const appAuthorId = publishedComment.authorId ?? (await reddit.getAppUser())?.id;
    let managementMetadataStored = false;
    if (appAuthorId && isUserId(appAuthorId)) {
      const metadata: AnnouncementMetadata = {
        version: 1,
        commentId: publishedComment.id,
        postId,
        subredditId: context.subredditId,
        subredditName: context.subredditName,
        appAuthorId,
        flair,
        announcement,
        bodyBelowSvg,
        includeRulesLink,
        mediaUrl: uploaded.mediaUrl,
      };
      try {
        await redis.set(announcementMetadataKey(publishedComment.id), JSON.stringify(metadata));
        managementMetadataStored = true;
      } catch (metadataError) {
        console.error('[ModGlow] Announcement was published, but management metadata could not be saved.', metadataError);
      }
    } else {
      console.error('[ModGlow] Published announcement but could not resolve the app author ID for management metadata.');
    }
    console.info(`[ModGlow] Published and pinned ${flair} ${publishedComment.id} under ${postId} in r/${context.subredditName}.`);
    return c.json<UiResponse>(toast(managementMetadataStored ? 'Published.' : 'Published. Editing and deletion are unavailable for this comment.'));
  } catch (error) {
    console.error('[ModGlow] Announcement publishing failed.', error);

    if (publishedComment && pinMismatchConfirmed) {
      try {
        await publishedComment.delete();
        cleanupCompleted = true;
      } catch (cleanupError) {
        if (isNotFoundError(cleanupError)) {
          cleanupCompleted = true;
        } else {
          cleanupFailed = true;
          console.error('[ModGlow] Could not remove an announcement that failed pin verification.', cleanupError);
        }
      }
    }

    if (commentSubmissionStarted && !publishedComment) {
      preserveLockUntilExpiry = true;
      return c.json<UiResponse>(toast(
        'Check post before retrying.',
      ));
    }

    if (publishedComment && !pinnedAndVerified && !pinMismatchConfirmed) {
      preserveLockUntilExpiry = true;
      return c.json<UiResponse>(toast(
        'Pin status unknown. Check post.',
      ));
    }
    if (cleanupFailed) {
      preserveLockUntilExpiry = true;
      return c.json<UiResponse>(toast(
        'Cleanup failed. Check post.',
      ));
    }
    if (cleanupCompleted) {
      return c.json<UiResponse>(toast(
        'Incomplete comment removed. Retry.',
      ));
    }

    return c.json<UiResponse>(toast('Publish failed.'));
  } finally {
    if (lockToken && !preserveLockUntilExpiry) {
      try {
        await releasePostLock(postId, lockToken);
      } catch (error) {
        console.error('[ModGlow] Could not release the announcement lock.', error);
      }
    }
  }
});


type EditAnnouncementValues = AnnouncementFormValues;
type DeleteAnnouncementValues = { confirmDelete?: boolean };

async function getVerifiedManagedComment() {
  const commentId = context.commentId;
  if (!isCommentId(commentId) || !isUserId(context.userId) || !context.subredditName || !context.subredditId) {
    return undefined;
  }
  if (!(await verifyModerator(context.subredditName, context.userId))) return undefined;
  const comment = await reddit.getCommentById(commentId);
  const appUser = await reddit.getAppUser();
  if (!appUser?.id) return undefined;
  const stored = await redis.get(announcementMetadataKey(commentId));
  if (!stored) return undefined;
  let metadata: AnnouncementMetadata;
  try {
    metadata = JSON.parse(stored) as AnnouncementMetadata;
  } catch {
    return undefined;
  }
  if (!isManagedAnnouncementComment(comment, metadata, appUser.id, context.subredditName, context.subredditId)) {
    return undefined;
  }
  return { comment, metadata };
}

function buildAnnouncementCommentBody(
  mediaUrl: string,
  announcement: string,
  bodyBelowSvg: boolean,
  includeRulesLink: boolean,
  subredditName: string,
) {
  if (bodyBelowSvg) return buildAnnouncementRichText(mediaUrl, announcement, subredditName, includeRulesLink);
  const builder = new RichTextBuilder().paragraph((paragraph) => {
    paragraph.image({ mediaUrl });
  });
  if (includeRulesLink) appendAnnouncementRulesLink(builder, subredditName);
  return appendAnnouncementFooter(builder, subredditName);
}

forms.post('/edit-announcement-submit', async (c) => {
  const values = await c.req.json<EditAnnouncementValues | null>().catch(() => null);
  const announcement = typeof values?.announcement === 'string' ? values.announcement.trim() : '';
  const selectedFlair = Array.isArray(values?.flair) ? values.flair[0] : values?.flair;
  const flair = ANNOUNCEMENT_FLAIRS.find((candidate) => candidate === selectedFlair);
  const bodyBelowSvg = values?.bodyBelowSvg !== false;
  const includeRulesLink = values?.includeRulesLink === true;

  if (!announcement) return c.json<UiResponse>(toast('Enter announcement text.'));
  if (!flair) return c.json<UiResponse>(toast('Choose a flair.'));
  const characterLimit = bodyBelowSvg ? MAX_ANNOUNCEMENT_BODY_CHARS : MAX_ANNOUNCEMENT_CHARS;
  if (countGraphemes(announcement, characterLimit) > characterLimit) {
    return c.json<UiResponse>(toast(`Text limit: ${characterLimit}.`));
  }
  if (bodyBelowSvg && !hasMarkdownContent(announcement)) {
    return c.json<UiResponse>(toast('Enter Markdown text.'));
  }

  let lockToken: string | undefined;
  let lockPostId: string | undefined;
  try {
    const managed = await getVerifiedManagedComment();
    if (!managed) return c.json<UiResponse>(toast('Moderator access or verified ModGlow ownership required.'));
    const { comment, metadata } = managed;
    lockPostId = metadata.postId;
    lockToken = await acquirePostLock(lockPostId);
    if (!lockToken) return c.json<UiResponse>(toast('This announcement is already being updated.'));

    const visualChanged = shouldRegenerateAnnouncementImage(metadata, { flair, announcement, bodyBelowSvg });
    let mediaUrl = metadata.mediaUrl;

    if (visualChanged) {
      const svg = bodyBelowSvg
        ? buildAnnouncementHeaderSvg(flair)
        : buildAnnouncementSvg(announcement, flair);
      const png = await renderAnnouncementPng(svg);
      const imageDataUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
      mediaUrl = (await media.upload({ url: imageDataUrl, type: 'image' })).mediaUrl;
    }

    const wasDistinguished = comment.distinguishedBy === 'moderator';
    const wasPinned = comment.stickied;
    const richtext = buildAnnouncementCommentBody(mediaUrl, announcement, bodyBelowSvg, includeRulesLink, context.subredditName!);
    const edited = await comment.edit({ richtext });
    let verified = await reddit.getCommentById(comment.id);

    if ((wasDistinguished || wasPinned) && (verified.distinguishedBy !== 'moderator' || verified.stickied !== wasPinned)) {
      await edited.distinguish(wasPinned);
      verified = await reddit.getCommentById(comment.id);
    }
    if (
      verified.id !== comment.id
      || verified.authorId !== metadata.appAuthorId
      || verified.subredditId !== metadata.subredditId
      || verified.postId !== metadata.postId
      || verified.body !== edited.body
      || verified.distinguishedBy === 'moderator' !== wasDistinguished
      || verified.stickied !== wasPinned
    ) {
      throw new Error('Reddit did not confirm the edited announcement state.');
    }

    const updated: AnnouncementMetadata = {
      ...metadata,
      flair,
      announcement,
      bodyBelowSvg,
      includeRulesLink,
      mediaUrl,
    };
    await redis.set(announcementMetadataKey(comment.id), JSON.stringify(updated));
    console.info(`[ModGlow] Edited and verified announcement ${comment.id} in r/${context.subredditName}.`);
    return c.json<UiResponse>(toast('Announcement updated.'));
  } catch (error) {
    console.error('[ModGlow] Announcement edit failed.', error);
    return c.json<UiResponse>(toast('Could not update this announcement. Check the comment before retrying.'));
  } finally {
    if (lockToken && lockPostId) {
      try {
        await releasePostLock(lockPostId, lockToken);
      } catch (error) {
        console.error('[ModGlow] Could not release the announcement edit lock.', error);
      }
    }
  }
});

forms.post('/delete-announcement-submit', async (c) => {
  const values = await c.req.json<DeleteAnnouncementValues | null>().catch(() => null);
  if (!isDeleteConfirmed(values)) {
    return c.json<UiResponse>(toast('Confirm permanent deletion to continue.'));
  }

  try {
    const managed = await getVerifiedManagedComment();
    if (!managed) return c.json<UiResponse>(toast('Moderator access or verified ModGlow ownership required.'));
    const { comment, metadata } = managed;
    const lockToken = await acquirePostLock(metadata.postId);
    if (!lockToken) return c.json<UiResponse>(toast('This announcement is already being changed.'));

    try {
      await comment.delete();
      await redis.del(announcementMetadataKey(comment.id));
      console.info(`[ModGlow] Permanently deleted app-owned announcement ${comment.id} from r/${context.subredditName}.`);
      return c.json<UiResponse>(toast('Announcement permanently deleted.'));
    } finally {
      await releasePostLock(metadata.postId, lockToken);
    }
  } catch (error) {
    console.error('[ModGlow] Announcement deletion failed.', error);
    return c.json<UiResponse>(toast('Could not permanently delete this announcement.'));
  }
});
