# ModGlow

**ModGlow is a moderator only Reddit Devvit tool for turning one manually selected comment into an attributed community spotlight image.** A moderator opens the comment menu, confirms that the author has explicitly permitted the feature, and publishes the image as the ModGlow app account. The app applies Reddit's native moderator distinction and pins the new post.

The feature action leaves the original comment unchanged. A separate **Remove comment** moderator action is available when a moderator needs to remove the selected comment. Reddit's developer rules require ModGlow to remove any copied spotlight post when its source comment is deleted or removed, so choosing removal also causes the linked feature post to be removed. This platform requirement cannot be disabled in a public distribution build.

## What the app does

1. A moderator opens the three dot menu on one comment and chooses **Feature with ModGlow**.
2. Reddit only displays the action to moderators. The server independently verifies that the caller is a moderator with post moderation permission in the current subreddit.
3. The moderator confirms that the comment author has explicitly permitted the comment to be featured publicly, including their username and a link to the original discussion.
4. ModGlow fetches the selected comment again, validates its source subreddit and available author attribution, and rejects removed, deleted, empty, or excessively long comments.
5. The app renders a custom editorial style image. It is not a recreation of Reddit's comment interface and does not use Reddit logos, Snoo, or Reddit trademarks.
6. The image is uploaded to Reddit and a post is submitted using `runAs: 'APP'`. The individual moderator's account is not used as the post author.
7. ModGlow distinguishes the post as a moderator and pins it in an available sticky slot. It verifies both states before reporting success.
8. The original comment remains unchanged. The new post links back to the original discussion and identifies the original commenter on the image.
9. A separate **Remove comment** action opens a confirmation form and uses Reddit's moderator removal API. It does not hard delete another person's comment. If a ModGlow feature already exists for that comment, the required `CommentDelete` cleanup removes the copied spotlight post too.
10. If the original comment is later deleted or removed by anyone, Reddit sends a `CommentDelete` event. ModGlow removes the associated spotlight post and its stored mapping as required by Reddit's content deletion rules.

## Moderator only controls

- Both comment menu actions are configured with `forUserType: "moderator"`.
- Both form handlers independently verify the caller's moderator identity and `posts` or `all` permission before acting.
- There is no ordinary user menu action, automatic comment scanning, scheduled publishing, or bulk conversion.
- Comment removal is a separate, explicitly confirmed action. It uses Reddit's moderator `remove(false)` operation, not a hard delete.
- Each spotlight is initiated by a moderator from a specific comment.
- The moderator must attest that the author has permitted this use. A moderator's selection does not itself grant rights to republish another redditor's content.

## Identity and attribution

The new post is created by the **ModGlow Devvit app account**, not by the individual moderator who clicked the action. Devvit does not provide a generic subreddit account identity such as `u/<subreddit>` for app posts. The image identifies the moderation team as the curator and the original commenter as the author of the quoted content. The post body also links to the source discussion.

## Failure handling

- If validation, rendering, media upload, post submission, distinction, pinning, or verification fails, the original comment remains unchanged.
- If a replacement post was created but the transaction did not complete, the app attempts to delete that incomplete post.
- A per comment Redis lock uses a WATCH transaction and a 180 second expiry. Release checks the unique lock token, preventing one request from deleting another request's lock.
- A Redis mapping prevents duplicate spotlight posts for the same source comment.
- Before rendering or uploading, the app checks the subreddit community highlights and stops if both highlight slots are occupied. A final pin failure still triggers rollback, and the original comment remains untouched.
- Comment deletion cleanup is idempotent, so repeated deletion events do not create additional side effects.

## Data handling

- Redis stores only the source comment ID to generated post ID mapping and short lived conversion locks.
- The app does not store the comment body, author profile URL, avatar, or other profile details in Redis.
- The comment text is processed only to render the requested image and publish the Reddit post.
- The generated image is uploaded to Reddit media hosting. Reddit's current media API does not expose a separate media asset deletion operation. When a source comment is deleted, ModGlow deletes the Reddit post that embeds the image and clears its own mapping.
- The app makes no external HTTP requests and does not use an external AI service.

## Visual design

The image is a bespoke editorial spotlight card with a dark blue canvas, warm paper panel, community archive label, selected commenter attribution, and a source reference note. It is not designed to impersonate a native Reddit comment. IBM Plex Sans is used for Latin text, with Noto Sans Malayalam and Noto Sans Tamil bundled for those scripts.

The image is static. Its text, timestamp, and attribution do not update after publishing. Comments longer than 2,600 characters or 38 rendered lines are rejected rather than silently clipped.

## Brand and listing assets

The `assets/branding/` directory contains the ModGlow visual identity and marketing exports. The Devvit profile icon is configured in `devvit.json` as `assets/modglow-icon.png` (1024 × 1024 PNG). The editable SVG masters, banner artwork, wordmarks, sample spotlight card, and portrait promotional panels are included in that directory.

The portrait promotional panels are marketing illustrations, **not genuine screenshots of the running app**. If the App Directory submission asks for product screenshots, capture real screens from a Devvit playtest and use synthetic example content. Do not submit promotional illustrations as actual UI screenshots.

See `assets/branding/BRAND-GUIDE.md` and `assets/branding/UPLOAD-CHECKLIST.md` for dimensions, colors, file purposes, and upload guidance.

## Requirements

- Node.js **24.18.0 or newer**
- npm
- Reddit Developer Platform account
- A test subreddit where you have moderator permissions
- A free sticky slot for the generated post

## Local setup

```bash
npm install
npx devvit login
npx devvit whoami
npm run check
```

## Playtest

Use a test subreddit first:

```bash
npm run dev
```

Create a test comment and open its comment menu as a moderator. Confirm the permission attestation, publish the highlight, and verify that:

- The post author is the ModGlow app account.
- The image credits the original commenter.
- The post is moderator distinguished and pinned.
- The original comment remains visible and unchanged after featuring.
- The separate Remove comment action removes the selected comment only after confirmation.
- Removing or deleting the source comment causes the associated spotlight post to be removed by the deletion trigger.
- Ordinary non moderators cannot access or complete the action.

Also test a moderator without post permissions, a removed comment, a deleted author, long content, non Latin scripts, occupied sticky slots, duplicate requests, and simulated upload or pin failures.

## Feature request locking

Feature publication uses a per comment Redis lock to prevent concurrent duplicate posts. Locks use a versioned namespace and a 45 second expiry. The expiry is shorter than the previous 180 second lease and allows recovery when a Devvit Web request is terminated at its 30 second request limit before cleanup can run. A lock contention message means another request is active or a previous request timed out; it does not mean a spotlight post was successfully created. The persistent source to post mapping remains the authoritative duplicate check.

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

Create a new public repository named `modglow`, then push this project:

```bash
git init
git add .
git commit -m "Initial ModGlow Devvit moderator tool"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/modglow.git
git push -u origin main
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

- ModGlow creates an image post, not a native comment with a recoloured background.
- The post author is the Devvit app account, not the subreddit account and not the invoking moderator.
- The feature action leaves the original comment unchanged. A separate moderator removal action is available.
- If the original comment is deleted or removed, Reddit requires the related spotlight content to be removed too.
- Reddit supports two subreddit sticky slots. ModGlow will not replace an existing pinned post.
- Reddit app review is required before the app can be listed publicly for other moderators.

## License

ModGlow source code is MIT licensed. Third party assets and notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
