import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, media, reddit, redis } from '@devvit/web/server';
import { RichTextBuilder } from '@devvit/reddit';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { buildCommentSvg } from '../core/render.ts';
import { renderCommentPng } from '../core/rasterize.ts';
import { belongsToSubreddit, belongsToSubredditId, hasCommentContentAvailable, hasCommentModerationPermission, isCommentId, isNotFoundError, isPostId, isUserId } from '../core/moderation.ts';

type FeatureFormValues = {
  permissionConfirmed?: boolean;
};

export const forms = new Hono();

// v5 bypasses stale v4 locks left by requests terminated before cleanup.
const LOCK_PREFIX = 'modglow:v5:lock:';
const LOCK_TTL_SECONDS = 45;
const CONVERSION_HASH = 'modglow:v2:features';
const POST_SOURCE_HASH = 'modglow:v1:feature-post-sources';
const COMMENT_REPLY_HASH = 'modglow:v1:comment-replies';
const DELETED_COMMENT_PREFIX = 'modglow:v1:deleted:';
const DELETED_COMMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toast(message: string): UiResponse {
  return { showToast: message };
}

async function acquireCommentLock(commentId: string): Promise<string | undefined> {
  const key = `${LOCK_PREFIX}${commentId}`;
  const token = `${Date.now()}:${randomUUID()}`;

  // SET NX with an expiry is atomic. The subsequent readback verifies the unique token.
  await redis.set(key, token, {
    nx: true,
    expiration: new Date(Date.now() + LOCK_TTL_SECONDS * 1000),
  });

  // SET NX return values are not a reliable ownership signal in Devvit Redis.
  return (await redis.get(key)) === token ? token : undefined;
}

async function releaseCommentLock(commentId: string, token: string): Promise<void> {
  const key = `${LOCK_PREFIX}${commentId}`;
  // Devvit requests have a 30 second execution limit; the 45 second lease
  // cannot expire during a live request. Compare before deleting so a stale
  // request never removes a later request's lock.
  if ((await redis.get(key)) === token) {
    await redis.del(key);
  }
}


async function verifyModerator(subredditName: string, userId: `t2_${string}`): Promise<boolean> {
  const moderator = await reddit.getUserById(userId);
  if (!moderator) return false;
  const permissions = await moderator.getModPermissionsForSubreddit(subredditName);
  return hasCommentModerationPermission(permissions);
}

async function isDeletionRecorded(commentId: string): Promise<boolean> {
  return (await redis.get(`${DELETED_COMMENT_PREFIX}${commentId}`)) === '1';
}

forms.post('/feature-comment-submit', async (c) => {
  const values = await c.req.json<FeatureFormValues>().catch(() => ({} as FeatureFormValues));
  const commentId = context.commentId ?? '';

  if (values?.permissionConfirmed !== true) {
    return c.json<UiResponse>(toast('You must confirm that the comment author has explicitly permitted this feature.'));
  }

  if (!isCommentId(commentId) || !isUserId(context.userId) || !context.subredditName || !context.subredditId) {
    return c.json<UiResponse>(toast('The selected comment or moderator context is invalid. Reopen the comment menu and try again.'));
  }

  let lockToken: string | undefined;
  let replacementComment: Awaited<ReturnType<typeof reddit.submitComment>> | undefined;
  let featureRecordSaved = false;
  let transactionComplete = false;

  try {
    if (!(await verifyModerator(context.subredditName, context.userId))) {
      return c.json<UiResponse>(toast('This action requires post moderation permission in this subreddit.'));
    }

    lockToken = await acquireCommentLock(commentId);
    if (!lockToken) return c.json<UiResponse>(toast('A ModGlow action for this comment is already running. Wait briefly and retry.'));
    if (await isDeletionRecorded(commentId)) {
      return c.json<UiResponse>(toast('This comment was recently deleted or removed and cannot be featured.'));
    }

    const comment = await reddit.getCommentById(commentId);
    if (!belongsToSubreddit(comment.subredditName, context.subredditName) || !belongsToSubredditId(comment.subredditId, context.subredditId)) {
      return c.json<UiResponse>(toast('The selected comment does not belong to this subreddit.'));
    }
    if (!hasCommentContentAvailable(comment.body, comment.authorName, comment.removed)) {
      return c.json<UiResponse>(toast('This comment is removed, deleted, or has no available text.'));
    }
    if (comment.body.length > 2600) {
      return c.json<UiResponse>(toast('This comment is too long to feature safely. The limit is 2,600 characters.'));
    }

    if (await isDeletionRecorded(commentId)) {
      return c.json<UiResponse>(toast('This comment was recently deleted or removed and cannot be featured.'));
    }

    const existingReplyId = await redis.hGet(COMMENT_REPLY_HASH, comment.id);
    if (existingReplyId && !isCommentId(existingReplyId)) {
      await redis.hDel(COMMENT_REPLY_HASH, [comment.id]);
    }

    if (!isPostId(comment.postId)) {
      return c.json<UiResponse>(toast('The original comment does not have a valid parent submission.'));
    }

    const svg = buildCommentSvg({
      body: comment.body,
      createdAt: comment.createdAt,
    });

    const png = await renderCommentPng(svg);
    if (await isDeletionRecorded(commentId)) throw new Error('The source comment was removed while rendering.');
    const imageDataUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    const uploaded = await media.upload({ url: imageDataUrl, type: 'image' });

    if (existingReplyId && isCommentId(existingReplyId)) {
      replacementComment = await reddit.getCommentById(existingReplyId);
      if (replacementComment.postId !== comment.postId) {
        throw new Error('The stored replacement comment does not belong to the original submission.');
      }
    } else {
      const richtext = new RichTextBuilder().paragraph((paragraph) => {
        paragraph.image({ mediaUrl: uploaded.mediaUrl });
      });

      replacementComment = await reddit.submitComment({
        id: comment.postId,
        richtext,
        runAs: 'APP',
      });

      if (replacementComment.postId !== comment.postId) {
        throw new Error('Reddit returned a replacement comment under an unexpected submission.');
      }

      // Persist immediately after publication so retries reuse this exact reply.
      await redis.hSet(COMMENT_REPLY_HASH, { [comment.id]: replacementComment.id });
    }

    if (replacementComment.distinguishedBy !== 'moderator') {
      await replacementComment.distinguish(false);
    }

    const verifiedReply = await reddit.getCommentById(replacementComment.id);
    if (verifiedReply.postId !== comment.postId || verifiedReply.distinguishedBy !== 'moderator') {
      throw new Error('Reddit did not confirm the replacement comment under the original submission with moderator distinction.');
    }

    const latestOriginal = await reddit.getCommentById(comment.id);
    if (!hasCommentContentAvailable(latestOriginal.body, latestOriginal.authorName, latestOriginal.removed)) {
      throw new Error('The original comment was already removed or deleted before replacement completion.');
    }

    await latestOriginal.remove(true);
    const verifiedOriginal = await reddit.getCommentById(comment.id);
    if (!verifiedOriginal.removed || !verifiedOriginal.spam) {
      throw new Error('Reddit did not confirm spam removal of the original comment.');
    }

    transactionComplete = true;
    try {
      await redis.set(`${DELETED_COMMENT_PREFIX}${commentId}`, '1', {
        expiration: new Date(Date.now() + DELETED_COMMENT_TTL_MS),
      });
    } catch (tombstoneError) {
      console.error('[ModGlow] Could not persist the spam removal tombstone; the CommentDelete trigger remains the cleanup path.', tombstoneError);
    }
    console.info(`[ModGlow] Replaced ${comment.id} with distinguished comment ${replacementComment.id} under ${comment.postId}; source marked as spam.`);
    return c.json<UiResponse>(toast('Replacement comment published and distinguished. Original comment removed as spam.'));

  } catch (error) {
    console.error('[ModGlow] Feature action failed.', error);

    // A successfully published replacement is retained and indexed. A retry
    // reuses it rather than creating a duplicate. The source is never removed
    // unless publication and moderator distinction have both been verified.
    if (replacementComment && !transactionComplete) {
      console.error(`[ModGlow] Replacement comment ${replacementComment.id} remains indexed for safe retry.`);
    }

    return c.json<UiResponse>(toast('Could not complete the replacement. The original comment was not intentionally removed. Retry to resume safely without publishing a duplicate.'));
  } finally {
    if (lockToken) {
      try {
        await releaseCommentLock(commentId, lockToken);
      } catch (error) {
        console.error('[ModGlow] Could not release the feature lock.', error);
      }
    }
  }
});


type RemoveCommentFormValues = {
  confirmRemoval?: boolean;
};

forms.post('/remove-comment-submit', async (c) => {
  const values = await c.req.json<RemoveCommentFormValues>().catch(() => ({} as RemoveCommentFormValues));
  const commentId = context.commentId ?? '';

  if (values?.confirmRemoval !== true) {
    return c.json<UiResponse>(toast('Confirm the removal before continuing.'));
  }
  if (!isCommentId(commentId) || !isUserId(context.userId) || !context.subredditName || !context.subredditId) {
    return c.json<UiResponse>(toast('The selected comment or moderator context is invalid. Reopen the comment menu and try again.'));
  }

  let lockToken: string | undefined;
  try {
    if (!(await verifyModerator(context.subredditName, context.userId))) {
      return c.json<UiResponse>(toast('This action requires post moderation permission in this subreddit.'));
    }

    lockToken = await acquireCommentLock(commentId);
    if (!lockToken) return c.json<UiResponse>(toast('A ModGlow action for this comment is already running. Wait briefly and retry.'));
    if (await isDeletionRecorded(commentId)) {
      return c.json<UiResponse>(toast('This comment was already deleted or removed.'));
    }

    const comment = await reddit.getCommentById(commentId);
    if (!belongsToSubreddit(comment.subredditName, context.subredditName) || !belongsToSubredditId(comment.subredditId, context.subredditId)) {
      return c.json<UiResponse>(toast('The selected comment does not belong to this subreddit.'));
    }
    if (!hasCommentContentAvailable(comment.body, comment.authorName, comment.removed)) {
      return c.json<UiResponse>(toast('This comment is already removed, deleted, or unavailable.'));
    }

    // Moderators remove another user's comment; they cannot hard delete it.
    // The CommentDelete trigger removes any associated copied spotlight post.
    await comment.remove(false);
    if (!comment.removed) throw new Error('Reddit did not confirm the comment removal.');
    try {
      await redis.set(`${DELETED_COMMENT_PREFIX}${commentId}`, '1', {
        expiration: new Date(Date.now() + DELETED_COMMENT_TTL_MS),
      });
    } catch (tombstoneError) {
      console.error('[ModGlow] Could not persist the removal tombstone; the CommentDelete trigger remains the cleanup path.', tombstoneError);
    }

    console.info(`[ModGlow] Moderator ${context.userId} removed ${commentId} from r/${context.subredditName}.`);
    return c.json<UiResponse>(toast('Comment removed. Any linked ModGlow spotlight will also be removed under Reddit’s content deletion rules.'));
  } catch (error) {
    console.error('[ModGlow] Comment removal failed.', error);
    return c.json<UiResponse>(toast('Could not verify the comment removal. Check moderator permissions and the comment state, then try again.'));
  } finally {
    if (lockToken) {
      try {
        await releaseCommentLock(commentId, lockToken);
      } catch (error) {
        console.error('[ModGlow] Could not release the removal lock.', error);
      }
    }
  }
});
