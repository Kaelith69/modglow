import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { context } from '@devvit/web/server';
import { isPostId } from '../core/moderation.ts';

export const menu = new Hono();

const announcementFields = (): FormField[] => [
  {
    name: 'flair',
    label: 'Announcement flair',
    type: 'select',
    options: [
      { label: 'IMPORTANT', value: 'IMPORTANT' },
      { label: 'NOTICE', value: 'NOTICE' },
      { label: 'REMINDER', value: 'REMINDER' },
      { label: 'ANNOUNCEMENT', value: 'ANNOUNCEMENT' },
    ],
    defaultValue: ['ANNOUNCEMENT'],
    multiSelect: false,
    required: true,
    helpText: 'Each flair has its own design.',
  },
  {
    name: 'bodyBelowSvg',
    label: 'Publish Markdown below the SVG',
    type: 'boolean',
    defaultValue: false,
    helpText: 'Adds Markdown text below the SVG.',
  },
  {
    name: 'announcement',
    label: 'Announcement text',
    type: 'paragraph',
    required: true,
    placeholder: '## Announcement\n\nWrite your announcement here. Markdown supported.',
    helpText: 'Markdown is supported. Text below the SVG is always bold.',
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
      showToast: 'Open ModGlow from a moderator post.',
    });
  }

  return c.json<UiResponse>({
    showForm: {
      name: 'createAnnouncement',
      form: {
        title: 'ModGlow announcement',
        description: 'Choose a flair and write your announcement.',
        fields: announcementFields(),
        acceptLabel: 'Publish',
        cancelLabel: 'Cancel',
      },
    },
  });
});
