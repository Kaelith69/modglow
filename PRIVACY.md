# ModGlow Privacy Policy

**Effective date: 14 November 2026**

This policy explains what information ModGlow uses, why it uses it, and where that information is stored.

ModGlow is a moderator tool that runs on Reddit's Developer Platform (Devvit). It uses Reddit services to check moderator permissions, publish announcement comments, upload announcement images, and save the information needed to manage those announcements.

## 1. Information ModGlow processes

When a moderator opens or uses ModGlow, the app receives information from Reddit's Devvit context and APIs. Depending on the action, this can include:

- The current subreddit name and subreddit ID.
- The selected post ID and, when managing an announcement, its comment ID.
- The invoking moderator's Reddit user ID for a permission check. ModGlow does not save this invoking moderator ID in its announcement record.
- The ModGlow app account ID, used to verify that a comment belongs to the app.
- The announcement text, selected style, and formatting options.
- The uploaded announcement image URL.

The announcement options include the selected flair, whether the Markdown body appears below the image, whether ordinary text is bold by default, and whether a subreddit rules link is included.

## 2. Why this information is used

ModGlow uses this information only to:

- Confirm that the person using the app has permission to manage posts.
- Confirm that the selected post belongs to the current subreddit.
- Create the announcement image and publish the announcement comment.
- Distinguish the app's comment as a moderator comment and pin it.
- Find and verify an existing ModGlow announcement before editing or deleting it.
- Restore the announcement's original text and settings when a moderator edits it.
- Prevent duplicate submissions while a publish, edit, or delete operation is in progress.

## 3. Where information is stored

**Reddit content:** When you publish an announcement, its image and text are submitted to Reddit as a comment from the ModGlow app account. Reddit hosts and processes that content under Reddit's own terms and privacy policy.

**Reddit media hosting:** ModGlow uploads the generated announcement image using Devvit's media service. The resulting media URL is saved with the announcement record.

**Devvit Redis:** ModGlow saves a small management record in the app's Redis storage. It contains the announcement text and settings, comment ID, post ID, subreddit name and ID, ModGlow app account ID, and uploaded media URL. This lets the app verify ownership and restore the announcement when it is edited.

**Temporary operation lock:** ModGlow uses a short lived Redis lock while an announcement action is being processed. The lock expires after 45 seconds.

## 4. Sharing

ModGlow does not send announcement data to an external analytics provider, advertising network, data broker, or external HTTP Fetch service. The app does not sell announcement data.

Information is processed by Reddit and its Devvit services to provide the app's functionality. Reddit's handling of information is governed by Reddit's own policies.

## 5. Retention and deletion

The management record is kept in Devvit Redis so that a published announcement can be edited or deleted later. ModGlow does not set an automatic expiry on that announcement record.

When a moderator deletes a managed announcement using ModGlow, the app deletes the Reddit comment and removes its associated Redis management record.

If a comment is removed outside ModGlow, the app does not currently guarantee that its Redis management record is automatically removed. Reddit controls the retention of content stored on Reddit and its media services.

Temporary operation locks expire automatically after 45 seconds.

## 6. Security

ModGlow uses Reddit's permission checks and verifies the app author, comment, post, and subreddit identifiers before allowing management actions. It stores announcement management data in Devvit Redis and does not ask users for Reddit passwords or access tokens.

No online service can guarantee absolute security. If you believe there is a security issue, report it through the support link below without including secrets or private user data.

## 7. Children's privacy

ModGlow is a moderator tool, not a service designed for children. It does not ask users to submit personal profiles or personal information.

## 8. Your choices

You choose whether to publish an announcement and what content to include. You can edit or delete a supported announcement through its ModGlow comment menu, subject to the app's ownership checks and Reddit's available functionality.

For questions about information held by Reddit, use Reddit's own privacy and account controls. ModGlow maintainers cannot change Reddit's platform retention or account records.

## 9. Changes to this policy

This policy may be updated when ModGlow's features or data practices change. The latest version will be available in this repository.

## 10. Contact

For privacy questions or app support, contact the project through:

https://github.com/Kaelith69/modglow/issues

Please do not include passwords, access tokens, private messages, or sensitive personal information in a public issue.
