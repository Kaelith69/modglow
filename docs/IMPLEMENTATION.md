# Implementation and safety notes

## Feature flow

1. Reddit exposes the action only to moderators and the server verifies the caller's moderator identity and `posts` or `all` permission.
2. The endpoint validates the source comment, subreddit identity, available content, author permission attestation, and the parent submission ID.
3. A per comment Redis lock prevents concurrent requests.
4. ModGlow renders the source comment into a minimal AMOLED black SVG with green text, a MOD tag, and the source comment's date and time. It rasterises the SVG to PNG and uploads it to Reddit media hosting.
5. ModGlow publishes the image as a comment under the exact original parent submission using `reddit.submitComment({ id: comment.postId, ... runAs: 'APP' })`. It never creates a new submission.
6. The replacement comment ID is stored immediately. A retry reuses that exact comment instead of publishing a duplicate.
7. ModGlow distinguishes the replacement comment as a moderator, then re-fetches it and verifies both its parent submission and moderator distinction.
8. Only after the replacement comment is verified does ModGlow call `sourceComment.remove(true)`, marking the original comment as spam. It verifies both `removed` and `spam` before reporting success.
9. If publishing or moderator distinction fails, the original comment is left untouched. If the replacement was already published, its ID remains indexed so a retry can safely resume without creating another reply.
10. A seven day deletion tombstone and Reddit's `CommentDelete` trigger provide additional race protection and cleanup.

## Comment removal flow

1. Reddit exposes a separate Remove comment menu action only to moderators.
2. The action opens a confirmation form. The server independently verifies moderator identity, `posts` or `all` permission, subreddit name, subreddit ID, and comment availability.
3. The remove action acquires the same per comment lock as the feature action to prevent a publish and remove race.
4. It calls `comment.remove(false)`, verifies the updated `removed` state, and writes a seven day deletion tombstone as an additional race safeguard.
5. Reddit's `CommentDelete` trigger removes any linked spotlight post. This is moderator removal, not hard deletion of the comment author's account content.

## Content permission and attribution

Reddit's rules require compliance with the Developer Terms and content owner rights when copying existing user content. ModGlow requires the moderator to attest that explicit author permission has already been obtained. The app credits the original author on the image and links to the source discussion. This attestation is a product safeguard, not a substitute for any permission Reddit or the content owner requires.

## Moderator access

Both menu declarations use `forUserType: "moderator"`. Both form handlers independently resolve the current user and call `getModPermissionsForSubreddit()`. Both require `posts` or `all` permission. No individual moderator identity is placed in the image or used as the post author.

## Identity

`runAs: 'APP'` is explicit. The generated post author is the Devvit app account. The card uses an original editorial visual identity and does not reproduce Reddit's native comment interface or use Reddit marks.

## Locking and duplicate protection

- Feature and removal actions share a per comment Redis lock key with a 45 second expiry.
- Acquisition uses atomic `SET NX`, then reads back the unique token. The SET return value alone is not trusted as proof of lock ownership.
- Release reads the key and deletes it only if the stored token still matches. The 45 second lease exceeds Devvit's 30 second request limit, so a live request cannot reach expiry between its token check and delete.
- The short lease recovers when a Devvit Web request is terminated before cleanup can run. It is longer than the platform's 30 second request limit.
- Redis hash `modglow:v2:features` stores the source comment to generated post mapping.
- A completed mapping blocks duplicate feature posts.

## Dependency security

The lockfile overrides vulnerable transitive packages used by the Devvit CLI and lint toolchain: `isomorphic-git` 1.38.6, `tmp` 0.2.7, and `minimatch` 11.0.8. These overrides retain the Devvit 0.15.3 SDK. CI enforces `npm audit --audit-level=moderate`.

CI still reports upstream deprecation notices for transitive `inflight`, `glob@7`, `http-call`, and `whatwg-encoding` packages, plus Node `punycode` and `url.parse` deprecations. These are not current npm audit advisories (`npm audit` reports zero vulnerabilities). They come from the pinned Devvit tooling dependency tree; replacing them independently has not been verified as compatible with Devvit 0.15.3, so they remain documented for a future SDK update.

## Sticky behavior

Community highlights and sticky slots are different Reddit features. ModGlow does not use `subreddit.getHighlightedPosts()` to infer sticky capacity. It calls `post.sticky()` directly. If both sticky slots are occupied or Reddit rejects the pin, the feature transaction attempts to delete the incomplete post and leaves the original comment untouched. It never unpins an existing post to make room.

## Generated post deletion handling

The `onPostDelete` trigger clears the forward comment to post mapping and reverse post to comment mapping when a generated spotlight is deleted or moderator removed. New feature records write both directions. On the first post deletion event after upgrade, the app migrates existing forward mappings to the reverse index. Subsequent events use a single reverse lookup. Repeated or unrelated post deletion events are no ops.

## Source deletion handling

Reddit's `CommentDelete` event covers comment deletion or removal by a user, moderator, or administrator. The trigger first writes a seven day deletion tombstone, then reads the feature mapping. If a mapping exists, it validates the post fullname and deletes the app-authored post even if the post was already moderator removed. It clears the mapping only after the post is deleted or Reddit confirms the post no longer exists. Transient errors return a failure response and retain the mapping so Reddit can retry the event.

The tombstone closes an important race: a deletion event may arrive before an in flight feature request saves its source to post mapping. The feature route checks the tombstone before rendering and after saving the mapping. The manual removal route writes the same tombstone while it still owns the shared comment lock.

## Image rendering

The server builds a minimal SVG containing only an AMOLED black background, green comment text, the source comment date and time, and a highlighted MOD tag. XML escaping and width based wrapping keep special characters and long comments inside the image. `@resvg/resvg-wasm` rasterises the SVG to PNG for Reddit media hosting.

## Required playtest matrix

- Moderator with `posts` permission.
- Moderator without `posts` permission.
- Ordinary user attempting to access either action.
- Comment with and without explicit author permission attestation.
- Deleted, removed, empty, deleted author, and cross subreddit comment cases.
- Markdown, URLs, emoji, XML characters, Malayalam, and Tamil.
- Maximum length and over length comments.
- One free sticky slot and both sticky slots occupied.
- Media upload failure.
- Post submission failure.
- Distinction failure.
- Sticky failure.
- Duplicate and concurrent feature requests.
- Concurrent feature and removal requests.
- Source comment deletion event before, during, and after feature publication.
- Repeated deletion event delivery and transient Reddit API failures.
- Moderator removal confirmation and verification.
- Reddit mobile and desktop.
