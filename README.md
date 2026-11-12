# ModGlow

**ModGlow is a moderator only Reddit Devvit tool for publishing branded announcement comments.** Each announcement is a single top level comment authored by the ModGlow app, with its SVG image first and an optional native Markdown body beneath it.

## Publishing modes

1. A moderator opens a post menu and selects **Create ModGlow announcement**.
2. The moderator chooses one of the four announcement flairs and writes the content in Markdown.
3. The **Publish Markdown below the SVG** toggle controls the layout:
   * **Off:** the text is rendered inside the SVG. This mode is intended for compact announcements, ideally one or two lines. It accepts up to 2600 grapheme clusters and rejects layouts requiring more than 24 rendered lines.
   * **On:** the SVG contains the title artwork only. The full Markdown body is converted into native Reddit rich text and appended below the image in the same comment. This mode accepts up to 9000 grapheme clusters.
4. ModGlow rasterises the SVG to PNG, uploads it to Reddit media hosting, and builds one comment. The image paragraph is always the first rich text node.
5. The comment is published as the **ModGlow app account**, distinguished as a moderator, and pinned.
6. ModGlow fetches the comment again and verifies that Reddit reports it as both moderator distinguished and stickied.

ModGlow does not create a separate Reddit post, select or quote an existing comment, edit another user's content, or remove existing comments.

## Markdown support

When the separate body toggle is enabled, Markdown is converted into native Reddit rich text:

* Headings from `#` through `######`.
* **Bold**, *italic*, ***bold italic***, and ~~strikethrough~~.
* Inline `code` and fenced code blocks with an optional language label.
* Ordered lists and unordered lists.
* Blockquotes and horizontal rules.
* Clickable HTTP and HTTPS links.
* Markdown images are represented by their alt text. ModGlow does not fetch or embed external images.

Paragraph line breaks are treated as normal Markdown soft breaks. Raw HTML is not interpreted. Link URLs support balanced single level parentheses and only HTTP or HTTPS schemes are made clickable. List markers must start at the beginning of a line. Indented and nested list syntax remains literal text, ordered lists are numbered from 1 by Reddit, and Markdown tables are not converted into native structured blocks. Inline emphasis inside semantic headings is not retained because Reddit heading nodes accept plain text and links rather than formatted text ranges.

When the toggle is off, the existing SVG renderer handles short content inside the image. It supports the same main inline styles and block prefixes, but links are shown as readable labels rather than interactive links.

### Formatting input

The current composer uses Devvit's native menu form. Its paragraph field accepts Markdown source but does not expose custom buttons or cursor selection controls. Use the syntax directly:

````md
# Main heading
## Section heading

**Bold text** and *italic text*

- First bullet
- Second bullet

1. First step
2. Second step

> Quoted text

`inline code`

```js
const ready = true;
```

[Read the rules](https://example.com/rules)
````

A clickable formatting toolbar requires a custom interactive composer view. The native menu form does not provide a supported way to attach such a toolbar to its paragraph field.

## Four announcement flairs

The composer offers exactly four choices. Each flair retains its own title artwork, geometry, and solid colour palette.

* **IMPORTANT:** near black `#080605`, red `#FF2525`, ivory title panel and warning triangle.
* **NOTICE:** midnight navy `#050D1C`, blue `#078BFF`, ivory title panel and information symbol.
* **ANNOUNCEMENT:** deep green black `#050A05`, lime `#8CFF00`, ivory icon tile and megaphone.
* **REMINDER:** warm black `#090604`, orange `#FF7900`, ivory icon tile and calendar.

The title only SVG is a fixed 2000 by 600 canvas. The embedded text SVG retains its dynamic height, wrapping, and frame clearance. The maintained vector examples are `assets/branding/svg/announcement-card-sample.svg` for compact mode and `assets/branding/svg/announcement-title-only-sample.svg` for separate body mode.

## Rendering details

The announcement card SVG declares `Arial, Helvetica, sans-serif` explicitly. The PNG rasterizer uses bundled IBM Plex Sans as its deterministic sans serif fallback when Arial and Helvetica are unavailable. Embedded SVG body text is bold by default at weight 700; blockquotes are bold italic. The separate Markdown body uses Reddit's native typography and formatting.

The server rasterises SVG with bundled WebAssembly and fonts. No gradients, filters, external assets, transparency, or embedded raster artwork are used in the templates.
