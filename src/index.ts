import { claim } from './claim.ts';
import type { QbEnv } from './quickbooks/env.ts';
import { oauthRoute } from './quickbooks/oauth.ts';
import { webhook } from './quickbooks/inbox.ts';
import { runScheduled } from './quickbooks/jobs.ts';
import { HttpError, json } from './http.ts';
import { adminRoute } from './admin/route.ts';

export default {
  async fetch(request: Request, env: QbEnv): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/api/claim') {
        if (request.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);
        return await claim(request, env);
      }
      if (path === '/api/quickbooks/webhook') {
        return await webhook(request,env);
      }
      if (path.startsWith('/api/admin/')) return await adminRoute(request,env);
      if (path.startsWith('/api/quickbooks/')) return await oauthRoute(request,env);
      return json({ success: false, error: 'NOT_FOUND' }, 404);
    } catch (error) {
      if (error instanceof HttpError) return json({ success: false, error: error.code, message: error.message }, error.status);
      // Never serialize D1/SDK exceptions, bodies, query parameters or contacts.
      return json({ success: false, error: 'SAVE_FAILED', message: 'We could not save your details. Please try again.' }, 503);
    }
  },
  async scheduled(_event: ScheduledController, env: QbEnv): Promise<void> {
    try { await runScheduled(env); }
    catch { console.warn(JSON.stringify({event:'quickbooks_schedule_failed'})); }
  }
} satisfies ExportedHandler<QbEnv>;
