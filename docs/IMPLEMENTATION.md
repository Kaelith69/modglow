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

The renderer produces a 2000px wide SVG using the supplied four individual reference designs. IMPORTANT uses background #080605, red #FF2525, an ivory title panel and a warning triangle. NOTICE uses background #050D1C, blue #078BFF, an ivory title panel and an information icon. ANNOUNCEMENT uses background #050A05, lime #8CFF00, an ivory icon tile and a megaphone. REMINDER uses background #090604, orange #FF7900, an ivory icon tile and a calendar. Each header preserves its own supplied panel coordinates, icon geometry, title size and textLength.

Body text begins at x=195 and baseline y=475, uses 76px type and 100px line spacing, and wraps within a 1660px safe width. The renderer uses conservative glyph estimates, splits long unbroken tokens, escapes XML and retains supported Markdown styles. The final baseline determines the frame bottom, with 115px below the baseline and 70px between the frame and canvas edge. The vertical marker begins at y=415 and ends 35px below the final baseline. The intrinsic SVG height is calculated from the final rendered line count. Inputs above 2600 characters or 24 rendered lines are rejected rather than clipped.

The SVG has explicit intrinsic width and calculated height with a matching viewBox. This provides deterministic dimensions to the server rasterizer and proportional scaling in the image display. The templates use solid fills only, with no gradients, opacity, filters, external assets or embedded raster images.
