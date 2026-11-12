# MODGLOW announcement template guide

## Source of truth

The four announcement SVG templates reproduce the supplied IMPORTANT, NOTICE, ANNOUNCEMENT and REMINDER artwork. They are intentionally different compositions, not one generic card recoloured four times.

All templates use a 2000px wide SVG viewBox, editable vector shapes and text, solid fills, and no external assets, gradients, filters, transparency or raster artwork. Compact mode calculates SVG height from the final body line. Separate body mode uses a fixed 2000 by 600 title only SVG, followed by native Reddit Markdown in the same comment. The viewBox preserves its aspect ratio when scaled to fit a Reddit image display.

## IMPORTANT

- Background: `#080605`
- Frame and accents: `#FF2525`
- Ivory: `#FFF5E8`
- Red left panel with ivory warning triangle.
- Ivory title panel, dark italic IMPORTANT title, two red diagonal accents.
- Title uses 145px type and a 1000px textLength.

## NOTICE

- Background: `#050D1C`
- Frame and accents: `#078BFF`
- Ivory: `#FFF5E8`
- Blue left panel with ivory information icon.
- Ivory title panel, dark italic NOTICE title, two blue diagonal accents.
- Title uses 150px type and a 720px textLength.

## ANNOUNCEMENT

- Background: `#050A05`
- Frame and accents: `#8CFF00`
- Ivory: `#FFF5E8`
- Ivory left panel with dark green megaphone icon.
- Green title panel, dark italic ANNOUNCEMENT title, two green diagonal accents.
- Title uses 130px type and a 1100px textLength.

## REMINDER

- Background: `#090604`
- Frame and accents: `#FF7900`
- Ivory: `#FFF5E8`
- Ivory left panel with a dark calendar icon.
- Orange title panel, dark italic REMINDER title, two orange diagonal accents.
- Title uses 145px type and a 1050px textLength.

## Dynamic body layout and bounds

The maintained `announcement-card-sample.svg` demonstrates compact mode with its body embedded in the SVG. `announcement-title-only-sample.svg` demonstrates the fixed title banner used when the separate Markdown body option is enabled. In both modes, the SVG image is the first element in the published comment.

- Body starts at x=195 with 76px text and 100px baseline spacing.
- The body uses conservative per glyph width estimates and wraps words before they reach the safe right margin. Long unbroken tokens are split.
- Body content is limited to 24 rendered lines and 2600 input characters. Content beyond either limit is rejected rather than clipped.
- The last text baseline determines the bottom frame position. The frame keeps 115px below the baseline, and the canvas keeps a further 70px below the frame.
- The vertical accent marker starts at y=415 and ends 35px below the last text baseline.
- The root SVG has explicit intrinsic width and calculated height with a matching viewBox. This keeps the rasterizer dimensions deterministic while allowing the image to scale proportionally in the client.

## Typography and text safety

The SVG declares the explicit font stack `Arial, Helvetica, sans-serif` for the wordmark, display headings and body text. The PNG rasterizer keeps bundled IBM Plex Sans as its deterministic sans serif fallback when Arial and Helvetica are unavailable. Body text is bold by default at weight 700. Blockquotes are bold italic. Display headings retain their existing heavy italic treatment and individual title panel geometry. The renderer embeds regular, semibold, italic, bold and bold italic IBM Plex Sans faces, plus Malayalam and Tamil font files. All user supplied text is XML escaped. Markdown links and images are represented by their readable labels, not fetched or embedded as external resources.

Text wrapping uses conservative estimated glyph widths rather than exact shaping metrics. The estimate intentionally preserves a right safety margin. Regression tests cover the four flairs, bold defaults, long unbroken tokens and dynamic frame bounds. A visual PNG check in the actual Reddit client remains necessary for final platform verification.
