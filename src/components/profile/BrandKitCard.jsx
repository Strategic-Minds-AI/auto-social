import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Sparkles, Trash2 } from 'lucide-react';
import AssetPair from './AssetPair';
import GridPlan from './GridPlan';

// One faceless brand, ready to run: identity, artwork and its first nine posts.
export default function BrandKitCard({ kit, onUse, onDelete, onRenderTile, busySlot }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const copy = async (text, label) => {
    await navigator.clipboard.writeText(text || '');
    toast({ title: 'Copied', description: `${label} is on your clipboard.` });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-space font-semibold text-base">{kit.name}</h3>
          <p className="text-sm text-muted-foreground">{kit.handle}</p>
          {kit.niche && <p className="text-xs text-muted-foreground mt-1">{kit.niche}</p>}
        </div>
        {kit.palette?.length > 0 && (
          <div className="flex gap-1 shrink-0 pt-1">
            {kit.palette.map((color) => (
              <span
                key={color}
                title={color}
                className="w-5 h-5 rounded-full border border-border"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        )}
      </div>

      {kit.tagline && <p className="text-sm text-primary">{kit.tagline}</p>}

      <div className="bg-surface-2 border border-border rounded-lg p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bio</p>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => copy(kit.bio, 'Bio')}>
            <Copy className="w-3 h-3" /> Copy
          </Button>
        </div>
        <p className="text-sm mt-1">{kit.bio}</p>
        {kit.link && <p className="text-xs text-muted-foreground mt-1">Link: {kit.link}</p>}
      </div>

      {kit.content_pillars?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {kit.content_pillars.map((pillar) => (
            <span key={pillar} className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface-2 text-muted-foreground">
              {pillar}
            </span>
          ))}
        </div>
      )}

      {open && (
        <>
          <AssetPair avatar_url={kit.avatar_url} banner_url={kit.banner_url} title="Brand artwork" />
          <GridPlan
            plan={kit.grid_plan}
            onRenderTile={onRenderTile}
            busySlot={busySlot}
            note="Post these in order and the account looks established on day one."
          />
          {kit.ad_use && (
            <div className="bg-surface-2 border border-border rounded-lg p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Running ads from this brand</p>
              <p className="text-sm mt-1">{kit.ad_use}</p>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setOpen(!open)}>
          {open ? 'Hide details' : 'Show artwork and the nine posts'}
        </Button>
        {onUse && (
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => onUse(kit)}>
            <Sparkles className="w-3 h-3" /> Use for an account
          </Button>
        )}
        {onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(kit)}
          >
            <Trash2 className="w-3 h-3" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}