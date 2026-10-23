import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Info, Loader2, Sparkles } from 'lucide-react';

const SELECT_CLASS =
  'w-full bg-surface-2 border border-border rounded-lg text-sm px-3 py-2 text-foreground mt-1';

export default function MakeoverForm({ targets, kits, onRun, busy }) {
  const [targetKey, setTargetKey] = useState('');
  const [kitId, setKitId] = useState('');

  const target = useMemo(
    () => targets.find((item) => item.key === targetKey) || targets[0] || null,
    [targets, targetKey]
  );
  const kit = kits.find((item) => item.id === kitId) || null;
  const running = busy === 'run';

  if (!targets.length) {
    return (
      <p className="text-sm text-muted-foreground flex gap-1.5 bg-surface-2 border border-border rounded-lg p-3">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        No account is available to review yet. Link a Page or the Instagram account in Social Accounts first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Account to review</label>
        <select
          className={SELECT_CLASS}
          value={target?.key || ''}
          onChange={(event) => setTargetKey(event.target.value)}
          disabled={running}
        >
          {targets.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Rebrand it as (optional)</label>
        <select
          className={SELECT_CLASS}
          value={kitId}
          onChange={(event) => setKitId(event.target.value)}
          disabled={running}
        >
          <option value="">Keep its own identity</option>
          {kits.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.handle}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          {kit
            ? `This account adopts ${kit.name}: its name, bio, palette, artwork and first nine posts.`
            : 'Scores the account as it stands, writes the new copy and draws fresh visuals.'}
        </p>
      </div>

      <Button className="gap-2 w-full sm:w-auto" disabled={running || !target} onClick={() => onRun(target, kitId)}>
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {running ? 'Reading, scoring and designing…' : kit ? 'Rebrand this account' : 'Make this account look amazing'}
      </Button>

      {running && (
        <p className="text-xs text-muted-foreground">
          Reading the live profile, scoring it, writing the copy and drawing the visuals. Up to a minute.
        </p>
      )}
    </div>
  );
}