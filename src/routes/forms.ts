import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, media, reddit, redis } from '@devvit/web/server';
import { RichTextBuilder } from '@devvit/reddit';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { ANNOUNCEMENT_FLAIRS, buildAnnouncementSvg, MAX_ANNOUNCEMENT_CHARS, type AnnouncementFlair } from '../core/render.ts';
import { renderAnnouncementPng } from '../core/rasterize.ts';
import { belongsToSubreddit, belongsToSubredditId, hasPostModerationPermission, isNotFoundError, isPostId, isUserId } from '../core/moderation.ts';

type AnnouncementFormValues = {
  announcement?: string;
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

  if (!announcement) {
    return c.json<UiResponse>(toast('Write an announcement before publishing.'));
  }
  if (announcement.length > MAX_ANNOUNCEMENT_CHARS) {
    return c.json<UiResponse>(toast(`The announcement is too long. The limit is ${MAX_ANNOUNCEMENT_CHARS} characters.`));
  }
  if (!isPostId(postId) || !isUserId(context.userId) || !context.subredditName || !context.subredditId) {
    return c.json<UiResponse>(toast('The post or moderator context is invalid. Reopen ModGlow from the post menu and try again.'));
  }

  let lockToken: string | undefined;
  let publishedComment: Awaited<ReturnType<typeof reddit.submitComment>> | undefined;
  let pinnedAndVerified = false;

  try {
    if (!(await verifyModerator(context.subredditName, context.userId))) {
      return c.json<UiResponse>(toast('This action requires post moderation permission in this subreddit.'));
    }

    lockToken = await acquirePostLock(postId);
    if (!lockToken) {
      return c.json<UiResponse>(toast('A ModGlow announcement is already being generated for this post. Wait briefly and retry.'));
    }

    const post = await reddit.getPostById(postId);
    if (!belongsToSubreddit(post.subredditName, context.subredditName) || !belongsToSubredditId(post.subredditId, context.subredditId)) {
      return c.json<UiResponse>(toast('The selected post does not belong to this subreddit.'));
    }
    if (post.removed) {
      return c.json<UiResponse>(toast('This post has been removed and cannot receive a ModGlow announcement.'));
    }

    const svg = buildAnnouncementSvg(announcement, flair);
    const png = await renderAnnouncementPng(svg);
    const imageDataUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    const uploaded = await media.upload({ url: imageDataUrl, type: 'image' });

    const richtext = new RichTextBuilder().paragraph((paragraph) => {
      paragraph.image({
        mediaUrl: uploaded.mediaUrl,
        caption: 'ModGlow moderator announcement',
      });
    });

    publishedComment = await reddit.submitComment({
      id: postId,
      richtext,
      runAs: 'APP',
    });

    await publishedComment.distinguish(true);

    const verifiedComment = await reddit.getCommentById(publishedComment.id);
    if (!verifiedComment.stickied || verifiedComment.distinguishedBy !== 'moderator') {
      throw new Error('Reddit did not confirm that the ModGlow comment is both pinned and moderator distinguished.');
    }

    pinnedAndVerified = true;
    console.info(`[ModGlow] Published and pinned ${flair} ${publishedComment.id} under ${postId} in r/${context.subredditName}.`);
    return c.json<UiResponse>(toast('ModGlow ${flair} published by the app and pinned as a moderator comment.'));
  } catch (error) {
    console.error('[ModGlow] Announcement publishing failed.', error);

    if (publishedComment && !pinnedAndVerified) {
      try {
        await publishedComment.delete();
      } catch (cleanupError) {
        if (!isNotFoundError(cleanupError)) {
          console.error('[ModGlow] Could not remove an announcement that failed pin verification.', cleanupError);
        }
      }
    }

    return c.json<UiResponse>(toast('Could not publish and pin the ModGlow announcement. Check the post, moderator permissions, and Reddit comment availability, then try again.'));
  } finally {
    if (lockToken) {
      try {
        await releasePostLock(postId, lockToken);
      } catch (error) {
        console.error('[ModGlow] Could not release the announcement lock.', error);
      }
    }
  }
});
