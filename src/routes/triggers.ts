import { Hono } from 'hono';
import type { OnCommentDeleteRequest, TriggerResponse } from '@devvit/web/shared';
import { reddit, redis } from '@devvit/web/server';

export const triggers = new Hono();

const CONVERSION_HASH = 'modglow:v2:features';

triggers.post('/comment-delete', async (c) => {
  const event = await c.req.json<OnCommentDeleteRequest>();
  const commentId = event.commentId;

  if (!commentId || !/^t1_[a-z0-9]+$/i.test(commentId)) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  try {
    const replacementPostId = await redis.hGet(CONVERSION_HASH, commentId);
    if (!replacementPostId) return c.json<TriggerResponse>({ status: 'ok' });

    // Keep the mapping until the embedded copy is confirmed removed. If Reddit
    // is temporarily unavailable, a retried trigger can safely finish cleanup.
    const replacement = await reddit.getPostById(replacementPostId);
    if (!replacement.removed) {
      await replacement.delete();
    }

    await redis.hDel(CONVERSION_HASH, [commentId]);
    console.info(`[ModGlow] Removed copied feature content after source comment deletion: ${commentId}.`);
  } catch (error) {
    console.error(`[ModGlow] Could not process deletion for ${commentId}.`, error);
    return c.json<TriggerResponse>({ status: 'error' }, 500);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
