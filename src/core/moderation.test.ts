import test from 'node:test';
import assert from 'node:assert/strict';
import {
  belongsToSubreddit,
  belongsToSubredditId,
  canModeratorCommentOnPost,
  hasPostModerationPermission,
  isNotFoundError,
  isModeratorPinnedComment,
  isPostId,
  isUserId,
} from './moderation.ts';

test('post moderation requires all or posts permission', () => {
  assert.equal(hasPostModerationPermission(['posts']), true);
  assert.equal(hasPostModerationPermission(['all']), true);
  assert.equal(hasPostModerationPermission(['wiki', 'flair']), false);
  assert.equal(hasPostModerationPermission([]), false);
});

test('post identifiers must be valid Reddit fullnames', () => {
  assert.equal(isPostId('t3_abc123'), true);
  assert.equal(isPostId('t1_abc123'), false);
  assert.equal(isPostId('abc123'), false);
  assert.equal(isPostId('t3_'), false);
  assert.equal(isPostId(null), false);
});

test('user identifiers must be valid Reddit fullnames', () => {
  assert.equal(isUserId('t2_abc123'), true);
  assert.equal(isUserId('t1_abc123'), false);
  assert.equal(isUserId('abc123'), false);
  assert.equal(isUserId('t2_'), false);
  assert.equal(isUserId(null), false);
});

test('subreddit names compare case insensitively and ignore surrounding whitespace', () => {
  assert.equal(belongsToSubreddit('Coconaad', ' coconaad '), true);
  assert.equal(belongsToSubreddit('Coconaad', 'OtherSub'), false);
});

test('subreddit IDs must match exactly', () => {
  assert.equal(belongsToSubredditId('t5_abc123', 't5_abc123'), true);
  assert.equal(belongsToSubredditId('t5_abc123', 't5_other'), false);
});

test('not found errors are distinguished from transient failures', () => {
  assert.equal(isNotFoundError({ status: 404 }), true);
  assert.equal(isNotFoundError({ response: { status: 404 } }), true);
  assert.equal(isNotFoundError({ code: 'NOT_FOUND' }), true);
  assert.equal(isNotFoundError(new Error('Post not found')), true);
  assert.equal(isNotFoundError({ status: 503, message: 'Service unavailable' }), false);
  assert.equal(isNotFoundError(new Error('Network timeout')), false);
});


test('comment pin verification requires both persisted moderator distinction and sticky state', () => {
  assert.equal(isModeratorPinnedComment({ stickied: true, distinguishedBy: 'moderator' }), true);
  assert.equal(isModeratorPinnedComment({ stickied: false, distinguishedBy: 'moderator' }), false);
  assert.equal(isModeratorPinnedComment({ stickied: true, distinguishedBy: null }), false);
  assert.equal(isModeratorPinnedComment({ stickied: true, distinguishedBy: 'admin' }), false);
});


test('archived and removed posts reject moderator comments but locked posts remain commentable', () => {
  assert.equal(canModeratorCommentOnPost({ removed: false, archived: false }), true);
  assert.equal(canModeratorCommentOnPost({ removed: false, archived: true }), false);
  assert.equal(canModeratorCommentOnPost({ removed: true, archived: false }), false);
  assert.equal(canModeratorCommentOnPost({ removed: false, archived: false, locked: true }), true);
});
