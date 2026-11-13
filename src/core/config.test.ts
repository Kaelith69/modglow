import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Devvit menu and form configuration match the implemented server routes', () => {
  const config = JSON.parse(read('../../devvit.json')) as {
    server: { dir: string; entry: string };
    menu: { items: Array<{ endpoint: string; location: string; forUserType: string }> };
    forms: Record<string, string>;
    permissions: {
      reddit: { enable: boolean; scope: string };
      media: boolean;
      redis: boolean;
    };
    marketingAssets: { icon: string };
  };

  const menuSource = read('../routes/menu.ts');
  const formsSource = read('../routes/forms.ts');
  const indexSource = read('../index.ts');

  assert.equal(config.server.dir, 'dist/server');
  assert.equal(config.server.entry, 'index.cjs');
  assert.equal(config.menu.items.length, 3);
  assert.equal(config.menu.items[0]?.endpoint, '/internal/menu/create-announcement');
  assert.equal(config.menu.items[0]?.location, 'post');
  assert.equal(config.menu.items[0]?.forUserType, 'moderator');
  assert.ok(config.menu.items.slice(1).every((item) => (item as { postFilter?: string }).postFilter === 'currentApp'));
  assert.match(menuSource, /name: 'includeRulesLink'/u);
  assert.match(menuSource, /defaultValue: true/u);
  assert.match(menuSource, /defaultValue: false/u);
  assert.deepEqual(config.menu.items.slice(1).map((item) => [item.endpoint, item.location, item.forUserType]), [
    ['/internal/menu/edit-announcement', 'comment', 'moderator'],
    ['/internal/menu/delete-announcement', 'comment', 'moderator'],
  ]);
  assert.equal(config.forms.editAnnouncement, '/internal/form/edit-announcement-submit');
  assert.equal(config.forms.deleteAnnouncement, '/internal/form/delete-announcement-submit');
  assert.ok(menuSource.includes("menu.post('/edit-announcement'"));
  assert.ok(menuSource.includes("menu.post('/delete-announcement'"));
  assert.ok(formsSource.includes("forms.post('/edit-announcement-submit'"));
  assert.ok(formsSource.includes("forms.post('/delete-announcement-submit'"));
  assert.ok(formsSource.includes('comment.edit({ richtext })'));
  assert.ok(formsSource.includes('comment.delete()'));
  assert.ok(formsSource.includes('isDeleteConfirmed(values)'));
  assert.ok(formsSource.includes('announcementMetadataKey(publishedComment.id)'));
  assert.equal(config.forms.createAnnouncement, '/internal/form/create-announcement-submit');
  assert.match(menuSource, /menu\.post\('\/create-announcement'/u);
  assert.match(formsSource, /forms\.post\('\/create-announcement-submit'/u);
  assert.match(menuSource, /name: 'bodyBelowSvg'/u);
  assert.match(menuSource, /type: 'boolean'/u);
  assert.match(menuSource, /defaultValue: false/u);
  assert.match(menuSource, /name: 'announcement'/u);
  assert.match(formsSource, /bodyBelowSvg\?: boolean/u);
  assert.match(formsSource, /values\?\.bodyBelowSvg === true/u);
  assert.match(formsSource, /bodyBelowSvg\s*\?\s*buildAnnouncementHeaderSvg/u);
  assert.match(indexSource, /internal\.route\('\/menu', menu\)/u);
  assert.match(indexSource, /internal\.route\('\/form', forms\)/u);

  assert.equal(config.permissions.reddit.enable, true);
  assert.equal(config.permissions.reddit.scope, 'moderator');
  assert.equal(config.permissions.media, true);
  assert.equal(config.permissions.redis, true);
  assert.ok(existsSync(new URL('../../' + config.marketingAssets.icon, import.meta.url)));
});

test('maintained SVG samples and layout audit match both rendering modes', () => {
  const embedded = read('../../assets/branding/svg/announcement-card-sample.svg');
  const titleOnly = read('../../assets/branding/svg/announcement-title-only-sample.svg');
  const audit = JSON.parse(read('../../assets/branding/LAYOUT-AUDIT.json')) as {
    canvas_sizes: {
      announcement_card_reference: number[];
      announcement_title_only: number[];
    };
    templates: { ANNOUNCEMENT: { title_text_length: number } };
    typography: { svg_font_family: string; bundled_raster_fallback: string };
    separate_body_layout: { title_svg_size: number[]; body_max_characters: number };
  };

  assert.match(embedded, /width="2000" height="760" viewBox="0 0 2000 760"/u);
  assert.match(embedded, /font-family="Arial, Helvetica, sans-serif"/u);
  assert.match(embedded, /textLength="1100"/u);
  assert.match(embedded, /Please follow the sub rules no religion or/u);
  assert.match(titleOnly, /width="2000" height="600" viewBox="0 0 2000 600"/u);
  assert.match(titleOnly, /textLength="1100"/u);
  assert.doesNotMatch(titleOnly, /x="195" y="475"/u);

  assert.deepEqual(audit.canvas_sizes.announcement_card_reference, [2000, 760]);
  assert.deepEqual(audit.canvas_sizes.announcement_title_only, [2000, 600]);
  assert.deepEqual(audit.separate_body_layout.title_svg_size, [2000, 600]);
  assert.equal(audit.separate_body_layout.body_max_characters, 9000);
  assert.equal(audit.templates.ANNOUNCEMENT.title_text_length, 1100);
  assert.equal(audit.typography.svg_font_family, 'Arial, Helvetica, sans-serif');
  assert.equal(audit.typography.bundled_raster_fallback, 'IBM Plex Sans');
});
