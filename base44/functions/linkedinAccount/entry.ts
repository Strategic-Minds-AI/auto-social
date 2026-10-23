import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveBusiness } from '../../shared/access.ts';
import { linkedinProfile } from '../../shared/linkedin.ts';

// LinkedIn account discovery and association.
//
// LinkedIn is authorized once, as the connected member, so discovery reads that
// member back from the connector and linking associates them with a business. The
// access token stays in the backend and is never returned.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'discover');

    let connection;
    try {
      connection = await base44.asServiceRole.connectors.getConnection('linkedin');
    } catch (error) {
      return Response.json(
        { error: `LinkedIn is not connected: ${error.message}`, connected: false },
        { status: 200 }
      );
    }

    let profile;
    try {
      profile = await linkedinProfile(connection.accessToken);
    } catch (error) {
      return Response.json({ error: `LinkedIn could not be read: ${error.message}`, connected: false }, { status: 200 });
    }

    if (!profile?.author_urn) {
      return Response.json({ error: 'LinkedIn did not return an account.', connected: false }, { status: 200 });
    }

    const name = profile.name || 'LinkedIn account';

    if (action === 'discover') {
      return Response.json({ connected: true, account: { id: profile.id, name, picture: profile.picture } });
    }

    if (action === 'link') {
      const resolved = await resolveBusiness(base44, body.business_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });

      const existing = await base44.entities.SocialAccount.filter(
        { business_id: resolved.business.id, platform: 'linkedin', external_id: profile.author_urn },
        { limit: 1 }
      );
      const current = (existing?.items || [])[0] || null;

      const fields = {
        business_id: resolved.business.id,
        platform: 'linkedin',
        external_id: profile.author_urn,
        name,
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

      const accounts = await base44.entities.SocialAccount.filter(
        { business_id: resolved.business.id, platform: 'linkedin' },
        { limit: 50 }
      );

      const checked = [];
      for (const account of accounts?.items || []) {
        const status = account.external_id === profile.author_urn ? 'connected' : 'needs_reauth';
        checked.push(
          await base44.entities.SocialAccount.update(account.id, {
            status,
            last_verified_at: new Date().toISOString(),
          })
        );
      }
      return Response.json({ accounts: checked });
    }

    return Response.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}