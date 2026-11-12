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

/** Compare immutable subreddit IDs as an additional cross-community guard. */
export function belongsToSubredditId(commentSubredditId: string, contextSubredditId: string): boolean {
  return commentSubredditId === contextSubredditId;
}

/** Reject moderator-removed, author-deleted, redacted, and empty comments. */
export function hasCommentContentAvailable(
  body: unknown,
  authorName: unknown,
  removed: boolean,
): boolean {
  if (removed || typeof body !== 'string' || typeof authorName !== 'string') return false;
  const normalizedBody = body.trim().toLowerCase();
  const normalizedAuthor = authorName.trim().toLowerCase();
  return normalizedBody.length > 0
    && normalizedBody !== '[deleted]'
    && normalizedBody !== '[removed]'
    && normalizedAuthor.length > 0
    && normalizedAuthor !== '[deleted]'
    && normalizedAuthor !== '[removed]';
}

/** Treat a missing Reddit object as already cleaned up, but retry transient failures. */
export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    response?: { status?: unknown };
    message?: unknown;
  };
  if ([value.status, value.statusCode, value.response?.status].some((status) => status === 404 || status === '404')) {
    return true;
  }
  if (value.code === 'NOT_FOUND' || value.code === 'RESOURCE_NOT_FOUND') return true;
  return typeof value.message === 'string' && /\\b(?:post|resource|thing)\\s+(?:was\\s+)?not found\\b/i.test(value.message);
}

/** Validate a Reddit post fullname before passing it to the typed Reddit API. */
export function isPostId(value: unknown): value is `t3_${string}` {
  return typeof value === 'string' && /^t3_[a-z0-9]+$/i.test(value);
}
