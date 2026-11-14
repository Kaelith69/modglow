# ModGlow

ModGlow is a moderator only announcement tool for Reddit communities. It helps moderators turn important community messages into branded announcement comments that are easy to notice and read.

A moderator opens the composer from a post's moderator menu, chooses an announcement style, writes a message with Markdown, reviews the result, and chooses whether to publish. ModGlow creates one top level comment on that post. The comment contains a generated announcement image and, optionally, the full message as Reddit formatted text below the image.

ModGlow is intended for subreddit moderators who need to communicate rule changes, community notices, event information, reminders, and other important updates. It is not a general purpose posting tool. Only moderators with permission to manage posts can create, edit, or delete ModGlow announcements. Every publication is a deliberate moderator action. ModGlow does not publish announcements automatically.

**Important publishing behavior:** the announcement comment is authored by the ModGlow app account, marked as a moderator comment, and pinned. It is not authored by the individual moderator who opened the composer. Each announcement is one comment, not a new Reddit post.

## Features

- **Four announcement styles:** IMPORTANT, NOTICE, REMINDER, and ANNOUNCEMENT.
- **Two message layouts:** show the full Markdown message below the image, or render the message inside the image for shorter announcements.
- **Markdown formatting:** headings, paragraphs, ordered and unordered lists, blockquotes, horizontal rules, bold, italic, strikethrough, inline code, fenced code blocks, and HTTP or HTTPS links in the separate text layout.
- **Typography control:** choose whether ordinary text is bold by default. Explicit Markdown formatting remains supported either way.
- **Subreddit rules link:** optionally add a clickable link to the current subreddit's rules.
- **Edit existing announcements:** update a supported ModGlow announcement in place rather than creating another comment.
- **Delete announcements:** permanently remove a supported ModGlow announcement after confirmation.
- **Moderator permission checks:** verify the submitting moderator can manage posts and that the selected post belongs to the current subreddit and can receive a comment.
- **Duplicate protection:** saved announcement records are checked before edits and deletes. When a publish or pin result is uncertain, moderators are asked to check the post before retrying.

## Create an announcement

1. Open a post in a subreddit where ModGlow is installed.
2. Open the post's moderator menu.
3. Select **Create ModGlow announcement**.
4. Choose IMPORTANT, NOTICE, REMINDER, or ANNOUNCEMENT.
5. Write the announcement. Markdown is supported.
6. Choose the message layout and formatting options.
7. Review the content and select **Publish**.

ModGlow checks the moderator's permission to manage posts. It also checks that the selected post belongs to the current subreddit and can receive a new comment.

### Message and formatting options

**Publish Markdown below the image** is on by default.

- **On:** the image displays the announcement title design and the full message appears below it as Reddit formatted text. This is recommended for longer announcements. The text limit is 9,000 grapheme clusters.
- **Off:** the message is rendered inside the image. This is intended for shorter announcements. The text limit is 2,600 grapheme clusters, and the layout must fit within 24 rendered lines.

**Bold ordinary text by default** is on by default.

- **On:** ordinary text is bold. Explicit Markdown styles are preserved.
- **Off:** ordinary text uses normal weight. Explicit Markdown styles are still parsed and displayed.

If your Markdown uses intentional mixed formatting, turn the default bold option off to avoid making ordinary text bold.

**Include a link to subreddit rules** is optional and off by default. When enabled, ModGlow adds a clickable link to the current subreddit's rules.

### Markdown example

Paste Markdown directly into the announcement field:

```md
# Community announcement

Please read the updated rules before posting.

**Important:** The changes take effect today.

*Be kind and keep discussions on topic.*

- First point
- Second point

1. First step
2. Second step

> A short quote or reminder.

~~Retired information~~

`inline code`

[Read the subreddit rules](https://www.reddit.com/r/YourSubreddit/about/rules)
```

Markdown images are shown as their alt text. ModGlow does not download or embed images from external Markdown image links. Raw HTML is not interpreted. Markdown tables and nested or indented lists are not converted into native structured blocks.

In image only mode, links are displayed as readable labels and are not clickable.

## Edit or delete an announcement

### Edit

1. Open the ModGlow announcement comment.
2. Open its comment menu.
3. Select **Edit ModGlow announcement**.
4. Change the content or options and save.

Editing updates the existing comment. ModGlow checks that the comment belongs to the app and matches its saved announcement record before allowing changes.

### Delete

1. Open the ModGlow announcement comment.
2. Open its comment menu.
3. Select **Delete ModGlow announcement**.
4. Confirm the permanent deletion.

This removes the app authored comment and its saved management record. Only announcements with valid ModGlow management records can be edited or deleted this way. Older comments without those records are left untouched.

## Important behavior and limitations

- Publishing is manual. Review the text, links, style, and selected post before publishing.
- The comment is posted by the ModGlow app account, not by the moderator's personal account.
- The comment is marked as a moderator comment and pinned.
- Published comments follow the subreddit's normal Reddit access and moderation settings.
- Deleting an announcement is permanent.
- If Reddit reports an uncertain publishing or pinning result, check the post before retrying to avoid a duplicate.
- ModGlow cannot guarantee that Reddit will always be available or that every publish, edit, pin, or delete request will succeed.
- Use ModGlow in accordance with Reddit's rules and the community's moderation policies.

## Data and privacy

ModGlow uses Reddit Devvit capabilities to publish comments, upload announcement images to Reddit media hosting, check moderator permissions, and store the information needed to manage announcements.

The app stores the announcement text and settings, subreddit and post identifiers, app authored comment identifier, app account identifier, and uploaded media URL in Devvit Redis. The invoking moderator's user ID is used for a permission check and is not included in the saved announcement metadata.

ModGlow does not currently use an external analytics service, advertising tracker, external HTTP Fetch service, payment service, or account linking. It does not request Reddit passwords or external account credentials.

Read the [Privacy Policy](PRIVACY.md), [Terms of Service](TERMS.md), and [Third Party Notices](THIRD_PARTY_NOTICES.md).

## Installation for moderators

ModGlow must be approved and made available through Reddit before other communities can install it from the App Directory.

After public approval:

1. Open Reddit's App Directory.
2. Find ModGlow.
3. Review the requested permissions and app information.
4. Install it in the subreddit you moderate.
5. Open a post and use the moderator menu to create an announcement.

Only moderators with permission to manage posts can use the announcement actions. Regular community members cannot create, edit, or delete announcements through ModGlow.

## Configuration

ModGlow's Reddit app configuration is maintained in `devvit.json`.

- **Reddit capability:** enabled with moderator scope.
- **Media capability:** enabled to upload generated announcement images to Reddit media hosting.
- **Redis capability:** enabled to store announcement management records.
- **Post menu action:** Create ModGlow announcement, restricted to moderators.
- **Comment menu actions:** Edit and Delete ModGlow announcement, restricted to moderators and filtered to the current app's comments.
- **App icon:** `assets/modglow-icon.png`.

ModGlow does not require moderators to configure external API keys, analytics services, or third party accounts.

## Development and deployment

### Requirements

- Node.js 24 or later. The project declares Node.js `>=24.18.0`.
- npm.
- A Reddit account connected to the Reddit Developer Platform.
- Access to this GitHub repository for repository maintenance and GitHub Actions configuration.

### Run locally

From the repository root:

```bash
npm ci
npx devvit login
npm run check
npm run dev
```

- `npm ci` installs the exact dependencies recorded in the lockfile.
- `npx devvit login` authenticates the developer with Reddit.
- `npm run check` runs TypeScript checking, unit tests, ESLint, and the production build.
- `npm run dev` starts a Devvit playtest.

### Upload a development build

```bash
npm run deploy
```

This runs the project checks and uploads a private Devvit build. Uploading is not the same as submitting a public App Directory release.

### GitHub Actions deployment

The repository includes `.github/workflows/deploy-devvit.yml`. It runs on pushes to `main` and can also be started manually. It installs dependencies, runs the project checks, uploads the app, and updates the development installation in `r/modglow_dev`.

The deployment workflow requires a GitHub Actions repository secret named **`DEVVIT_AUTH_TOKEN`**. Its value must be the complete Devvit CLI authentication token created by `npx devvit login`. Treat this token as a password. Never commit it to the repository, paste it into an issue, or expose it in workflow logs.

To configure the secret:

1. Run `npx devvit login` on a trusted developer machine using the Reddit account that owns or maintains ModGlow.
2. Locate the Devvit token file at `~/.devvit/token` on macOS or Linux, or `%USERPROFILE%\.devvit\token` on Windows.
3. Copy the complete token file contents.
4. In GitHub, open **Settings → Secrets and variables → Actions**.
5. Create a repository secret named `DEVVIT_AUTH_TOKEN` and paste the token contents as its value.

If the token is revoked or expires, sign in again and update the GitHub secret. Do not print the token in CI logs.

### Submit a public release through GitHub Actions

Public listing is a separate, intentional release operation. The repository includes `.github/workflows/publish-public.yml`, which is manually triggered from the GitHub Actions tab. It:

1. Requires an explicit confirmation input before proceeding.
2. Installs dependencies and runs `npm run check`.
3. Verifies that `DEVVIT_AUTH_TOKEN` is configured.
4. Runs `npx devvit publish --public --bump patch` to submit the app for public review.

To submit:

1. Confirm the README, Terms, Privacy Policy, app description, permissions, and data disclosures match the current app.
2. Confirm the `DEVVIT_AUTH_TOKEN` repository secret is configured.
3. Open **Actions → Publish ModGlow publicly** in this GitHub repository.
4. Select **Run workflow** on the `main` branch.
5. Set the confirmation input to **yes** and start the workflow.
6. Review the workflow run and follow any feedback from Reddit.

A successful workflow means the public submission command completed. It does **not** mean Reddit has approved the app or that ModGlow is already visible in the App Directory. Reddit reviews the app before public listing. Approval and directory availability are controlled by Reddit.

Do not trigger the public workflow for routine development uploads. Use the existing deployment workflow for development builds.

## Support

Report bugs or request help through [GitHub Issues](https://github.com/Kaelith69/modglow/issues). Do not include passwords, private messages, personal information, authentication tokens, or other sensitive account data in an issue.

## Project information

- **Platform:** Reddit Developer Platform (Devvit)
- **App name:** ModGlow
- **Source code license:** [MIT](LICENSE)
- **Third party components:** [Third Party Notices](THIRD_PARTY_NOTICES.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

## Official Reddit documentation

- [Launch your app](https://developers.reddit.com/docs/guides/launch/launch-guide)
- [Devvit CLI](https://developers.reddit.com/docs/guides/tools/devvit_cli)
- [Devvit Rules](https://developers.reddit.com/docs/devvit_rules)
