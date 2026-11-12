# Changelog

## 0.5.0

- Replaced the approximate shared flair card with the four exact supplied IMPORTANT, NOTICE, ANNOUNCEMENT and REMINDER SVG compositions.
- Restored each template's individual geometry, icon, title sizing, solid background and exact palette.
- Rebuilt the body layout at 2000px width with 76px type, 100px line spacing, conservative wrapping and long token splitting.
- Calculate the frame and intrinsic SVG height from the final body line with fixed text and canvas clearance.
- Reject content above 24 rendered lines or 2600 characters rather than clipping or overflowing.
- Updated sample artwork, regression tests, implementation notes and brand documentation.

## 0.4.3

- Replaced the stale smoked announcement sample with the current solid reference template.
- Rewrote the layout audit to match the four exact backgrounds, accents, geometry, and typography.
- Tightened glyph width estimates for lowercase wide letters and non Latin characters to reduce text overflow risk.
- Increased lower frame clearance and corrected stale tests to assert the current body coordinates.
- Added regression tests for wide lowercase text and content, marker, and frame bounds.

## 0.4.2

- Rebuilt all four flair cards to match the supplied comic reference artwork.
- Added the angular frame, slanted icon and title panels, three accent slashes, and vertical body marker.
- Applied the reference red, blue, orange, and lime palettes with cream title panels where shown.
- Recalculated card height and lower frame from wrapped body lines, with conservative text width and bottom clearance.
- Added regression coverage for layout consistency, colour palettes, wrapping, and dynamic height.

## 0.4.1

- Matched the supplied reference layout across all four announcement flairs.
- Standardized frame geometry, diagonal header, wordmark, icon, title, body placement, and padding.
- Kept flair differentiation to the accent colour, title, and matching line icon.
- Added regression tests that verify identical layout geometry across every flair.

## 0.4.0

- Added exactly four selectable announcement flairs: IMPORTANT, NOTICE, REMINDER, and ANNOUNCEMENT.
- Added a distinct solid colour comic book template for each flair.
- Replaced smoked surfaces, gradients, blends, transparency, glow, and shadows with clean AMOLED black canvases and high contrast solid fills.
- Added flair validation and regression tests for all four templates.
- Updated the implementation notes, README, and brand guide.

## 0.3.0

- Replaced the selected-comment spotlight workflow with a moderator-only post menu announcement composer.
- Rendered moderator-authored Markdown as an AMOLED black, smoked, yellow-neon image and publish it as one top-level comment from the ModGlow app account.
- Added headings, quotes, ordered and unordered lists, inline and fenced code, strikethrough, safer escaped Markdown markers, and wrapped style preservation.
- Bundled true IBM Plex Sans italic and bold-italic font faces.
- Removed retired comment conversion, comment removal, source deletion triggers, and unused formatting helpers.
- Added focused renderer regression tests and aligned the documentation and sample artwork with the announcement flow.

# Changelog

## 0.2.3

- Added `onPostDelete` cleanup so manually deleted or moderator removed spotlight posts no longer leave stale source mappings.
- Added a reverse post to source comment index, with one time migration for existing mappings and regression tests.
- Treats an already missing generated post as a successful rollback instead of preserving a stale orphan mapping.
- Rejects malformed stored post mappings instead of leaving a source comment blocked from featuring.


## 0.2.2

- Fixed the actual lock bug: `TxClientLike.get()` queues a Redis GET and returns the transaction handle, not the stored value. The previous code therefore treated every feature attempt as an existing lock and could not correctly release locks.
- Use atomic Redis `SET NX` for acquisition and a watched compare and delete for token safe release.
- Pass the `RichTextBuilder` object to `submitPost`, matching the SDK's `SubmitPostOptions` type instead of passing the builder's serialized string.
- Acquire locks atomically with Redis `SET NX` plus a 45 second expiry. Release uses a watched compare and delete so one request cannot remove another request's lock.
- Fixed stale comment feature locks by moving to a new lock namespace so orphaned v3 locks no longer block features.
- Reduced temporary lock lifetime from 180 seconds to 45 seconds, above Devvit Web's 30 second request limit.
- Replaced the misleading duplicate feature toast with a message explaining an active or timed out request and clarifying that the lock message does not prove a post was published.


## 0.2.1

- Fixed Windows production builds by embedding the Resvg WebAssembly binary through a Vite virtual module instead of importing the WASM file with `?inline`.


## 0.2.0

- Added a separate moderator only Remove comment menu action with explicit confirmation.
- Uses Reddit moderator removal rather than attempting to hard delete another redditor’s comment.
- Documents that a linked spotlight post is removed when its source comment is removed, as required by Reddit content deletion rules.
- Replaced the old shared hash lock with per comment expiring Redis locks using WATCH transactions and token checked release.
- Added a preflight check for occupied community highlight slots before rendering and media upload.
- Made deletion trigger cleanup retain its mapping when Reddit cannot confirm post cleanup, allowing retry.
- Aligned the generated image mark with the official ModGlow aperture logo.
- Added moderator permission and identifier guard tests.

