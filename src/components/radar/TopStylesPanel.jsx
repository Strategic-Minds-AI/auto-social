import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { fromStyle } from '@/lib/libraryItems';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, TrendingUp } from 'lucide-react';

// What is actually winning in this niche, read off every signal the radar has on
// file: the formats, looks, sound and hook styles with the strongest average.
const GROUPS = [
  { key: 'format', label: 'Formats', kind: 'visual_template' },
  { key: 'visual_style', label: 'Visual styles', kind: 'visual_template' },
  { key: 'audio_style', label: 'Sound and pacing', kind: 'editing_recipe' },
  { key: 'hook_type', label: 'Hook styles', kind: 'hook' },
];

export default function TopStylesPanel({ nicheKey, businessId, platform, scanSeq }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!nicheKey) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        GROUPS.map((group) =>
          base44.entities.TrendSignal.aggregate({
            query: { niche_key: nicheKey },
            groupBy: group.key,
            avg: ['score'],
          }).catch(() => ({ rows: [] }))
        )
      );

      const next = [];
      results.forEach((result, index) => {
        const group = GROUPS[index];
        (result?.rows || [])
          .map((row) => ({
            value: String(row[group.key] ?? '').trim(),
            count: Number(row.count) || 0,
            score: Number(row.avg_score ?? 0),
          }))
          .filter((row) => row.value && row.count > 1)
          .sort((a, b) => b.score - a.score || b.count - a.count)
          .slice(0, 3)
          .forEach((row) => next.push({ ...row, group: group.key, label: group.label, kind: group.kind }));
      });

      setRows(next);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [nicheKey]);

  useEffect(() => {
    load();
  }, [load, scanSeq]);

  const save = async (row) => {
    if (!businessId) return;
    setBusy(`${row.group}:${row.value}`);
    try {
      await base44.entities.LibraryItem.create(fromStyle(row, businessId, platform));
      toast({
        title: 'Saved to your library',
        description: `${row.value} will now steer the content Eden writes.`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save that style', description: error.message });
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm">Reading the styles that are winning here…</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-space font-semibold text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Top-performing styles in this niche
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          No style has repeated enough to count as a pattern yet. Scan the industry again to widen the read — a format,
          look, sound or hook style appears here as soon as two pieces agree on it.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 className="font-space font-semibold text-base flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" /> Top-performing styles in this niche
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Averaged across every signal on file. Keep one and it becomes a template the writer is given.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {rows.map((row) => (
          <div
            key={`${row.group}-${row.value}`}
            className="bg-surface-2 border border-border rounded-lg p-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{row.label}</p>
              <p className="text-sm truncate">{row.value}</p>
              <p className="text-[11px] text-muted-foreground">
                {row.count} pieces · average {Math.round(row.score)}/100
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs shrink-0"
              disabled={busy === `${row.group}:${row.value}`}
              onClick={() => save(row)}
            >
              {busy === `${row.group}:${row.value}` ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Keep
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}