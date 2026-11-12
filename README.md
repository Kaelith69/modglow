# ModGlow

**ModGlow is a moderator only Reddit Devvit tool for replacing one manually selected comment with a moderator distinguished image reply under the same submission.** A moderator opens the comment menu, confirms that the author has explicitly permitted the feature, and publishes the image as the Devvit app account. The app then removes the original comment as spam.

The replacement is posted as a comment under the source comment's exact parent submission. The source comment is removed only after the replacement reply is published and moderator distinction is verified. The source is removed as spam, not hard deleted.

## What the app does

1. A moderator opens the three dot menu on one comment and chooses **Feature with ModGlow**.
2. The moderator confirms that the comment author has explicitly permitted the comment to be featured publicly.
3. ModGlow validates the source comment and its parent submission.
4. The app renders a minimal AMOLED black image with green comment text, the comment date and time, and a MOD tag.
5. The image is uploaded to Reddit and published as a comment under the original parent submission using `reddit.submitComment()`. No new post is created.
6. The replacement comment is distinguished as a moderator and re fetched to verify its parent submission and moderator status.
7. Only after verification does ModGlow remove the original comment using Reddit's spam removal operation.
8. The replacement comment ID is stored so retries reuse the same reply rather than creating duplicates.

## Moderator only controls

- Both comment menu actions are configured with `forUserType: "moderator"`.
- Both form handlers independently verify the caller's moderator identity and `posts` or `all` permission before acting.
- There is no ordinary user menu action, automatic comment scanning, scheduled publishing, or bulk conversion.
- The replacement workflow uses Reddit's `remove(true)` operation to classify the source comment as spam, not a hard delete.
- Each spotlight is initiated by a moderator from a specific comment.
- The moderator must attest that the author has permitted this use. A moderator's selection does not itself grant rights to republish another redditor's content.

## Identity and attribution

The replacement comment is created by the **ModGlow Devvit app account**, not by the individual moderator who clicked the action. Devvit does not provide a generic subreddit account identity such as `u/<subreddit>`; `runAs: 'APP'` uses the app account. Reddit's moderator distinction is applied to the replacement comment.

## Failure handling

- If validation, rendering, media upload, comment submission, distinction, or verification fails, the original comment is not intentionally removed.
- If a replacement comment was published but a later step failed, its ID remains indexed. A retry reuses that exact reply and resumes the workflow.
- A per comment Redis lock uses atomic `SET NX` with a 45 second expiry. The app verifies ownership by reading back its unique token, then releases it only if the token still matches. The 45 second lease exceeds Devvit's 30 second request limit, so a live request cannot reach expiry between its ownership check and delete. Feature and removal actions share the lock.
- A separate Redis mapping records the replacement reply ID for each source comment. A retry reuses the recorded reply.

## Data handling

- Redis stores source comment to replacement reply IDs, short lived conversion locks, and seven day deletion tombstones. It does not store comment bodies, author profile URLs, avatars, or other profile details.
- The app does not store the comment body, author profile URL, avatar, or other profile details in Redis.
- The comment text is processed only to render the requested image and publish the Reddit comment reply.
- The generated image is uploaded to Reddit media hosting and embedded in the replacement comment.
- The app makes no external HTTP requests and does not use an external AI service.

## Visual design

The image contains only a pure black background, green comment text, the comment's date and time, and a small highlighted MOD tag. Text is wrapped and XML escaped to prevent clipping and markup injection. Comments longer than 2,600 characters or 42 rendered lines are rejected rather than silently clipped.

## Brand and listing assets

The `assets/branding/` directory contains the ModGlow visual identity and marketing exports. The Devvit profile icon is configured in `devvit.json` as `assets/modglow-icon.png` (1024 × 1024 PNG). The editable SVG masters, banner artwork, wordmarks, sample spotlight card, and portrait promotional panels are included in that directory.

The portrait promotional panels are marketing illustrations, **not genuine screenshots of the running app**. If the App Directory submission asks for product screenshots, capture real screens from a Devvit playtest and use synthetic example content. Do not submit promotional illustrations as actual UI screenshots.

See `assets/branding/BRAND-GUIDE.md` and `assets/branding/UPLOAD-CHECKLIST.md` for dimensions, colors, file purposes, and upload guidance.

## Requirements

- Node.js **24.18.0 or newer**
- npm
- Reddit Developer Platform account
- A test subreddit where you have moderator permissions
- A test submission containing a comment to replace

## Local setup

```bash
npm ci
npx devvit login
npx devvit whoami
npm run check
```

## Playtest

Use a test subreddit first:

```bash
npm run dev
```

Create a test comment and open its comment menu as a moderator. Confirm the permission attestation, publish the replacement, and verify that it appears under the same submission, is authored by the Devvit app account, and is moderator distinguished. Confirm the original comment is marked as spam only after the replacement is visible. Retry the action and verify that no duplicate reply is created. Also test upload failure, submission failure, distinction failure, long content, multiline text, XML characters, emoji, Malayalam, and Tamil.

## Feature request locking

Replacement publication and source comment removal share a per comment Redis lock. Acquisition uses atomic Redis `SET NX` with a 45 second expiry, then reads the key back and proceeds only when the unique request token is present. The `SET NX` return value alone is not treated as proof of ownership. Release reads the key and deletes it only when the stored token still belongs to the current request. The lease is longer than Devvit's 30 second request limit, preventing normal live requests from crossing expiry during release. The lease allows recovery when a Devvit Web request is terminated at its 30 second request limit before cleanup can run. A lock contention message means another request is active or a previous request timed out; it does not mean a feature post was successfully created. The persistent source comment to replacement reply mapping remains the authoritative duplicate check.

Reddit's `CommentDelete` trigger writes a seven day deletion tombstone before looking up the source to post mapping. This closes the race where deletion is delivered before an in flight feature request saves its mapping. The replacement request checks the tombstone before rendering and before removing the source comment.

## Dependency security

The lockfile pins security overrides for vulnerable transitive tooling dependencies: `isomorphic-git` 1.38.6, `tmp` 0.2.7, and `minimatch` 11.0.8. These preserve the Devvit 0.15.3 SDK while addressing the advisories reported in the original dependency tree. CI runs `npm audit --audit-level=moderate` and fails if a moderate or higher advisory is reintroduced.

## Validation and publishing

```bash
npm run check
npm run deploy
```

Submit the app for Reddit review:

```bash
npx devvit publish
```

For a public App Directory listing so moderators of other communities can install it:

```bash
npx devvit publish --public
```

Public distribution requires Reddit approval. Review the current [launch guide](https://developers.reddit.com/docs/guides/launch/launch-guide) and [Devvit Rules](https://developers.reddit.com/docs/devvit_rules) before submission. A GitHub repository alone does not publish or approve a Devvit app.

## GitHub

Repository: [Kaelith69/modglow](https://github.com/Kaelith69/modglow). Push updates to the existing `main` branch after validation:

```bash
git add .
git commit -m "Describe the verified ModGlow changes"
git push origin main
```

The included GitHub Actions workflow runs type checks, unit tests, lint, and the production build on pushes and pull requests.

## Project structure

```text
modglow/
├── .github/workflows/ci.yml
├── docs/IMPLEMENTATION.md
├── src/
│   ├── core/
│   │   ├── format.test.ts
│   │   ├── moderation.test.ts
│   │   ├── moderation.ts
│   │   ├── format.ts
│   │   ├── rasterize.ts
│   │   └── render.ts
│   ├── routes/
│   │   ├── forms.ts
│   │   ├── menu.ts
│   │   └── triggers.ts
│   ├── types/assets.d.ts
│   └── index.ts
├── devvit.json
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Known limitations

- Devvit supports `runAs: 'APP'` or `runAs: 'USER'`. It does not provide a generic subreddit identity such as `u/Coconaad`. The replacement is therefore authored by the configured Devvit app account, never by the individual moderator.
- Reddit app review is required before the app can be listed publicly for other moderators.

## License

ModGlow source code is MIT licensed. Third party assets and notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
