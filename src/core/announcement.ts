import type { AnnouncementFlair } from './render.ts';

export const ANNOUNCEMENT_METADATA_PREFIX = 'modglow:v1:announcement:';

export type AnnouncementMetadata = {
  version: 1;
  commentId: `t1_${string}`;
  postId: `t3_${string}`;
  subredditId: `t5_${string}`;
  subredditName: string;
  appAuthorId: `t2_${string}`;
  flair: AnnouncementFlair;
  announcement: string;
  bodyBelowSvg: boolean;
  mediaUrl: string;
};

export type ManagedCommentIdentity = {
  id: string;
  authorId?: string;
  subredditId: string;
  subredditName: string;
  postId: string;
  parentId: string;
};

export function announcementMetadataKey(commentId: string): string {
  return ANNOUNCEMENT_METADATA_PREFIX + commentId;
}

export function isCommentId(value: unknown): value is `t1_${string}` {
  return typeof value === 'string' && /^t1_[a-z0-9]+$/i.test(value);
}

export function isManagedAnnouncementComment(
  comment: ManagedCommentIdentity,
  metadata: AnnouncementMetadata | undefined,
  appAuthorId: string | undefined,
  subredditName: string | undefined,
  subredditId: string | undefined,
): metadata is AnnouncementMetadata {
  return Boolean(
    metadata
    && appAuthorId
    && subredditName
    && subredditId
    && isCommentId(comment.id)
    && comment.id === metadata.commentId
    && comment.authorId === appAuthorId
    && metadata.appAuthorId === appAuthorId
    && comment.subredditId === subredditId
    && metadata.subredditId === subredditId
    && comment.subredditName.trim().toLowerCase() === subredditName.trim().toLowerCase()
    && metadata.subredditName.trim().toLowerCase() === subredditName.trim().toLowerCase()
    && comment.postId === metadata.postId
    && comment.parentId === metadata.postId
    && /^t3_[a-z0-9]+$/i.test(comment.postId)
    && metadata.version === 1
    && Boolean(metadata.mediaUrl)
  );
}
