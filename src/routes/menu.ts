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
    helpText: 'Each flair keeps its own colour palette, title artwork, and layout.',
  },
  {
    name: 'bodyBelowSvg',
    label: 'Publish Markdown below the SVG',
    type: 'boolean',
    defaultValue: false,
    helpText: 'Off: keep the announcement inside the SVG. On: publish the SVG title first, followed by the full Markdown body as native Reddit text.',
  },
  {
    name: 'announcement',
    label: 'Announcement text (Markdown supported)',
    type: 'paragraph',
    required: true,
    placeholder: '## Important update\n\nWrite your announcement here. Use # headings, - bullets, 1. numbered lists, **bold**, *italic*, > quotes, `code`, and [links](https://example.com).',
    helpText: 'Short announcements can stay inside the SVG. Enable the option above for longer content and full native Reddit formatting. Supports headings, bold, italic, strikethrough, links, lists, quotes, and code blocks.',
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
        description: 'Choose a flair, write in Markdown, and choose whether the body stays inside the SVG or appears below the SVG as native Reddit text. The SVG title is always first.',
        fields: announcementFields(),
        acceptLabel: 'Generate and pin comment',
        cancelLabel: 'Cancel',
      },
    },
  });
});
