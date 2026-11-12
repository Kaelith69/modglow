/** Moderator permission and identifier guards shared by menu workflows. */
export function hasCommentModerationPermission(permissions: readonly string[]): boolean {
  return permissions.includes('all') || permissions.includes('posts');
}

export function isCommentId(value: unknown): value is `t1_${string}` {
  return typeof value === 'string' && /^t1_[a-z0-9]+$/i.test(value);
}

export function belongsToSubreddit(commentSubreddit: string, contextSubreddit: string): boolean {
  return commentSubreddit.trim().toLowerCase() === contextSubreddit.trim().toLowerCase();
}

/** Validate a Reddit post fullname before passing it to the typed Reddit API. */
export function isPostId(value: unknown): value is `t3_${string}` {
  return typeof value === 'string' && /^t3_[a-z0-9]+$/i.test(value);
}
