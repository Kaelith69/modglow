# ModGlow implementation notes

## Moderator announcement flow

1. Reddit exposes **Create ModGlow announcement** in the post menu only to moderators.
2. The menu handler requires a valid post context, user ID, subreddit name, and subreddit ID.
3. The handler opens a multiline Markdown paragraph field.
4. The submission handler validates the shared announcement character limit and independently verifies the moderator's `posts` or `all` permission.
5. The handler acquires a per-post Redis lock using atomic `SET NX` with a 45-second expiry and token readback.
6. It fetches the post and verifies its subreddit name, immutable subreddit ID, and removal state.
7. The Markdown renderer converts supported block and inline formatting to SVG text runs, escapes XML content, and wraps text to the card width.
8. The SVG is rasterised to PNG using bundled WebAssembly and font files.
9. The PNG is uploaded through Devvit's Reddit media capability.
10. The app submits one top-level comment to the original post using `reddit.submitComment({ id: postId, richtext, runAs: 'APP' })`.
11. The returned comment is distinguished with sticky enabled. ModGlow fetches it again and verifies `stickied === true` and `distinguishedBy === 'moderator'`.
12. If publication succeeds but pin verification fails, ModGlow attempts to delete the incomplete app-authored comment.
13. The lock is released only when its token still belongs to the current request.

## Identity and scope

The comment author is the **ModGlow Devvit app account**, not the moderator who invoked the menu and not the subreddit account. The comment is top-level under the selected post. ModGlow does not submit a separate Reddit post, reply to an existing comment, copy another user's comment, or remove existing content.

## Permissions

The menu declaration uses `location: "post"` and `forUserType: "moderator"`. The server repeats the permission check using `getModPermissionsForSubreddit()` and requires `posts` or `all`. The app requires Reddit API, media upload, and Redis permissions.

## Markdown and image rendering

The renderer supports bold, italic, bold italic, strikethrough, headings, blockquotes, ordered and unordered lists, inline code, fenced code blocks, link labels, and image alt text. Raw HTML is not interpreted. Markdown links and image URLs are not embedded as external resources.

The renderer produces a 1536px-wide SVG with a 584px minimum height. All four flairs use the supplied reference composition: a chamfered outer frame, top left MODGLOW wordmark, slanted icon tile, slanted title panel, three diagonal accent slashes, and a vertical message marker. The outer frame starts at x=22 and y=50, with its top horizontal segment beginning at x=350 and its right edge at x=1512. The wordmark is at x=112 and y=62. The header spans y=98 to y=270. The title begins at x=366 with baseline y=229. Message text begins at x=145 with baseline y=350, 64px type, and 78px line spacing. The vertical marker begins at x=96 and y=306. The message wraps to a conservative 1300px text width using wider estimates for lowercase m and w, uppercase glyphs, and non Latin characters. SVG height is calculated from the rendered line count, preserving at least 33px between the final line bounds and the inner bottom frame edge. The marker ends 28px below the final baseline. The accent colours are red (#F20D24), blue (#087CFF), orange (#FF7900), and lime green (#7CFF00). IMPORTANT and NOTICE use warm cream (#F5F0E6) title panels with dark text. REMINDER and ANNOUNCEMENT use their accent colours for the title panels with dark text. The solid near black backgrounds are IMPORTANT (#050000), NOTICE (#02091B), REMINDER (#070300), and ANNOUNCEMENT (#010703). No gradients, opacity, filters, glow, or drop shadows are rendered.

## Failure handling

- A per-post lock prevents concurrent requests from racing through image upload and comment creation.
- Post ownership is checked against both subreddit name and subreddit ID.
- Failed validation, rendering, or media upload exits before a comment is submitted.
- Failed comment submission exits without creating a Reddit post.
- Failed pin verification triggers best-effort deletion of the app-authored comment.
- Lock release checks the unique token before deleting the key. The 45-second lease exceeds Devvit's 30-second request limit so a live request cannot normally outlast its lease.
- Redis stores only the short-lived lock, not announcement content.

## Platform constraints

The generated image is embedded in a Reddit comment using RTJSON via `RichTextBuilder`. The image is hosted on Reddit media storage so Reddit can render it inline. Devvit's `Comment.distinguish(true)` distinguishes the comment as a moderator and pins it. Reddit pins top-level comments, which is why ModGlow submits the image comment directly to the post rather than as a reply.

## Required playtest matrix

- Moderator with `posts` permission.
- Moderator with `all` permission.
- Moderator without post permissions.
- Ordinary user attempting to invoke the endpoint directly.
- Valid post, removed post, and cross-subreddit context.
- Bold, italic, bold italic, strikethrough, headings, quotes, lists, inline code, fenced code, links, and images.
- Emoji, XML-sensitive characters, control characters, Malayalam, and Tamil.
- Empty, markup-only, over-limit, and over-height announcements.
- Duplicate and concurrent requests on one post.
- Requests on different posts.
- Media upload failure.
- Comment submission failure.
- Distinguish or sticky failure and cleanup failure.
- Reddit mobile and desktop.
