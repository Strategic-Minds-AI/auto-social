import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Image as ImageIcon, Loader2 } from 'lucide-react';

// The nine tiles are the account's first posts, in the order they go out.
export default function GridPlan({ plan, onRenderTile, busySlot, note }) {
  const { toast } = useToast();
  const tiles = plan || [];
  if (!tiles.length) return null;

  const copy = async (tile) => {
    const text = [tile.hook, tile.caption, tile.hashtags].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `Tile ${tile.slot} is on your clipboard.` });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-space text-sm font-semibold">The first nine posts</h3>
      {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.slot} className="bg-surface-2 border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="aspect-square bg-background/50 overflow-hidden flex items-center justify-center">
              {tile.image_url ? (
                <img src={tile.image_url} alt={tile.hook} className="w-full h-full object-cover" />
              ) : (
                <div className="p-3 text-center">
                  <ImageIcon className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">{tile.visual_prompt}</p>
                </div>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col gap-1.5">
              <p className="text-[10px] uppercase tracking-wide text-primary">Tile {tile.slot}</p>
              <p className="text-sm">{tile.hook}</p>
              {tile.caption && <p className="text-xs text-muted-foreground">{tile.caption}</p>}
              {tile.hashtags && <p className="text-[11px] text-muted-foreground/80">{tile.hashtags}</p>}
              <div className="mt-auto flex gap-1.5 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={busySlot === tile.slot}
                  onClick={() => onRenderTile(tile.slot)}
                >
                  {busySlot === tile.slot ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                  {tile.image_url ? 'Redraw' : 'Draw this tile'}
                </Button>
                {tile.caption && (
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => copy(tile)}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}