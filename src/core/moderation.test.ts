import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToSubreddit, hasCommentModerationPermission, isCommentId, isPostId } from './moderation.ts';

test('comment moderation requires all or posts permission', () => {
  assert.equal(hasCommentModerationPermission(['posts']), true);
  assert.equal(hasCommentModerationPermission(['all']), true);
  assert.equal(hasCommentModerationPermission(['wiki', 'flair']), false);
  assert.equal(hasCommentModerationPermission([]), false);
});

test('comment identifiers must be valid fullnames', () => {
  assert.equal(isCommentId('t1_abc123'), true);
  assert.equal(isCommentId('t3_abc123'), false);
  assert.equal(isCommentId('abc123'), false);
  assert.equal(isCommentId('t1_'), false);
  assert.equal(isCommentId(null), false);
});

test('subreddit comparison is case insensitive and whitespace safe', () => {
  assert.equal(belongsToSubreddit('Coconaad', ' coconaad '), true);
  assert.equal(belongsToSubreddit('Coconaad', 'OtherSub'), false);
});

test('post identifiers must be valid post fullnames', () => {
  assert.equal(isPostId('t3_abc123'), true);
  assert.equal(isPostId('t1_abc123'), false);
  assert.equal(isPostId('abc123'), false);
  assert.equal(isPostId('t3_'), false);
  assert.equal(isPostId(null), false);
});
