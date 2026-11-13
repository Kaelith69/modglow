import test from 'node:test';
import assert from 'node:assert/strict';
import {
  announcementMetadataKey,
  isCommentId,
  isManagedAnnouncementComment,
  shouldRegenerateAnnouncementImage,
  isDeleteConfirmed,
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
  includeRulesLink: false,
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
  const legacyMetadata = { ...metadata };
  delete legacyMetadata.includeRulesLink;
  assert.equal(isManagedAnnouncementComment(comment, legacyMetadata, 't2_app', 'ExampleSub', 't5_sub'), true);
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

test('image regeneration follows the selected publishing mode and visual fields', () => {
  const previous = { flair: 'NOTICE' as const, announcement: 'Old body', bodyBelowSvg: true };
  assert.equal(shouldRegenerateAnnouncementImage(previous, { ...previous, announcement: 'New body' }), false);
  assert.equal(shouldRegenerateAnnouncementImage(previous, { ...previous, flair: 'IMPORTANT' }), true);
  assert.equal(shouldRegenerateAnnouncementImage(previous, { ...previous, bodyBelowSvg: false }), true);
  assert.equal(shouldRegenerateAnnouncementImage(
    { ...previous, bodyBelowSvg: false },
    { ...previous, bodyBelowSvg: false, announcement: 'New SVG text' },
  ), true);
  assert.equal(shouldRegenerateAnnouncementImage(
    { ...previous, bodyBelowSvg: false },
    { ...previous, bodyBelowSvg: false, announcement: 'Old body' },
  ), false);
});

test('permanent deletion requires an explicit true confirmation value', () => {
  assert.equal(isDeleteConfirmed({ confirmDelete: true }), true);
  assert.equal(isDeleteConfirmed({ confirmDelete: false }), false);
  assert.equal(isDeleteConfirmed(undefined), false);
  assert.equal(isDeleteConfirmed({ confirmDelete: 'true' }), false);
});
