# ModGlow implementation notes

## Moderator announcement flow

1. Reddit exposes **Create ModGlow announcement** in the post menu only to moderators.
2. The menu handler requires a valid post context, user ID, subreddit name, and subreddit ID.
3. The native Devvit form collects the flair, Markdown source, and a Boolean option named `bodyBelowSvg`.
4. The submission handler validates the character limit for the selected layout and independently verifies the moderator's `posts` or `all` permission.
5. The handler acquires a per post Redis lock using atomic `SET NX` with a 45 second expiry and token readback.
6. It fetches the post and verifies its subreddit name, immutable subreddit ID, and removal state.
7. The SVG renderer creates either the existing dynamic body card or a fixed 2000 by 600 title banner. Both variants reuse the four individual flair header designs.
8. The SVG is rasterised to PNG using bundled WebAssembly and font files, then uploaded through Devvit's Reddit media capability.
9. ModGlow builds one rich text comment. In both modes the image is the first paragraph and first content node. In separate body mode, parsed Markdown blocks follow it as native Reddit rich text.
10. The app submits one top level comment to the original post using `reddit.submitComment({ id: postId, richtext, runAs: 'APP' })`.
11. The returned comment is distinguished with sticky enabled. ModGlow fetches it again and verifies `stickied === true` and `distinguishedBy === 'moderator'`.
12. If Reddit explicitly returns a comment whose persisted state is not both pinned and moderator distinguished, ModGlow attempts to delete that incomplete app authored comment. If the verification read itself fails, the app does not delete a comment whose state is unknown. It warns the moderator to check the post before retrying, avoiding accidental deletion of a successfully pinned comment or a duplicate retry.
13. The lock is released after the operation. The token is checked before deletion, and the 45 second lease is longer than the documented 30 second request limit so a live request cannot normally reach expiry before cleanup.

## Identity and scope

The comment author is the **ModGlow Devvit app account**, not the moderator who invoked the menu and not the subreddit account. The comment is top level under the selected post. ModGlow does not submit a separate Reddit post, reply to an existing comment, copy another user's comment, or remove existing content.

## Permissions and concurrency

The menu declaration uses `location: "post"` and `forUserType: "moderator"`. The server repeats the permission check using `getModPermissionsForSubreddit()` and requires `posts` or `all`. The app requires Reddit API, media upload, and Redis permissions.

The lock uses a random ownership token and a 45 second lease. The request path does not release a lock unless the value still matches its token. The lease exceeds the configured 30 second request limit, reducing the chance of a request outliving its lock.

## Markdown and image rendering

### Embedded body mode

When `bodyBelowSvg` is false, `buildAnnouncementSvg(markdown, flair)` renders the complete short body into the image. It retains the 2000px width, 76px type, 100px line spacing, 1660px safe width, grapheme aware wrapping, XML escaping, and 24 line ceiling. Inputs above 2600 grapheme clusters or 24 rendered lines are rejected rather than clipped.

### Separate body mode

When `bodyBelowSvg` is true, `buildAnnouncementHeaderSvg(flair)` creates a fixed 2000 by 600 title image with no announcement body text. The original header designs and palettes remain unchanged.

`parseMarkdown()` converts headings, paragraphs, quotes, ordered and unordered lists, variable length backtick or tilde fenced code blocks, and horizontal rules into a small typed block model. Inline parsing supports bold, italic, combined bold and italic, strikethrough, monospace code, escaped punctuation, HTTP and HTTPS links including balanced single level parentheses, and image alt text. Unsafe link schemes are converted to plain link labels. Raw HTML is inserted only as text and is never interpreted as markup. List markers must start at the beginning of a line. Indented and nested list syntax remains literal text, ordered lists are numbered from 1 by Reddit, and Markdown tables are not converted into native structured blocks. Inline emphasis inside semantic headings is not retained because Reddit heading nodes only accept raw text and links.

`buildAnnouncementRichText()` inserts the uploaded image in the first paragraph, then appends the parsed blocks with `RichTextBuilder`. Text formatting uses Reddit's `FormattingFlag` numeric values and `FormatRange` offsets. Separate body mode allows up to 9000 grapheme clusters.

### Form toolbar constraint

The current post menu opens a native Devvit form. Its paragraph field supports multiline text and a Boolean layout toggle, but the supported form field API does not expose custom toolbar buttons or cursor selection. The Markdown source can be entered directly using the examples in the field placeholder. A true interactive toolbar requires a custom client composer and a different launch path. ModGlow does not render inert toolbar buttons.

## Typography and assets

The SVG declares `Arial, Helvetica, sans-serif` explicitly for all text. The PNG rasterizer uses bundled IBM Plex Sans as its deterministic sans serif fallback when Arial and Helvetica are unavailable. Embedded body text is bold by default at weight 700, and blockquotes are bold italic. The renderer embeds regular, semibold, italic, bold and bold italic IBM Plex Sans faces, plus Malayalam and Tamil fonts.

The four flair themes retain distinct solid backgrounds and accents: IMPORTANT uses `#080605` and `#FF2525`; NOTICE uses `#050D1C` and `#078BFF`; ANNOUNCEMENT uses `#050A05` and `#8CFF00`; REMINDER uses `#090604` and `#FF7900`. No gradients, opacity, filters, external assets, or embedded raster artwork are used in the templates.

## Verification notes

Unit coverage includes moderator identity guards, flair geometry and palette, embedded SVG layout, fixed title banner dimensions, Markdown token parsing, escaping, Unicode grapheme limits, links, and block conversion. A successful local build and a Reddit playtest are still required to verify package typings and final client rendering.
