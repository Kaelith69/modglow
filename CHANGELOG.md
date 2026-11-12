# Changelog

## 0.2.0

- Added a separate moderator only Remove comment menu action with explicit confirmation.
- Uses Reddit moderator removal rather than attempting to hard delete another redditor’s comment.
- Documents that a linked spotlight post is removed when its source comment is removed, as required by Reddit content deletion rules.
- Replaced the old shared hash lock with per comment expiring Redis locks using WATCH transactions and token checked release.
- Added a preflight check for occupied community highlight slots before rendering and media upload.
- Made deletion trigger cleanup retain its mapping when Reddit cannot confirm post cleanup, allowing retry.
- Aligned the generated image mark with the official ModGlow aperture logo.
- Added moderator permission and identifier guard tests.
