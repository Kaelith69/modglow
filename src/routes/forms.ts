import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, media, reddit, redis } from '@devvit/web/server';
import { RichTextBuilder } from '@devvit/reddit';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { buildCommentSvg } from '../core/render.ts';
import { renderCommentPng } from '../core/rasterize.ts';
import { belongsToSubreddit, belongsToSubredditId, hasCommentContentAvailable, hasCommentModerationPermission, isCommentId } from '../core/moderation.ts';

type FeatureFormValues = {
  permissionConfirmed?: boolean;
};

export const forms = new Hono();

// v4 bypasses stale v3 locks left by requests terminated before cleanup.
const LOCK_PREFIX = 'modglow:v5:lock:';
const LOCK_TTL_SECONDS = 45;
const CONVERSION_HASH = 'modglow:v2:features';
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
  const transaction = await redis.watch(key);
  // Read through the root client. TxClientLike.get() queues a command and
  // returns the transaction handle, not the stored string value.
  const current = await transaction.get(key);
  if (current !== token) {
    await transaction.unwatch();
    return;
  }

  await transaction.multi();
  await transaction.del(key);
  await transaction.exec();
}


async function verifyModerator(subredditName: string, userId: string): Promise<boolean> {
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

  if (!isCommentId(commentId) || !context.userId || !context.subredditName || !context.subredditId) {
    return c.json<UiResponse>(toast('The selected comment or moderator context is invalid. Reopen the comment menu and try again.'));
  }

  let lockToken: string | undefined;
  let replacementPost: Awaited<ReturnType<typeof reddit.submitPost>> | undefined;
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
    if (!comment.authorName || comment.authorName === '[deleted]') {
      return c.json<UiResponse>(toast('The original author is unavailable, so this comment cannot be attributed.'));
    }
    if (comment.body.length > 2600) {
      return c.json<UiResponse>(toast('This comment is too long to feature safely. The limit is 2,600 characters.'));
    }

    if (await isDeletionRecorded(commentId)) {
      return c.json<UiResponse>(toast('This comment was recently deleted or removed and cannot be featured.'));
    }

    const existingPostId = await redis.hGet(CONVERSION_HASH, comment.id);
    if (existingPostId) {
      return c.json<UiResponse>(toast('This comment already has a ModGlow highlight.'));
    }

    // Community highlights and subreddit sticky slots are different Reddit features.
    // sticky() below is authoritative; a failure triggers rollback without changing the source.

    const svg = buildCommentSvg({
      subredditName: comment.subredditName,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
      edited: comment.edited,
    });

    const png = await renderCommentPng(svg);
    if (await isDeletionRecorded(commentId)) throw new Error('The source comment was deleted while rendering.');
    const imageDataUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    const uploaded = await media.upload({ url: imageDataUrl, type: 'image' });

    const richtext = new RichTextBuilder()
      .paragraph((paragraph) => {
        paragraph.image({
          mediaUrl: uploaded.mediaUrl,
          caption: `Moderator selected community spotlight from r/${comment.subredditName}. Original author: u/${comment.authorName}.`,
        });
      })
      .paragraph((paragraph) => {
        paragraph.text({ text: `Original discussion: https://www.reddit.com${comment.permalink}` });
      })
      ;

    replacementPost = await reddit.submitPost({
      subredditName: comment.subredditName,
      title: `Community spotlight: u/${comment.authorName}`,
      richtext,
      runAs: 'APP',
    });

    await replacementPost.distinguish();
    await replacementPost.sticky();

    const verifiedPost = await reddit.getPostById(replacementPost.id);
    if (!verifiedPost.stickied || verifiedPost.distinguishedBy !== 'moderator') {
      throw new Error('Reddit did not confirm that the highlight is both pinned and moderator distinguished.');
    }

    await redis.hSet(CONVERSION_HASH, { [comment.id]: replacementPost.id });
    featureRecordSaved = true;

    // Close the race where the source is deleted while rendering or publishing.
    const latestOriginal = await reddit.getCommentById(comment.id);
    if (await isDeletionRecorded(commentId) || !hasCommentContentAvailable(latestOriginal.body, latestOriginal.authorName, latestOriginal.removed)) {
      throw new Error('The source comment was deleted or removed during publishing.');
    }
    transactionComplete = true;

    console.info(`[ModGlow] Featured ${comment.id} as ${replacementPost.id} in r/${comment.subredditName}.`);
    return c.json<UiResponse>(toast('Highlight published, moderator distinguished, and pinned. The original comment remains unchanged.'));
  } catch (error) {
    console.error('[ModGlow] Feature action failed.', error);

    if (replacementPost && !transactionComplete) {
      try {
        await replacementPost.delete();
        if (featureRecordSaved) await redis.hDel(CONVERSION_HASH, [commentId]);
      } catch (cleanupError) {
        console.error('[ModGlow] Failed to remove an incomplete highlight post.', cleanupError);
        if (!featureRecordSaved) {
          try {
            await redis.hSet(CONVERSION_HASH, { [commentId]: replacementPost.id });
            featureRecordSaved = true;
            console.error('[ModGlow] Preserved an orphan mapping to prevent duplicate publication.');
          } catch (mappingError) {
            console.error('[ModGlow] Could not record the incomplete highlight post.', mappingError);
          }
        }
      }
    }

    return c.json<UiResponse>(toast('Could not complete the highlight. The original comment was not changed. Check the comment, author permission, and available sticky slots, then try again.'));
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
  if (!isCommentId(commentId) || !context.userId || !context.subredditName || !context.subredditId) {
    return c.json<UiResponse>(toast('The selected comment or moderator context is invalid. Reopen the comment menu and try again.'));
  }

  let lockToken: string | undefined;
  try {
    if (!(await verifyModerator(context.subredditName, context.userId))) {
      return c.json<UiResponse>(toast('This action requires post moderation permission in this subreddit.'));
    }

    lockToken = await acquireCommentLock(commentId);
    if (!lockToken) return c.json<UiResponse>(toast('A ModGlow action for this comment is already running. Wait briefly and retry.'));

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
