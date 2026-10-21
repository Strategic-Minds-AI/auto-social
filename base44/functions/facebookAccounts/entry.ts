import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveBusiness } from '../../shared/access.ts';
import { listManagedPages } from '../../shared/facebook.ts';

// Facebook Page discovery and association.
//
// Page access tokens are never persisted or returned to the browser: this function
// exposes page identity only, and the publishing path re-derives a token on demand.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'discover');

    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getConnection('facebook_pages');
    } catch (error) {
      return Response.json(
        { error: `Facebook Pages is not connected: ${error.message}`, connected: false },
        { status: 200 }
      );
    }

    if (action === 'discover') {
      const { pages, businesses } = await listManagedPages(connection.accessToken);
      return Response.json({
        connected: true,
        pages,
        businesses,
        note: businesses.length
          ? ''
          : 'No Meta Business Manager was returned. If your Page is owned by a business portfolio, reconnect Facebook and select that business during consent.',
      });
    }

    if (action === 'list_for_business') {
      const resolved = await resolveBusiness(base44, body.business_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });

      const page = await base44.entities.SocialAccount.filter(
        { business_id: resolved.business.id },
        { sort: '-created_date', limit: 50 }
      );
      return Response.json({ accounts: page?.items || [] });
    }

    if (action === 'link') {
      const resolved = await resolveBusiness(base44, body.business_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });

      const pageId = String(body.page_id || '').trim();
      if (!pageId) return Response.json({ error: 'Choose a Facebook Page first.' }, { status: 400 });

      const { pages } = await listManagedPages(connection.accessToken);
      const match = pages.find((p) => p.id === pageId);
      if (!match) {
        return Response.json(
          { error: 'That Page is not available on the connected Facebook account. Re-select it after reconnecting.' },
          { status: 400 }
        );
      }
      if (!match.has_token) {
        return Response.json(
          { error: 'Facebook did not grant a publishing token for that Page. Reconnect and re-select the Page.' },
          { status: 400 }
        );
      }

      const existing = await base44.entities.SocialAccount.filter(
        { business_id: resolved.business.id, platform: 'facebook', external_id: pageId },
        { limit: 1 }
      );
      const current = (existing?.items || [])[0] || null;

      const fields = {
        business_id: resolved.business.id,
        platform: 'facebook',
        external_id: pageId,
        name: match.name,
        business_manager_id: match.business_id || '',
        business_manager_name: match.business_name || '',
        status: 'connected',
        last_verified_at: new Date().toISOString(),
      };

      const saved = current
        ? await base44.entities.SocialAccount.update(current.id, fields)
        : await base44.entities.SocialAccount.create(fields);

      return Response.json({ account: saved, existing: Boolean(current) });
    }

    if (action === 'unlink') {
      const accountId = String(body.account_id || '');
      const account = await base44.entities.SocialAccount.get(accountId).catch(() => null);
      if (!account) return Response.json({ error: 'That account is not available to you.' }, { status: 404 });

      const resolved = await resolveBusiness(base44, account.business_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });

      await base44.entities.SocialAccount.delete(accountId);
      return Response.json({ removed: true });
    }

    if (action === 'verify') {
      const resolved = await resolveBusiness(base44, body.business_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });

      const page = await base44.entities.SocialAccount.filter(
        { business_id: resolved.business.id, platform: 'facebook' },
        { limit: 50 }
      );

      const { pages } = await listManagedPages(connection.accessToken);
      const liveIds = new Set(pages.filter((p) => p.has_token).map((p) => p.id));

      const checked = [];
      for (const account of page?.items || []) {
        const status = liveIds.has(account.external_id) ? 'connected' : 'needs_reauth';
        const updated = await base44.entities.SocialAccount.update(account.id, {
          status,
          last_verified_at: new Date().toISOString(),
        });
        checked.push(updated);
      }
      return Response.json({ accounts: checked });
    }

    return Response.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}