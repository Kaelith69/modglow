import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { context } from '@devvit/web/server';
import { isPostId } from '../core/moderation.ts';

export const menu = new Hono();

const announcementFields = (): FormField[] => [
  {
    name: 'announcement',
    label: 'Announcement (Markdown supported)',
    type: 'paragraph',
    required: true,
    placeholder: '## Important update\n\nWrite your announcement here. Use **bold**, *italic*, lists, and links.',
    helpText: 'This text is rendered into a ModGlow image and published as one top level comment by the ModGlow app. Keep formatting readable.',
  },
];

menu.post('/create-announcement', async (c) => {
  const request = await c.req.json<MenuItemRequest>().catch(() => ({} as MenuItemRequest));
  const postId = context.postId;

  if (
    !isPostId(postId)
    || (request?.targetId && request.targetId !== postId)
    || !context.userId
    || !context.subredditName
    || !context.subredditId
  ) {
    return c.json<UiResponse>({
      showToast: 'Open ModGlow from a post in a subreddit where you are a moderator.',
    });
  }

  return c.json<UiResponse>({
    showForm: {
      name: 'createAnnouncement',
      form: {
        title: 'Create a ModGlow announcement',
        description: 'Write the announcement in Markdown. ModGlow renders it as a smoked black, yellow neon image comment, posts it as the app, and pins it as a moderator comment.',
        fields: announcementFields(),
        acceptLabel: 'Generate and pin comment',
        cancelLabel: 'Cancel',
      },
    },
  });
});
