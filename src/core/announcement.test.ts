import test from 'node:test';
import assert from 'node:assert/strict';
import {
  announcementMetadataKey,
  isCommentId,
  isManagedAnnouncementComment,
  type AnnouncementMetadata,
} from './announcement.ts';

const metadata: AnnouncementMetadata = {
  version: 1,
  commentId: 't1_comment',
  postId: 't3_post',
  subredditId: 't5_sub',
  subredditName: 'ExampleSub',
  appAuthorId: 't2_app',
  flair: 'NOTICE',
  announcement: 'Original announcement',
  bodyBelowSvg: true,
  mediaUrl: 'https://reddit.test/header.png',
};

const comment = {
  id: 't1_comment',
  authorId: 't2_app',
  subredditId: 't5_sub',
  subredditName: 'examplesub',
  postId: 't3_post',
  parentId: 't3_post',
};

test('announcement metadata keys are namespaced by exact comment ID', () => {
  assert.equal(announcementMetadataKey('t1_comment'), 'modglow:v1:announcement:t1_comment');
});

test('comment IDs require Reddit comment fullnames', () => {
  assert.equal(isCommentId('t1_abc123'), true);
  assert.equal(isCommentId('t3_abc123'), false);
  assert.equal(isCommentId('abc123'), false);
  assert.equal(isCommentId(null), false);
});

test('managed announcement requires matching app author, comment, parent and subreddit identity', () => {
  assert.equal(isManagedAnnouncementComment(comment, metadata, 't2_app', 'ExampleSub', 't5_sub'), true);
  assert.equal(isManagedAnnouncementComment({ ...comment, authorId: 't2_other' }, metadata, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment(comment, { ...metadata, appAuthorId: 't2_other' }, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment({ ...comment, id: 't1_other' }, metadata, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment({ ...comment, subredditId: 't5_other' }, metadata, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment({ ...comment, subredditName: 'OtherSub' }, metadata, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment({ ...comment, postId: 't3_other' }, metadata, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment({ ...comment, parentId: 't1_parent' }, metadata, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment(comment, undefined, 't2_app', 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment(comment, metadata, undefined, 'ExampleSub', 't5_sub'), false);
  assert.equal(isManagedAnnouncementComment(comment, metadata, 't2_app', 'ExampleSub', 't5_other'), false);
});
