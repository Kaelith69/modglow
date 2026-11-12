# ModGlow implementation notes

## Moderator announcement flow

1. Reddit exposes **Create ModGlow announcement** in the post menu only to moderators.
2. The menu handler requires a valid post context, user ID, subreddit name, and subreddit ID.
3. The handler opens a multiline Markdown paragraph field.
4. The submission handler validates the announcement length and independently verifies the moderator's `posts` or `all` permission.
5. The handler acquires a per-post Redis lock using atomic `SET NX` with a 45-second expiry and token readback.
6. It fetches the post and verifies its subreddit name, immutable subreddit ID, and removal state.
7. The Markdown is rendered to an SVG card and rasterised to PNG using bundled WebAssembly and fonts.
8. The PNG is uploaded through Devvit's Reddit media capability.
9. The app submits one top-level comment to the original post using `reddit.submitComment({ id: postId, richtext, runAs: 'APP' })`.
10. The returned comment is distinguished with sticky enabled. ModGlow fetches it again and verifies `stickied === true` and `distinguishedBy === 'moderator'`.
11. If publication succeeds but pin verification fails, ModGlow attempts to delete the incomplete app-authored comment.
12. The lock is released only when its token still belongs to the current request.

## Identity and scope

The comment author is the **ModGlow Devvit app account**, not the moderator who invoked the menu and not the subreddit account. The comment is top-level under the selected post. ModGlow does not submit a separate Reddit post, reply to an existing comment, copy another user's comment, or remove existing content.

## Permissions

The menu declaration uses `location: "post"` and `forUserType: "moderator"`. The server repeats the permission check using `getModPermissionsForSubreddit()` and requires `posts` or `all`. The app requires Reddit API, media upload, and Redis permissions.

## Image rendering

The renderer produces a 1536px-wide SVG and rasterises it to PNG with `@resvg/resvg-wasm`. The design uses an AMOLED black base, smoked charcoal overlay, low-opacity yellow smoke, yellow neon border accents, soft glow and text shadows, and high-contrast light body text. Body text is 64px before rasterisation, deliberately larger than typical Reddit comment text. Bold, italic, and bold-italic Markdown are rendered with SVG font weight and style attributes. IBM Plex Sans is bundled for Latin text, with Noto Sans Malayalam and Noto Sans Tamil for those scripts.

The card expands vertically as content wraps. Oversized content is rejected rather than clipped. XML text is escaped before insertion into SVG.

## Failure handling

- A per-post lock prevents concurrent requests from racing through image upload and comment creation.
- Post ownership is checked against both subreddit name and subreddit ID.
- Failed rendering or media upload exits before a comment is submitted.
- Failed comment submission exits without a partial Reddit post.
- Failed pin verification triggers best-effort deletion of the app-authored comment.
- Lock release checks the unique token before deleting the key.
- Redis stores only the short-lived lock, not announcement content.

## Platform constraints

The generated image is embedded in a Reddit comment using RTJSON via `RichTextBuilder`. The image must be hosted on Reddit media storage to render inline. Devvit's `Comment.distinguish(true)` both distinguishes the comment as a moderator and pins it. Reddit only pins top-level comments, which is why ModGlow always submits the image comment directly to the post rather than as a reply.

The standard Devvit menu form provides a multiline Markdown input but does not provide an inline generated-image preview step. A dedicated preview interface would require a separate client-side UI workflow.

## Required playtest matrix

- Moderator with `posts` permission.
- Moderator with `all` permission.
- Moderator without post permissions.
- Ordinary user attempting to invoke the endpoint directly.
- Valid post, removed post, and cross-subreddit context.
- Bold, italic, bold-italic, headings, lists, links, code, quotes, and blank lines.
- Emoji, XML characters, Malayalam, and Tamil.
- Empty and over-limit announcements.
- Duplicate and concurrent requests on one post.
- Requests on different posts.
- Media upload failure.
- Comment submission failure.
- Distinguish or sticky failure.
- Reddit mobile and desktop.
