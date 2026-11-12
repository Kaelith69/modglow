import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { context } from '@devvit/web/server';
import { isCommentId } from '../core/moderation.ts';

export const menu = new Hono();

const permissionFields = (): FormField[] => [
  {
    name: 'permissionConfirmed',
    label: 'I confirm that the comment author has explicitly permitted this comment to be featured in a public image post, including their username and a link to the original discussion.',
    type: 'boolean',
    defaultValue: false,
    helpText: 'The original comment will remain unchanged. Reddit requires the spotlight post to be removed if the source comment is later deleted or removed.',
  },
];

menu.post('/feature-comment', async (c) => {
  const request = await c.req.json<MenuItemRequest>().catch(() => ({} as MenuItemRequest));
  const commentId = context.commentId;

  if (!isCommentId(commentId) || (request.targetId && request.targetId !== commentId) || !context.userId || !context.subredditName) {
    return c.json<UiResponse>({
      showToast: 'Open this action from a comment in a subreddit you moderate.',
    });
  }

  return c.json<UiResponse>({
    showForm: {
      name: 'featureComment',
      form: {
        title: 'Feature this comment',
        description: 'Create an attributed community spotlight image. The original comment will remain unchanged.',
        fields: permissionFields(),
        acceptLabel: 'Publish and pin highlight',
        cancelLabel: 'Cancel',
      },
    },
  });
});


menu.post('/remove-comment', async (c) => {
  const request = await c.req.json<MenuItemRequest>().catch(() => ({} as MenuItemRequest));
  const commentId = context.commentId;

  if (!isCommentId(commentId) || (request.targetId && request.targetId !== commentId) || !context.userId || !context.subredditName) {
    return c.json<UiResponse>({
      showToast: 'Open this action from a comment in a subreddit you moderate.',
    });
  }

  return c.json<UiResponse>({
    showForm: {
      name: 'removeComment',
      form: {
        title: 'Remove this comment?',
        description: 'This uses Reddit’s moderator removal action. It does not hard delete another person’s comment. If this comment has a ModGlow feature post, Reddit’s deletion rules require that copied spotlight post to be removed too.',
        fields: [
          {
            name: 'confirmRemoval',
            label: 'I understand this will remove the selected comment from the subreddit.',
            type: 'boolean',
            defaultValue: false,
          },
        ],
        acceptLabel: 'Remove comment',
        cancelLabel: 'Cancel',
      },
    },
  });
});
