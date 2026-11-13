import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { context, reddit, redis } from '@devvit/web/server';
import { isPostId, hasPostModerationPermission } from '../core/moderation.ts';
import { announcementMetadataKey, isCommentId, isManagedAnnouncementComment, type AnnouncementMetadata } from '../core/announcement.ts';

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


async function verifyCommentModerator(): Promise<boolean> {
  if (!context.userId || !context.subredditName) return false;
  const moderator = await reddit.getUserById(context.userId as `t2_${string}`);
  if (!moderator) return false;
  return hasPostModerationPermission(await moderator.getModPermissionsForSubreddit(context.subredditName));
}

async function loadManagedAnnouncement() {
  const commentId = context.commentId;
  if (!isCommentId(commentId) || !context.subredditName || !context.subredditId) return undefined;
  const comment = await reddit.getCommentById(commentId);
  const appUser = await reddit.getAppUser();
  if (!appUser?.id) return undefined;
  const stored = await redis.get(announcementMetadataKey(commentId));
  if (!stored) return undefined;
  let metadata: AnnouncementMetadata;
  try {
    metadata = JSON.parse(stored) as AnnouncementMetadata;
  } catch {
    return undefined;
  }
  if (!isManagedAnnouncementComment(comment, metadata, appUser.id, context.subredditName, context.subredditId)) {
    return undefined;
  }
  return { comment, metadata };
}

menu.post('/edit-announcement', async (c) => {
  try {
    const request = await c.req.json<MenuItemRequest>().catch(() => ({} as MenuItemRequest));
    if (!isCommentId(context.commentId) || (request?.targetId && request.targetId !== context.commentId)) {
      return c.json<UiResponse>({ showToast: 'Open this action on a ModGlow announcement comment.' });
    }
    if (!(await verifyCommentModerator())) {
      return c.json<UiResponse>({ showToast: 'Moderator permission required.' });
    }
    const managed = await loadManagedAnnouncement();
    if (!managed) {
      return c.json<UiResponse>({ showToast: 'This is not a verified, editable ModGlow announcement.' });
    }
    return c.json<UiResponse>({
      showForm: {
        name: 'editAnnouncement',
        form: {
          title: 'Edit ModGlow announcement',
          description: 'Update this announcement. The existing comment, pin and moderator distinction are preserved.',
          fields: announcementFields(),
          acceptLabel: 'Save changes',
          cancelLabel: 'Cancel',
        },
        data: {
          flair: [managed.metadata.flair],
          announcement: managed.metadata.announcement,
          bodyBelowSvg: managed.metadata.bodyBelowSvg,
        },
      },
    });
  } catch (error) {
    console.error('[ModGlow] Could not open announcement editor.', error);
    return c.json<UiResponse>({ showToast: 'Could not load this announcement.' });
  }
});

menu.post('/delete-announcement', async (c) => {
  try {
    const request = await c.req.json<MenuItemRequest>().catch(() => ({} as MenuItemRequest));
    if (!isCommentId(context.commentId) || (request?.targetId && request.targetId !== context.commentId)) {
      return c.json<UiResponse>({ showToast: 'Open this action on a ModGlow announcement comment.' });
    }
    if (!(await verifyCommentModerator())) {
      return c.json<UiResponse>({ showToast: 'Moderator permission required.' });
    }
    const managed = await loadManagedAnnouncement();
    if (!managed) {
      return c.json<UiResponse>({ showToast: 'This is not a verified ModGlow announcement.' });
    }
    const preview = managed.metadata.announcement.replace(/\\s+/gu, ' ').slice(0, 100);
    return c.json<UiResponse>({
      showForm: {
        name: 'deleteAnnouncement',
        form: {
          title: 'Delete ModGlow announcement?',
          description: `This permanently deletes the existing comment from Reddit. “${preview}${managed.metadata.announcement.length > 100 ? '…' : ''}”`,
          fields: [{
            name: 'confirmDelete',
            label: 'I understand this permanently deletes the comment.',
            type: 'boolean',
            defaultValue: false,
          }],
          acceptLabel: 'Delete permanently',
          cancelLabel: 'Cancel',
        },
      },
    });
  } catch (error) {
    console.error('[ModGlow] Could not open announcement deletion confirmation.', error);
    return c.json<UiResponse>({ showToast: 'Could not verify this announcement.' });
  }
});
