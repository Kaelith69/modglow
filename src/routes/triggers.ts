import { Hono } from 'hono';
import type { OnCommentDeleteRequest, OnPostDeleteRequest, TriggerResponse } from '@devvit/web/shared';
import { reddit, redis } from '@devvit/web/server';
import { buildPostSourceIndex, isCommentId, isNotFoundError, isPostId } from '../core/moderation.ts';

export const triggers = new Hono();

const CONVERSION_HASH = 'modglow:v2:features';
const POST_SOURCE_HASH = 'modglow:v1:feature-post-sources';
const POST_SOURCE_MIGRATION_KEY = 'modglow:v1:feature-post-sources:migrated';
const DELETED_COMMENT_PREFIX = 'modglow:v1:deleted:';
const DELETED_COMMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

triggers.post('/comment-delete', async (c) => {
  const event = await c.req.json<OnCommentDeleteRequest>().catch(() => undefined);
  const commentId = event?.commentId;

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
      const reverseMappings = await redis.hGetAll(POST_SOURCE_HASH);
      const stalePostIds = Object.entries(reverseMappings)
        .filter(([postId, sourceCommentId]) => isPostId(postId) && sourceCommentId === commentId)
        .map(([postId]) => postId);
      if (stalePostIds.length > 0) await redis.hDel(POST_SOURCE_HASH, stalePostIds);
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
    await redis.hDel(POST_SOURCE_HASH, [replacementPostId]);
    console.info(`[ModGlow] Removed copied feature content after source comment deletion: ${commentId}.`);
  } catch (error) {
    console.error(`[ModGlow] Could not process deletion for ${commentId}.`, error);
    return c.json<TriggerResponse>({ status: 'error' }, 500);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});

triggers.post('/post-delete', async (c) => {
  const event = await c.req.json<OnPostDeleteRequest>().catch(() => undefined);
  const postId = event?.postId;

  if (!isPostId(postId)) {
    return c.json<TriggerResponse>({ status: 'ok' });
  }

  try {
    // Migrate existing comment to post mappings once. Later deletions use one
    // reverse hash lookup instead of scanning the full mapping for every post.
    if ((await redis.get(POST_SOURCE_MIGRATION_KEY)) !== '1') {
      const reverseMappings = buildPostSourceIndex(await redis.hGetAll(CONVERSION_HASH));
      if (Object.keys(reverseMappings).length > 0) {
        await redis.hSet(POST_SOURCE_HASH, reverseMappings);
      }
      await redis.set(POST_SOURCE_MIGRATION_KEY, '1');
    }

    const commentId = await redis.hGet(POST_SOURCE_HASH, postId);
    if (!isCommentId(commentId)) {
      if (commentId) await redis.hDel(POST_SOURCE_HASH, [postId]);
      return c.json<TriggerResponse>({ status: 'ok' });
    }

    const mappedPostId = await redis.hGet(CONVERSION_HASH, commentId);
    if (mappedPostId === postId) {
      await redis.hDel(CONVERSION_HASH, [commentId]);
    }
    await redis.hDel(POST_SOURCE_HASH, [postId]);
    console.info(`[ModGlow] Cleared the source mapping after spotlight post deletion: ${postId}.`);
  } catch (error) {
    console.error(`[ModGlow] Could not reconcile spotlight deletion for ${postId}.`, error);
    return c.json<TriggerResponse>({ status: 'error' }, 500);
  }

  return c.json<TriggerResponse>({ status: 'ok' });
});
