/** Moderator permission guard for the post level announcement action. */
export function hasPostModerationPermission(permissions: readonly string[]): boolean {
  return permissions.includes('all') || permissions.includes('posts');
}

export function isPostId(value: unknown): value is `t3_${string}` {
  return typeof value === 'string' && /^t3_[a-z0-9]+$/i.test(value);
}

export function isUserId(value: unknown): value is `t2_${string}` {
  return typeof value === 'string' && /^t2_[a-z0-9]+$/i.test(value);
}

export function belongsToSubreddit(resourceSubredditName: string, contextSubredditName: string): boolean {
  return resourceSubredditName.trim().toLowerCase() === contextSubredditName.trim().toLowerCase();
}

/** Compare immutable subreddit IDs as an additional cross-community guard. */
export function belongsToSubredditId(resourceSubredditId: string, contextSubredditId: string): boolean {
  return resourceSubredditId === contextSubredditId;
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
  return typeof value.message === 'string' && value.message.toLowerCase().includes('not found');
}
