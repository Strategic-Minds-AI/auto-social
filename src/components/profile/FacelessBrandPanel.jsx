import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';
import BrandKitCard from './BrandKitCard';

// The factory: one brand per run, as many runs as you like.
export default function FacelessBrandPanel({ kits, onCreate, onDelete, onUse, onRenderTile, busy, busySlot }) {
  const [niche, setNiche] = useState('');
  const creating = busy === 'brand';

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-space font-semibold text-lg">Faceless brands you can run</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Each run builds a whole brand: the name and handle for the profile, the bio, the palette, the artwork and its
          first nine posts. Build as many as you want, one per account.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <input
            className="flex-1 bg-surface-2 border border-border rounded-lg text-sm px-3 py-2 text-foreground placeholder:text-muted-foreground"
            placeholder="Niche to own (optional) — e.g. AI for home service contractors"
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
            disabled={creating}
          />
          <Button className="gap-2 shrink-0" disabled={creating} onClick={() => onCreate(niche)}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {creating ? 'Building the brand…' : 'Build a faceless brand'}
          </Button>
        </div>

        {creating && (
          <p className="text-xs text-muted-foreground mt-2">
            Naming it, writing the bio and the first nine posts, then drawing the artwork. About half a minute.
          </p>
        )}
      </div>

      {kits.length ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {kits.map((kit) => (
            <BrandKitCard
              key={kit.id}
              kit={kit}
              onUse={onUse}
              onDelete={onDelete}
              onRenderTile={(slot) => onRenderTile(kit.id, slot)}
              busySlot={busySlot}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No brand built yet.</p>
      )}
    </div>
  );
}