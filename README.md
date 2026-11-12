# ModGlow

**ModGlow is a moderator-only Reddit Devvit tool for publishing designed announcements as pinned image comments.** A moderator opens a post menu, writes an announcement in Markdown, and ModGlow renders it into a custom SVG, rasterises it to PNG, uploads it to Reddit media hosting, and publishes one top-level comment as the ModGlow app account.

## How it works

1. A moderator opens a Reddit post and selects **Create ModGlow announcement** from the post menu.
2. The moderator writes the announcement in a multiline Markdown field.
3. ModGlow renders the text into its branded image card.
4. The image is uploaded to Reddit media hosting and embedded in one top-level comment under the original post.
5. The comment is published as the **ModGlow app account**, distinguished as a moderator, and pinned.
6. ModGlow fetches the comment again and verifies that Reddit reports it as both moderator-distinguished and stickied.

ModGlow does not create a separate Reddit post, select or quote an existing comment, edit another user's content, or remove existing comments.

## Markdown support

The SVG renderer supports:

- **Bold**, *italic*, ***bold italic***, and ~~strikethrough~~.
- Headings, blockquotes, ordered lists, and unordered lists.
- Inline code and fenced code blocks.
- Markdown links, displayed as their readable link text.
- Markdown images, displayed as their alt text.

Raw HTML is not rendered. Links and images are represented as readable text in the card, not as interactive or embedded external media. XML-sensitive text is escaped before rendering.

## Four announcement flairs

The composer offers exactly four choices, each reproducing its own supplied SVG artwork rather than recolouring one shared layout.

- **IMPORTANT:** near black `#080605`, red `#FF2525`, ivory warning triangle and ivory title panel.
- **NOTICE:** midnight navy `#050D1C`, blue `#078BFF`, ivory information symbol and ivory title panel.
- **ANNOUNCEMENT:** deep green black `#050A05`, lime `#8CFF00`, dark green megaphone on an ivory tile and lime title panel.
- **REMINDER:** warm black `#090604`, orange `#FF7900`, dark calendar on an ivory tile and orange title panel.

Each template uses its own exact header geometry, title size, title width, icon, accent slashes and palette from the supplied SVG references. The SVG uses a 2000px wide viewBox and an intrinsic height calculated from the final wrapped text line.

Body text begins at x=195 with 76px type and 100px line spacing. Text is wrapped using conservative glyph width estimates inside a 1660px safe width. Long unbroken tokens are split. The bottom frame and canvas grow with the final line, preserving fixed clearance below the text and frame. Content exceeding 24 rendered lines or 2600 input characters is rejected rather than clipped.

The source is editable vector SVG. The server rasterizes it to a proportional PNG for Reddit media upload. No gradients, filters, transparency, external assets or raster artwork are used in the templates.