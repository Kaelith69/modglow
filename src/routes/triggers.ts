import { Hono } from 'hono';
import type { OnCommentDeleteRequest, TriggerResponse } from '@devvit/web/shared';
import { reddit, redis } from '@devvit/web/server';
import { isCommentId, isNotFoundError, isPostId } from '../core/moderation.ts';

export const triggers = new Hono();

const CONVERSION_HASH = 'modglow:v2:features';
const DELETED_COMMENT_PREFIX = 'modglow:v1:deleted:';
const DELETED_COMMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

triggers.post('/comment-delete', async (c) => {
  const event = await c.req.json<OnCommentDeleteRequest>();
  const commentId = event.commentId;

  if (!isCommentId(commentId)) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  try {
    // Preserve deletion state even when the feature mapping has not been saved yet.
    await redis.set(`${DELETED_COMMENT_PREFIX}${commentId}`, '1', {
      expiration: new Date(Date.now() + DELETED_COMMENT_TTL_MS),
    });

    const replacementPostId = await redis.hGet(CONVERSION_HASH, commentId);
    if (!replacementPostId) return c.json<TriggerResponse>({ status: 'ok' });

    // Never pass untrusted or malformed Redis values to the typed Reddit API.
    if (!isPostId(replacementPostId)) {
      console.error(`[ModGlow] Invalid spotlight post mapping for deleted comment ${commentId}.`);
      await redis.hDel(CONVERSION_HASH, [commentId]);
      return c.json<TriggerResponse>({ status: 'ok' });
    }

    // Removed posts still contain copied content. Delete regardless of moderation state.
    try {
      const replacement = await reddit.getPostById(replacementPostId);
      await replacement.delete();
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      // An already deleted post is a completed cleanup, not a retry condition.
    }

    await redis.hDel(CONVERSION_HASH, [commentId]);
    console.info(`[ModGlow] Removed copied feature content after source comment deletion: ${commentId}.`);
  } catch (error) {
    console.error(`[ModGlow] Could not process deletion for ${commentId}.`, error);
    return c.json<TriggerResponse>({ status: 'error' }, 500);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
