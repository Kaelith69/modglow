import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { forms } from './routes/forms.ts';
import { menu } from './routes/menu.ts';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
