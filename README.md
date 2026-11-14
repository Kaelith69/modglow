# ModGlow

ModGlow is a moderator tool for creating clear, branded announcement comments in a subreddit. It turns a moderator's message into an announcement image and, if selected, adds the full message as formatted Reddit text below the image.

It is useful for community rules updates, event announcements, reminders, important notices, and other information moderators want to make easy to spot.

ModGlow is available only to moderators with permission to manage posts. A moderator must open the composer and choose to publish each announcement. ModGlow does not publish announcements automatically.

## What moderators can do

- Create an announcement as a top level comment on a selected post.
- Choose one of four announcement styles: **IMPORTANT**, **NOTICE**, **REMINDER**, or **ANNOUNCEMENT**.
- Put the full message in Reddit's native formatted text below the image, or place a shorter message inside the image.
- Use Markdown for headings, paragraphs, lists, quotes, emphasis, strikethrough, code, and links where supported.
- Choose whether ordinary text is bold by default. This option is on by default. Turn it off when you want ordinary Markdown text to keep its normal weight. Explicit Markdown formatting still works in either mode.
- Optionally add a link to the subreddit's rules.
- Edit a supported ModGlow announcement in place.
- Permanently delete a supported ModGlow announcement after confirming the action.

Every published announcement is one comment. The image appears first. When the separate text option is enabled, the message follows underneath in the same comment. ModGlow publishes the comment from the **ModGlow app account**, marks it as a moderator comment, and pins it. It does not create a new Reddit post or publish as the moderator who opened the form.

## How to create an announcement

1. Open a post in a subreddit where ModGlow is installed.
2. Open the post's moderator menu.
3. Select **Create ModGlow announcement**.
4. Choose an announcement style.
5. Enter your announcement text. Markdown is supported.
6. Choose how the text should appear, using the options below.
7. Review the content and select **Publish**.

ModGlow checks that the person submitting the form has permission to manage posts in that subreddit. It also checks that the selected post belongs to the current subreddit and can receive a new comment.

### Text and formatting options

**Publish Markdown below the image** is on by default.

- **On:** The image contains the announcement title design. Your full message appears below it as Reddit formatted text. This is the recommended option for longer announcements. The text limit is 9,000 grapheme clusters.
- **Off:** The message is rendered inside the image. This is intended for shorter announcements. The text limit is 2,600 grapheme clusters, and the layout must fit within 24 rendered lines.

**Bold ordinary text by default** is on by default.

- **On:** Ordinary text is bold. Explicit Markdown styles are preserved.
- **Off:** Ordinary text uses normal weight. Explicit Markdown styles are still parsed and displayed.

If you are writing Markdown with intentional mixed formatting, turn the default bold option off to avoid adding bold to ordinary text.

**Include a link to subreddit rules** is optional and off by default. When enabled, ModGlow adds a clickable link to the current subreddit's rules.

### Markdown examples

Use Markdown directly in the announcement field:

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

ModGlow supports headings, paragraphs, ordered and unordered lists, blockquotes, horizontal rules, bold, italic, strikethrough, inline code, fenced code blocks, and HTTP or HTTPS links in the separate text layout. Markdown images are shown as their alt text. ModGlow does not download or embed images from external Markdown image links. Raw HTML is not interpreted. Markdown tables and nested or indented lists are not converted into native structured blocks.

The image only layout is designed for shorter text. Links appear as readable labels in that image and are not clickable there.

## Editing and deleting announcements

To edit an announcement:

1. Open the ModGlow announcement comment.
2. Open its comment menu.
3. Select **Edit ModGlow announcement**.
4. Update the content or options and save.

Editing updates the existing comment rather than creating a second announcement. ModGlow checks that the comment belongs to the app and matches its saved announcement record before allowing changes.

To delete an announcement, select **Delete ModGlow announcement** from the comment menu and confirm the permanent deletion. This removes the app authored comment and its saved management record.

Only announcements with valid ModGlow management records can be edited or deleted this way. Older comments without those records are left untouched.

## Important notes for moderators

- Publishing is a manual moderator action. Check the text, links, and selected post before publishing.
- Published comments are visible according to the subreddit's normal Reddit access and moderation settings.
- Deleting an announcement is permanent.
- If Reddit reports an uncertain publishing or pinning result, ModGlow may ask you to check the post before trying again. Check first to avoid creating a duplicate.
- ModGlow cannot guarantee that Reddit will always be available or that every publish, edit, pin, or delete request will succeed.
- Use the tool in line with Reddit's rules and your community's moderation policies.

## Data and privacy

ModGlow uses Reddit's Devvit services to publish comments, upload announcement images to Reddit media hosting, check moderator permissions, and store the information needed to manage announcements.

The app stores the announcement text and settings, the subreddit and post identifiers, the app authored comment identifier, the app account identifier, and the uploaded media URL in Devvit Redis. It does not use an external analytics service, advertising tracker, or external HTTP Fetch service.

Read the [Privacy Policy](PRIVACY.md) and [Terms of Service](TERMS.md) for details.

## Installation and development

Moderators can install ModGlow after it has been approved and made available through Reddit. Public App Directory listing is subject to Reddit's review and approval.

For developers working with this repository:

1. Install Node.js 24 or later.
2. Install dependencies with `npm ci`.
3. Sign in to Devvit with `npx devvit login`.
4. Run `npm run check` to run type checking, tests, linting, and the production build.
5. Use `npm run dev` to start a Devvit playtest.

To upload a development build, run `npm run deploy`. To submit a public listing for Reddit review, run `npx devvit publish --public` after the app is ready and the listing details have been checked. Publishing submits the app for review; it does not guarantee approval or immediate directory availability.

See [Reddit's launch guide](https://developers.reddit.com/docs/guides/launch/launch-guide) and [Devvit Rules](https://developers.reddit.com/docs/devvit_rules) before submitting.

## Support

Report a bug or request help through [GitHub Issues](https://github.com/Kaelith69/modglow/issues). Please do not include passwords, private messages, personal information, or other sensitive account data in an issue.

## Project information

- Platform: Reddit Developer Platform (Devvit)
- App name: ModGlow
- Source code license: [MIT](LICENSE)
- Third party components: [Third party notices](THIRD_PARTY_NOTICES.md)
- [Changelog](CHANGELOG.md)
