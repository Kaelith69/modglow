# Implementation and safety notes

## Feature flow

1. Reddit exposes the comment menu action only to moderators.
2. The menu endpoint requires a valid comment context and opens an author permission attestation form.
3. The submit endpoint verifies the caller's moderator identity and `posts` or `all` permission.
4. It fetches the comment and checks both subreddit name and immutable subreddit ID, content availability, author attribution, and the 2,600 character limit.
5. It claims a per comment lock with atomic Redis `SET NX`, then reads the key back and proceeds only if its unique token is present.
6. It checks the deletion tombstone and completed feature mapping before rendering.
7. It converts a restricted Markdown subset to plain text, removes XML-invalid characters, escapes XML, renders the editorial SVG, rasterises it to PNG with bundled WebAssembly and fonts, and uploads the image to Reddit media hosting.
8. It submits the post explicitly as `APP`, distinguishes it, calls `sticky()`, and re-fetches it to verify both states.
9. It saves the source comment to post mapping and rechecks the tombstone and current source comment before committing the workflow as complete.
10. The original comment is never edited or removed by the feature action.

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

## Sticky behavior

Community highlights and sticky slots are different Reddit features. ModGlow does not use `subreddit.getHighlightedPosts()` to infer sticky capacity. It calls `post.sticky()` directly. If both sticky slots are occupied or Reddit rejects the pin, the feature transaction attempts to delete the incomplete post and leaves the original comment untouched. It never unpins an existing post to make room.

## Source deletion handling

Reddit's `CommentDelete` event covers comment deletion or removal by a user, moderator, or administrator. The trigger first writes a seven day deletion tombstone, then reads the feature mapping. If a mapping exists, it validates the post fullname and deletes the app-authored post even if the post was already moderator removed. It clears the mapping only after the post is deleted or Reddit confirms the post no longer exists. Transient errors return a failure response and retain the mapping so Reddit can retry the event.

The tombstone closes an important race: a deletion event may arrive before an in flight feature request saves its source to post mapping. The feature route checks the tombstone before rendering and after saving the mapping. The manual removal route writes the same tombstone while it still owns the shared comment lock.

## Image rendering

The server builds a custom editorial SVG using XML-safe escaped comment text and a restricted Markdown to plain text conversion. Text wrapping rejects invalid width arguments and oversized content rather than looping or silently clipping. `@resvg/resvg-wasm` rasterises the SVG to PNG. IBM Plex Sans, Noto Sans Malayalam, and Noto Sans Tamil font files are bundled into the server build. No external rendering endpoint or external AI service is used.

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
