import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Link2, Loader2, RefreshCw, Unlink, CheckCircle2, AlertTriangle, Info, Facebook, Instagram } from 'lucide-react';
import { statusLabel } from '@/components/scheduling/StatusBadge';
import { cn } from '@/lib/utils';

// Platforms with no authorized integration yet. Shown as an explicit unavailable
// state rather than hidden, so nobody assumes publishing works there.
const UNAVAILABLE = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'tiktok', label: 'TikTok' },
];

export default function SocialAccounts() {
  const { business, ready } = useActiveBusiness();
  const { toast } = useToast();
  const [pages, setPages] = useState([]);
  const [linked, setLinked] = useState([]);
  const [note, setNote] = useState('');
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [igAccount, setIgAccount] = useState(null);
  const [igNote, setIgNote] = useState('');
  const [igLoading, setIgLoading] = useState(true);

  const loadLinked = useCallback(async () => {
    if (!business) {
      setLinked([]);
      return;
    }
    const res = await base44.functions.invoke('facebookAccounts', {
      action: 'list_for_business',
      business_id: business.id,
    });
    setLinked(res.data?.accounts || []);
  }, [business]);

  const discover = useCallback(async () => {
    setLoading(true);
    const res = await base44.functions.invoke('facebookAccounts', { action: 'discover' });
    setPages(res.data?.pages || []);
    setNote(res.data?.note || '');
    setConnected(res.data?.connected !== false);
    setLoading(false);
  }, []);

  const discoverInstagram = useCallback(async () => {
    setIgLoading(true);
    const res = await base44.functions.invoke('instagramAccount', { action: 'discover' });
    setIgAccount(res.data?.account || null);
    setIgNote(res.data?.connected === false ? res.data.error || 'Instagram is not connected.' : '');
    setIgLoading(false);
  }, []);

  useEffect(() => { discover(); }, [discover]);
  useEffect(() => { loadLinked(); }, [loadLinked]);
  useEffect(() => { discoverInstagram(); }, [discoverInstagram]);

  const link = async (page) => {
    setBusy(page.id);
    try {
      await base44.functions.invoke('facebookAccounts', {
        action: 'link',
        business_id: business.id,
        page_id: page.id,
      });
      toast({ title: `${page.name} linked`, description: 'Scheduled posts can now publish to this Page.' });
      await loadLinked();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not link that Page',
        description: err?.response?.data?.error || err.message,
      });
    } finally {
      setBusy('');
    }
  };

  const unlink = async (account) => {
    setBusy(account.id);
    try {
      await base44.functions.invoke('facebookAccounts', { action: 'unlink', account_id: account.id });
      await loadLinked();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not unlink', description: err?.response?.data?.error || err.message });
    } finally {
      setBusy('');
    }
  };

  const linkInstagram = async () => {
    setBusy('ig-link');
    try {
      await base44.functions.invoke('instagramAccount', { action: 'link', business_id: business.id });
      toast({ title: 'Instagram linked', description: 'Cleared Reels can now publish to this account.' });
      await loadLinked();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not link Instagram',
        description: err?.response?.data?.error || err.message,
      });
    } finally {
      setBusy('');
    }
  };

  const unlinkInstagram = async (account) => {
    setBusy('ig-unlink');
    try {
      await base44.functions.invoke('instagramAccount', { action: 'unlink', account_id: account.id });
      await loadLinked();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not unlink', description: err?.response?.data?.error || err.message });
    } finally {
      setBusy('');
    }
  };

  const verify = async () => {
    setBusy('verify');
    try {
      await base44.functions.invoke('facebookAccounts', { action: 'verify', business_id: business.id });
      await base44.functions.invoke('instagramAccount', { action: 'verify', business_id: business.id });
      await loadLinked();
      toast({ title: 'Connections checked' });
    } finally {
      setBusy('');
    }
  };

  if (!ready) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto text-center">
        <Facebook className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="font-space font-bold text-2xl mb-2">Social Accounts</h1>
        <p className="text-muted-foreground mb-6">Add a business profile first — accounts are linked per business.</p>
        <Link to="/businesses/new"><Button className="bg-primary">Add a business</Button></Link>
      </div>
    );
  }

  const linkedIds = new Set(linked.map((a) => a.external_id));
  const igLinkedAccount = linked.find((a) => a.platform === 'instagram') || null;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <Facebook className="w-6 h-6 text-primary" /> Social Accounts
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Link the accounts {business.name} publishes to. Only accounts linked here can receive scheduled posts.
        </p>
      </div>

      <section className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-space font-semibold text-lg">Linked accounts</h2>
          <Button variant="outline" size="sm" onClick={verify} disabled={busy === 'verify' || !linked.length} className="gap-2">
            {busy === 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Re-check connections
          </Button>
        </div>

        {!linked.length ? (
          <p className="text-sm text-muted-foreground">
            No account linked yet. Choose a Facebook Page below, or link Instagram for Reels.
          </p>
        ) : (
          <div className="space-y-2">
            {linked.map((account) => (
              <div key={account.id} className="flex items-center justify-between gap-3 bg-surface-2 border border-border rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.platform === 'instagram' ? 'Instagram account' : 'Page'} id {account.external_id}
                    {account.platform === 'facebook' && account.business_manager_name ? ` · via ${account.business_manager_name}` : ''}
                    {account.last_verified_at ? ` · checked ${new Date(account.last_verified_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border flex items-center gap-1',
                    account.status === 'connected'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30')}>
                    {account.status === 'connected' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {account.status === 'connected' ? 'Ready' : 'Reconnect needed'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => unlink(account)} disabled={busy === account.id}
                    className="text-muted-foreground hover:text-destructive gap-1.5">
                    {busy === account.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                    Unlink
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-space font-semibold text-lg mb-1">Facebook Pages you can publish to</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Read directly from your connected Facebook account. Pages owned by a Meta Business Manager are included.
        </p>

        {note && (
          <p className="text-xs text-amber-400 flex gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
            <Info className="w-3 h-3 mt-0.5 shrink-0" /> {note}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground py-6">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm">Reading your Facebook Pages…</span>
          </div>
        ) : !connected ? (
          <p className="text-sm text-destructive">Facebook Pages is not connected. Reconnect the connector to continue.</p>
        ) : !pages.length ? (
          <p className="text-sm text-muted-foreground">
            No Pages were returned. If your Page belongs to a business portfolio, reconnect Facebook and select that business during consent.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {pages.map((page) => {
              const isLinked = linkedIds.has(page.id);
              return (
                <div key={page.id} className="flex items-center justify-between gap-3 border border-border rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{page.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {page.business_name ? `Business: ${page.business_name}` : 'Directly managed'}
                      {!page.has_token ? ' · no publishing permission' : ''}
                    </p>
                  </div>
                  {isLinked ? (
                    <span className="text-xs text-emerald-400 shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Linked
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => link(page)}
                      disabled={!page.has_token || busy === page.id}
                      className="gap-1.5 shrink-0">
                      {busy === page.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      Link
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-space font-semibold text-lg mb-1 flex items-center gap-2">
          <Instagram className="w-5 h-5 text-primary" /> Instagram Reels
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Reels your content plan produces publish here. A Reel goes out once its video has been cleared in Video Studio.
        </p>

        {igLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm">Reading your Instagram account…</span>
          </div>
        ) : !igAccount ? (
          <p className="text-sm text-muted-foreground flex gap-1.5 bg-surface-2 border border-border rounded-lg p-3">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {igNote || 'Instagram is not connected.'}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-2 border border-border rounded-lg p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{igAccount.name}</p>
              <p className="text-xs text-muted-foreground">
                {igLinkedAccount
                  ? `Linked to ${business.name}${
                      igLinkedAccount.last_verified_at
                        ? ` · checked ${new Date(igLinkedAccount.last_verified_at).toLocaleDateString()}`
                        : ''
                    }`
                  : 'Not linked to this business yet'}
              </p>
            </div>
            {igLinkedAccount ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unlinkInstagram(igLinkedAccount)}
                disabled={busy === 'ig-unlink'}
                className="text-muted-foreground hover:text-destructive gap-1.5 shrink-0"
              >
                {busy === 'ig-unlink' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                Unlink
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={linkInstagram} disabled={busy === 'ig-link'} className="gap-1.5 shrink-0">
                {busy === 'ig-link' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Link
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-space font-semibold text-lg mb-1">Not connected</h2>
        <p className="text-sm text-muted-foreground mb-4">
          These networks have no authorized connection, so posts targeting them cannot be published yet. They can still be
          drafted and scheduled, and they will report a clear error instead of publishing.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {UNAVAILABLE.map((p) => (
            <div key={p.id} className="border border-dashed border-border rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">{p.label}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Not connected</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Facebook posts publish through the Page you link; Instagram Reels publish through the linked Instagram account once their video has
        been cleared. Posts move through {statusLabel('planned')} → {statusLabel('approved')} → {statusLabel('scheduled')} →{' '}
        {statusLabel('published')}.
      </p>
    </div>
  );
}