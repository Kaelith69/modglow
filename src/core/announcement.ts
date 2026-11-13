import { ANNOUNCEMENT_FLAIRS, type AnnouncementFlair } from './render.ts';

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
  includeRulesLink?: boolean;
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
    && isCommentId(metadata.commentId)
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
    && ANNOUNCEMENT_FLAIRS.includes(metadata.flair)
    && typeof metadata.announcement === 'string'
    && typeof metadata.bodyBelowSvg === 'boolean'
    && (metadata.includeRulesLink === undefined || typeof metadata.includeRulesLink === 'boolean')
    && typeof metadata.mediaUrl === 'string'
    && metadata.mediaUrl.startsWith('https://')
  );
}

export function shouldRegenerateAnnouncementImage(
  previous: Pick<AnnouncementMetadata, 'flair' | 'announcement' | 'bodyBelowSvg'>,
  next: Pick<AnnouncementMetadata, 'flair' | 'announcement' | 'bodyBelowSvg'>,
): boolean {
  return previous.flair !== next.flair
    || previous.bodyBelowSvg !== next.bodyBelowSvg
    || (!next.bodyBelowSvg && previous.announcement !== next.announcement);
}

export function isDeleteConfirmed(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as { confirmDelete?: unknown }).confirmDelete === true);
}
