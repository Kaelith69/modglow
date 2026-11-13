import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, media, reddit, redis } from '@devvit/web/server';
import { RichTextBuilder } from '@devvit/reddit';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { ANNOUNCEMENT_FLAIRS, buildAnnouncementHeaderSvg, buildAnnouncementSvg, MAX_ANNOUNCEMENT_CHARS } from '../core/render.ts';
import { buildAnnouncementRichText } from '../core/richtext.ts';
import { countGraphemes, hasMarkdownContent, MAX_ANNOUNCEMENT_BODY_CHARS } from '../core/markdown.ts';
import { renderAnnouncementPng } from '../core/rasterize.ts';
import { belongsToSubreddit, belongsToSubredditId, canModeratorCommentOnPost, hasPostModerationPermission, isModeratorPinnedComment, isNotFoundError, isPostId, isUserId } from '../core/moderation.ts';

type AnnouncementFormValues = {
  announcement?: string;
  flair?: string | string[];
  bodyBelowSvg?: boolean;
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
  const bodyBelowSvg = values?.bodyBelowSvg === true;

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
      ? buildAnnouncementRichText(uploaded.mediaUrl, announcement, context.subredditName)
      : new RichTextBuilder()
        .paragraph((paragraph) => {
          paragraph.image({ mediaUrl: uploaded.mediaUrl });
        })
        .paragraph((paragraph) => {
          const attribution = `${context.subredditName} Moderator announcement`;
          paragraph.text({ text: attribution, formatting: [[32, 0, attribution.length]] });
        });

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
    console.info(`[ModGlow] Published and pinned ${flair} ${publishedComment.id} under ${postId} in r/${context.subredditName}.`);
    return c.json<UiResponse>(toast('Published.'));
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
