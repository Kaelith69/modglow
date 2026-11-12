# ModGlow brand guide

## Shared announcement layout

All four announcement flairs use the same reference composition and exact coordinate system. Only the accent colour, flair title, and matching line icon change.

- Canvas: 1536px wide, 585px minimum height, pure black.
- Outer frame: 12px stroke, left edge at x=32, top edge at y=59, right edge at x=1504, 75px bottom inset.
- Inner frame: 8px stroke, x=72 to x=1464, top at y=98, 85px bottom inset.
- Header panel: same top edge as the inner frame, left edge at x=72, horizontal lower edge at y=252, diagonal cut from x=878 at the top to x=806 at the bottom.
- Wordmark: x=104, y=67.
- Flair icon: centered at x=170, within the left side of the header.
- Flair title: x=263, baseline y=207.
- Announcement body: x=88, first baseline y=340, 64px type, 78px line spacing.

The frame and body retain these positions for every flair. Longer announcements extend the frame downward without changing the header or body padding.

## Flair accents

| Flair | Accent |
| --- | --- |
| IMPORTANT | `#FF4055` |
| NOTICE | `#32B8FF` |
| REMINDER | `#FF9900` |
| ANNOUNCEMENT | `#FFE34F` |

## Shared visual rules

- Pure AMOLED black canvas: `#000000`.
- Solid fills and strokes only. No gradients, blended colours, transparency, glow, or drop shadows.
- White wordmark, flair title, and body text: `#F2F0E8`.
- One matching line icon per flair, placed at the same coordinates.
- No extra badges, labels, decorative panels, textures, or visual effects.

## Typography

IBM Plex Sans regular, italic, bold, and bold italic faces are bundled for Latin glyphs. Noto Sans Malayalam and Noto Sans Tamil remain bundled for those scripts. Body text uses 64px on a 1536px-wide canvas with 78px line spacing. The card grows vertically with wrapped text and rejects content that exceeds the readability limit instead of clipping it.

## Listing assets

The app icon, banner, and wordmarks are listing artwork. They are not screenshots of the live app.
