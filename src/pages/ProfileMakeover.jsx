import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Palette } from 'lucide-react';
import MakeoverForm from '@/components/profile/MakeoverForm';
import MakeoverReport from '@/components/profile/MakeoverReport';
import FacelessBrandPanel from '@/components/profile/FacelessBrandPanel';
import { cn } from '@/lib/utils';

// Reads the accounts the business has connected, scores how each one looks to a
// stranger, writes the copy and designs the visuals. The same page builds the
// faceless brands those accounts can be rebranded into.

export default function ProfileMakeover() {
  const { business, ready } = useActiveBusiness();
  const { toast } = useToast();

  const [targets, setTargets] = useState([]);
  const [kits, setKits] = useState([]);
  const [makeovers, setMakeovers] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [busy, setBusy] = useState('');
  const [busyTile, setBusyTile] = useState('');

  const loadTargets = useCallback(async () => {
    if (!business) return;
    const res = await base44.functions.invoke('profileMakeover', { action: 'targets', business_id: business.id });
    setTargets(res.data?.targets || []);
  }, [business]);

  const loadKits = useCallback(async () => {
    if (!business) return;
    const page = await base44.entities.BrandKit.filter({ business_id: business.id }, { sort: '-created_date', limit: 30 });
    setKits(page.items || []);
  }, [business]);

  const loadMakeovers = useCallback(async () => {
    if (!business) return;
    const page = await base44.entities.ProfileMakeover.filter(
      { business_id: business.id },
      { sort: '-created_date', limit: 10 }
    );
    const items = page.items || [];
    setMakeovers(items);
    setActiveId((current) => (items.some((item) => item.id === current) ? current : items[0]?.id || ''));
  }, [business]);

  useEffect(() => {
    loadKits();
    loadMakeovers();
  }, [loadKits, loadMakeovers]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const failure = (error) => error?.response?.data?.error || error.message;

  const run = async (target, kitId) => {
    setBusy('run');
    try {
      const res = await base44.functions.invoke('profileMakeover', {
        action: 'run',
        business_id: business.id,
        platform: target.platform,
        account_id: target.account_id || '',
        brand_kit_id: kitId || '',
      });
      const makeover = res.data?.makeover;
      if (!makeover) throw new Error(res.data?.error || 'The review did not return a result.');
      setMakeovers((list) => [makeover, ...list.filter((item) => item.id !== makeover.id)].slice(0, 10));
      setActiveId(makeover.id);
      toast({
        title: 'Profile reviewed',
        description: `${target.label} scored ${makeover.score_total}/100, grade ${makeover.grade}.`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not review that profile', description: failure(error) });
    } finally {
      setBusy('');
    }
  };

  const createBrand = async (niche) => {
    setBusy('brand');
    try {
      const res = await base44.functions.invoke('buildBrandKit', {
        business_id: business.id,
        niche: niche || '',
        faceless: true,
      });
      const kit = res.data?.kit;
      if (!kit) throw new Error(res.data?.error || 'The brand builder did not return a brand.');
      setKits((list) => [kit, ...list]);
      toast({ title: `${kit.name} is ready`, description: `Handle ${kit.handle} · the first nine posts are written.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not build that brand', description: failure(error) });
    } finally {
      setBusy('');
    }
  };

  const removeBrand = async (kit) => {
    await base44.entities.BrandKit.delete(kit.id);
    setKits((list) => list.filter((item) => item.id !== kit.id));
    toast({ title: `${kit.name} deleted` });
  };

  const drawTile = async (kind, id, slot) => {
    setBusyTile(slot);
    try {
      const fn = kind === 'kit' ? 'buildBrandKit' : 'profileMakeover';
      const payload = kind === 'kit' ? { brand_kit_id: id, slot } : { makeover_id: id, slot };
      const res = await base44.functions.invoke(fn, { action: 'render_tile', ...payload });
      const plan = res.data?.grid_plan;
      if (!plan) throw new Error(res.data?.error || 'That tile could not be drawn.');

      if (kind === 'kit') {
        setKits((list) => list.map((item) => (item.id === id ? { ...item, grid_plan: plan } : item)));
      } else {
        setMakeovers((list) => list.map((item) => (item.id === id ? { ...item, grid_plan: plan } : item)));
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not draw that tile', description: failure(error) });
    } finally {
      setBusyTile('');
    }
  };

  const useKit = (kit) => {
    toast({
      title: `${kit.name} selected`,
      description: 'Pick the account on the left, then press "Rebrand this account".',
    });
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
        <Palette className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="font-space font-bold text-2xl mb-2">Profile Makeover</h1>
        <p className="text-muted-foreground mb-6">Add a business profile first — every account and brand belongs to one.</p>
        <Link to="/businesses/new">
          <Button>Add a business</Button>
        </Link>
      </div>
    );
  }

  const active = makeovers.find((item) => item.id === activeId) || null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <Palette className="w-6 h-6 text-primary" /> Profile Makeover
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reads the accounts {business.name} has connected, scores how each one looks to a stranger, writes the name, bio
          and link, and designs the artwork and the first nine posts.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-start">
        <div className="bg-card border border-border rounded-xl p-4 xl:sticky xl:top-6">
          <h2 className="font-space font-semibold text-base mb-3">Review an account</h2>
          <MakeoverForm targets={targets} kits={kits} onRun={run} busy={busy} />

          {makeovers.length > 1 && (
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Earlier reviews</p>
              <div className="flex flex-wrap gap-1.5">
                {makeovers.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition-colors',
                      item.id === activeId
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-surface-2 text-muted-foreground border-border hover:text-foreground'
                    )}
                  >
                    {item.handle || item.platform} · {item.score_total}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          {active ? (
            <MakeoverReport
              makeover={active}
              busySlot={busyTile}
              onRenderTile={(slot) => drawTile('makeover', active.id, slot)}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Palette className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No review yet. Choose an account on the left and run the makeover.
              </p>
            </div>
          )}
        </div>
      </div>

      <FacelessBrandPanel
        kits={kits}
        busy={busy}
        busySlot={busyTile}
        onCreate={createBrand}
        onDelete={removeBrand}
        onUse={useKit}
        onRenderTile={(kitId, slot) => drawTile('kit', kitId, slot)}
      />
    </div>
  );
}