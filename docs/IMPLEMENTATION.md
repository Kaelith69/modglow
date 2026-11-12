# Implementation and safety notes

## Request flow

1. Reddit shows the comment menu item only to moderators.
2. The menu endpoint opens a short form containing the selected comment ID and an explicit author permission attestation.
3. The submit endpoint verifies the caller's moderator identity and post permission for the current subreddit.
4. It fetches the comment again and verifies the comment belongs to the current subreddit, is available, has text, and has an attributable author.
5. It acquires a per comment Redis lock using `WATCH` and an expiring transaction, then checks the completed feature map.
6. It converts a safe Markdown subset to plain text, escapes XML, renders an original editorial SVG, rasterises it to PNG with bundled WebAssembly and fonts, and uploads the image to Reddit media hosting.
7. It submits the post explicitly as `APP`, distinguishes it, pins it in the next available sticky slot, and re-fetches it to verify both states.
8. It records the source comment ID to generated post ID mapping. The feature action never edits or removes the original comment.

## Content permission and attribution

Reddit's rules state that existing user content may be copied and displayed only in compliance with the Developer Terms and any requirements imposed by the content owner. ModGlow therefore requires the moderator to attest that explicit author permission has already been obtained. The app credits the original author on the image and links to the source discussion in the post body. This attestation is a product safeguard, not a substitute for any permission Reddit or the content owner requires.

## Moderator access

Both menu declarations use `forUserType: "moderator"`. Each form handler independently resolves the current user and calls `getModPermissionsForSubreddit()`. Both require `posts` or `all` permission. No individual moderator identity is placed in the image or used as the post author. The separate removal flow calls `comment.remove(false)`, Reddit's moderator removal operation. It is not a hard delete of another user's comment.

## Identity

`runAs: 'APP'` is explicit. The generated post author is the Devvit app account. The card uses a separate, original editorial visual identity and does not reproduce Reddit's native comment interface or use Reddit marks.

## Transaction and duplicate protection

- Per comment Redis keys store unique lock tokens with a 180 second expiry. `WATCH` transactions make acquisition and token checked release safe under concurrent requests.
- Redis hash `modglow:v2:features` stores the source comment to generated post mapping.
- A concurrent request is rejected while a valid lock exists. Expired locks recover after a crashed request, and a request cannot release a newer request's lock.
- A completed mapping blocks duplicate posts.
- If a post is created but distinction, pinning, or verification fails, the app attempts to delete the incomplete post. The source comment remains untouched.
- The app checks `subreddit.getHighlightedPosts()` before creating media and stops if both community highlight slots are occupied. A race that fills a slot after the check is handled by the pin failure rollback.

## Source deletion handling

Reddit's `CommentDelete` event covers comment deletion or removal by a user, moderator, or administrator. Reddit's rules require copied user content to be removed when the source is deleted. The trigger looks up the generated post ID, deletes the post, and clears the mapping only after deletion succeeds. If Reddit is temporarily unavailable, the handler returns an error and retains the mapping so the event can be retried. Repeated delivery is safe. This trigger is required for public app compliance.

## Image rendering

The server builds a custom editorial SVG using escaped comment text and a restricted Markdown to plain text conversion. `@resvg/resvg-wasm` rasterises the SVG to PNG. IBM Plex Sans, Noto Sans Malayalam, and Noto Sans Tamil font files are bundled into the server build. No external rendering endpoint or external AI service is used.

## Required playtest matrix

- Moderator with `posts` permission.
- Moderator without `posts` permission.
- Ordinary user attempting to access the action.
- Comment with explicit author permission.
- Comment without author permission attestation.
- Deleted, removed, empty, and deleted author cases.
- Markdown, URLs, emoji, XML characters, Malayalam, and Tamil.
- Maximum length and over length comments.
- One free sticky slot and both sticky slots occupied.
- Media upload failure.
- Post submission failure.
- Distinction failure.
- Sticky failure.
- Duplicate and concurrent requests.
- Source comment deletion trigger, including repeated event delivery and transient Reddit API failures.
- Moderator comment removal confirmation, permission denial, cross subreddit guard, and already removed comments.
- Reddit mobile and desktop.
