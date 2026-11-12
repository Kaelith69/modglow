# ModGlow brand guide

## Reference comic announcement layout

All four announcement flairs use the supplied reference composition: a clipped angular outer frame, MODGLOW wordmark in the top left, a two part slanted header with a dedicated icon tile, a large italic title, three diagonal accent slashes, and a vertical accent marker beside the message.

- Canvas: 1536px wide, 584px minimum height, solid near black.
- Outer frame: 14px accent stroke, top edge starts at x=350 and y=57, left edge at x=22, right edge at x=1512. The lower right corner is chamfered.
- Wordmark: x=112, baseline y=62.
- Header: y=98 to y=270. The icon tile and title panel have matching diagonal cuts and a 14px separation.
- Title: x=366, baseline y=229, bold italic IBM Plex Sans.
- Three solid diagonal accent slashes sit to the right of the title panel.
- Message: x=145, first baseline y=350, 64px type, 78px line spacing.
- Message marker: x=96, begins at y=306 and ends 28px below the final baseline.

The four templates share these coordinates. Only the accent colour, title panel fill, icon tile fill, icon and title change. The bottom frame edge and marker are calculated from the wrapped message height. The frame keeps at least 32px of clear space below the text.

## Flair accents

| Flair | Accent |
| --- | --- |
| IMPORTANT | `#F20D24` |
| NOTICE | `#087CFF` |
| REMINDER | `#FF7900` |
| ANNOUNCEMENT | `#7CFF00` |

## Shared visual rules

- Solid near black canvas: `#050505`.
- Solid fills and strokes only. No gradients, blended colours, transparency, glow, or drop shadows.
- Warm cream: `#F5F0E6`. Body text and wordmark use warm cream. IMPORTANT and NOTICE use cream title panels with dark italic titles. REMINDER and ANNOUNCEMENT use accent title panels with dark italic titles.
- One matching line icon per flair, placed at the same coordinates.
- No extra badges, labels, decorative panels, textures, or visual effects.

## Typography

IBM Plex Sans regular, italic, bold, and bold italic faces are bundled for Latin glyphs. Noto Sans Malayalam and Noto Sans Tamil remain bundled for those scripts. Body text uses 64px on a 1536px-wide canvas with 78px line spacing. The card grows vertically with wrapped text and rejects content that exceeds the readability limit instead of clipping it.

## Listing assets

The app icon, banner, and wordmarks are listing artwork. They are not screenshots of the live app.
