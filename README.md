# ModGlow

**ModGlow is a moderator-only Reddit Devvit tool for publishing designed announcements as pinned image comments.** A moderator opens a post menu, writes an announcement in Markdown, and ModGlow renders it into a custom SVG, rasterises it to PNG, uploads it to Reddit media hosting, and publishes one top-level comment as the ModGlow app account.

## How it works

1. A moderator opens a Reddit post and selects **Create ModGlow announcement** from the post menu.
2. The moderator writes the announcement in a multiline Markdown field.
3. ModGlow renders the text into its branded image card.
4. The image is uploaded to Reddit media hosting and embedded in one top-level comment under the original post.
5. The comment is published as the **ModGlow app account**, distinguished as a moderator, and pinned.
6. ModGlow verifies that Reddit reports the comment as both moderator-distinguished and stickied.

ModGlow does not create a separate Reddit post, select or quote an existing comment, edit another user's content, or remove existing comments.

## Visual design

The announcement card uses a true AMOLED black canvas with a smoked charcoal surface, a restrained yellow haze, a neon yellow edge, and soft glow and text shadows. Body typography is intentionally larger than ordinary Reddit comment text for comfortable reading. Markdown emphasis such as **bold**, *italic*, and ***bold italic*** is retained by the SVG renderer. The card grows vertically with wrapped content and rejects text that would exceed its readability limits rather than clipping it.

The generated card uses the ModGlow identity and a moderator announcement label. It does not imitate Reddit's full comment interface or include voting and reply controls.

## Permissions and safety

- The post menu action is visible only to moderators.
- The server independently verifies the user's moderator permissions before publishing.
- The target post ID, subreddit name, and immutable subreddit ID are checked before content is generated.
- A short-lived Redis lock prevents simultaneous duplicate submissions for the same post.
- The app publishes exactly one top-level image comment per successful submission.
- The app calls the comment's moderator distinction method with sticky enabled, then fetches the comment again to verify both states.
- If pinning fails, ModGlow attempts to delete the incomplete app-authored comment rather than leave an unpinned announcement behind.
- The app does not store announcement text in Redis and makes no external HTTP or AI service requests.

## Requirements

- Node.js **24.18.0 or newer**
- npm
- Reddit Developer Platform account
- A test subreddit where you have moderator permissions

## Local setup

```bash
npm ci
npx devvit login
npx devvit whoami
npm run check
```

## Playtest

```bash
npm run dev
```

In a test subreddit, open a post as a moderator and select **Create ModGlow announcement**. Test Markdown formatting, long text, emoji, XML characters, Malayalam, Tamil, duplicate submissions, a moderator without post permissions, a removed post, media upload failure, comment submission failure, and pin failure.

Verify that:
- The comment appears directly under the selected post.
- The comment author is the ModGlow app account.
- The comment contains the generated image.
- Reddit marks the comment as moderator-distinguished and stickied.
- No separate post is created.
- No existing comment is edited, selected, or removed.

## Validation and publishing

```bash
npm run check
npm run deploy
```

For public distribution to moderators of other communities:

```bash
npx devvit publish --public
```

Public distribution requires Reddit approval. Review the current [launch guide](https://developers.reddit.com/docs/guides/launch/launch-guide) and [Devvit Rules](https://developers.reddit.com/docs/devvit_rules) before submission.

## GitHub

Repository: [Kaelith69/modglow](https://github.com/Kaelith69/modglow).

## License

ModGlow source code is MIT licensed. Third-party assets and notices are documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
