# Reddit App Submission Checklist

This checklist is for maintainers preparing ModGlow for Reddit's Devvit app review and App Directory.

## Public app description

Use or adapt this description in the Reddit Developer Portal:

> ModGlow helps subreddit moderators publish clear, branded announcement comments. Choose an announcement style, write a message with Markdown, and publish it as one pinned comment with an image and optional formatted text below it. Moderators can edit or permanently delete supported ModGlow announcements. Publishing is always a manual moderator action.

## README and policy links

The repository includes the documents Reddit asks app developers to prepare:

- [README](../README.md): moderator focused overview, use cases, feature instructions, limits, and developer setup.
- [Terms of Service](../TERMS.md): app use and moderator responsibilities.
- [Privacy Policy](../PRIVACY.md): information processed, Redis storage, Reddit media hosting, sharing, and retention.
- [Third party notices](../THIRD_PARTY_NOTICES.md): bundled third party components and their licenses.

Use these public URLs in the Developer Portal when policy links are requested:

- Terms: https://github.com/Kaelith69/modglow/blob/main/TERMS.md
- Privacy: https://github.com/Kaelith69/modglow/blob/main/PRIVACY.md
- README: https://github.com/Kaelith69/modglow/blob/main/README.md

The terms and privacy documents describe the current implementation. Recheck them whenever the app starts using a new external service, HTTP Fetch, analytics, or a new category of user information.

## Current capabilities and data practices

- The app is a moderator tool. Its menu actions are restricted to moderators and the server checks for post moderation permission.
- It creates one top level comment on the selected post.
- The comment is authored by the ModGlow app account, distinguished as a moderator, and pinned.
- It uses Reddit's Devvit Reddit, media, and Redis capabilities.
- It does not currently use HTTP Fetch, external APIs, external analytics, advertising trackers, payments, or account linking.
- Redis stores the announcement text and options, the comment and post IDs, subreddit name and ID, app account ID, and Reddit media URL.
- A moderator's invoking user ID is used for a permission check and is not included in the saved announcement metadata.
- The app does not request user passwords or external account credentials.

Do not claim that the app uses no data. It processes Reddit identifiers and saves announcement management records as described in the Privacy Policy.

## Before submitting

- [ ] Test on a sandbox subreddit.
- [ ] Test on Reddit desktop and mobile.
- [ ] Test with a moderator account that has post permissions.
- [ ] Confirm a regular user cannot use the moderator actions.
- [ ] Test all four announcement styles.
- [ ] Test image only mode and Markdown below image mode.
- [ ] Test default bold on and off, including explicit Markdown formatting.
- [ ] Test the optional subreddit rules link.
- [ ] Test editing an existing managed announcement.
- [ ] Test confirmed deletion of a managed announcement.
- [ ] Confirm an unrelated comment cannot be edited or deleted through ModGlow.
- [ ] Test a locked post and an archived or removed post.
- [ ] Check that uncertain publish or pin results do not cause an immediate duplicate announcement.
- [ ] Confirm README, Terms, Privacy Policy, app description, and data disclosures match the current implementation.
- [ ] Check Reddit's latest Devvit Rules and launch guide.

## Build and publish

From the repository root:

```bash
npm ci
npm run check
npx devvit login
npm run deploy
npx devvit publish --public
```

The public publish command submits the app for Reddit review and requests App Directory listing. Approval is not automatic. Follow any review feedback in the Developer Portal or from Reddit.

For an unlisted submission, use:

```bash
npx devvit publish
```

Do not use the public command if the app is intended only for selected communities.

## Official Reddit resources

- [Devvit Rules](https://developers.reddit.com/docs/devvit_rules)
- [Launch your app](https://developers.reddit.com/docs/guides/launch/launch-guide)
- [Devvit FAQ](https://developers.reddit.com/docs/guides/faq)
- [Reddit Developer Platform](https://developers.reddit.com/)
