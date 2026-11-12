import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToSubreddit, belongsToSubredditId, hasCommentContentAvailable, hasCommentModerationPermission, isCommentId, isNotFoundError, isPostId, isUserId } from './moderation.ts';

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

test('user identifiers must be valid Reddit user fullnames', () => {
  assert.equal(isUserId('t2_abc123'), true);
  assert.equal(isUserId('t1_abc123'), false);
  assert.equal(isUserId('abc123'), false);
  assert.equal(isUserId(null), false);
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

test('subreddit IDs must match exactly', () => {
  assert.equal(belongsToSubredditId('t5_abc123', 't5_abc123'), true);
  assert.equal(belongsToSubredditId('t5_abc123', 't5_other'), false);
});

test('comment availability rejects removed and author-deleted content', () => {
  assert.equal(hasCommentContentAvailable('A valid comment', 'author', false), true);
  assert.equal(hasCommentContentAvailable('   ', 'author', false), false);
  assert.equal(hasCommentContentAvailable('[deleted]', '[deleted]', false), false);
  assert.equal(hasCommentContentAvailable('[removed]', 'author', false), false);
  assert.equal(hasCommentContentAvailable('valid', '[deleted]', false), false);
  assert.equal(hasCommentContentAvailable('valid', 'author', true), false);
});

test('not found errors are distinguished from transient failures', () => {
  assert.equal(isNotFoundError({ status: 404 }), true);
  assert.equal(isNotFoundError({ response: { status: 404 } }), true);
  assert.equal(isNotFoundError({ code: 'NOT_FOUND' }), true);
  assert.equal(isNotFoundError(new Error('Post not found')), true);
  assert.equal(isNotFoundError({ status: 503, message: 'Service unavailable' }), false);
  assert.equal(isNotFoundError(new Error('Network timeout')), false);
});
