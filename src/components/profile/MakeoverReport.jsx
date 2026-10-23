import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, Copy, ListChecks, Link2, TrendingUp } from 'lucide-react';
import AssetPair from './AssetPair';
import GridPlan from './GridPlan';
import { cn } from '@/lib/utils';

const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook Page', youtube: 'YouTube channel' };

const GRADE_CLASS = {
  A: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  B: 'bg-primary/15 text-primary border-primary/30',
  C: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  D: 'bg-destructive/15 text-destructive border-destructive/30',
};

function Field({ label, hint, value, onCopy }) {
  if (!value) return null;
  return (
    <div className="border-b border-border/60 last:border-0 pb-3 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => onCopy(value, label)}>
          <Copy className="w-3 h-3" /> Copy
        </Button>
      </div>
      <p className="text-sm mt-1">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default function MakeoverReport({ makeover, onRenderTile, busySlot }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState('');

  if (!makeover) return null;

  const copy = async (text, label) => {
    await navigator.clipboard.writeText(text || '');
    setCopied(label);
    toast({ title: 'Copied', description: `${label} is on your clipboard.` });
  };

  const name = PLATFORM_LABEL[makeover.platform] || makeover.platform;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-space font-semibold text-lg">{name}</h2>
            {makeover.handle && <p className="text-sm text-muted-foreground">{makeover.handle}</p>}
          </div>
          <div className="text-right shrink-0">
            {makeover.read_ok ? (
              <>
                <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', GRADE_CLASS[makeover.grade] || GRADE_CLASS.D)}>
                  Grade {makeover.grade}
                </span>
                <p className="text-2xl font-space font-bold mt-1">
                  {makeover.score_total}
                  <span className="text-sm text-muted-foreground">/100</span>
                </p>
              </>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface-2 text-muted-foreground">
                Not scored
              </span>
            )}
          </div>
        </div>

        <p
          className={cn(
            'text-xs mt-3 flex gap-1.5',
            makeover.read_ok ? 'text-muted-foreground' : 'text-amber-400'
          )}
        >
          {!makeover.read_ok && <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
          {makeover.read_note}
        </p>

        {(makeover.followers !== null || makeover.posts_count !== null) && (
          <p className="text-xs text-muted-foreground mt-1">
            {makeover.followers !== null ? `${makeover.followers} followers` : ''}
            {makeover.followers !== null && makeover.posts_count !== null ? ' · ' : ''}
            {makeover.posts_count !== null ? `${makeover.posts_count} published items` : ''}
          </p>
        )}
        {makeover.platform === 'youtube' && (
          <p className="text-xs text-muted-foreground/70 mt-1">Channel figures read from YouTube.</p>
        )}
      </div>

      {/* A score is only meaningful once the profile has actually been read. */}
      {makeover.read_ok && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-space text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> How a stranger scores it
          </h3>
          <div className="mt-3 space-y-3">
            {(makeover.scores || []).map((score) => (
              <div key={score.key || score.label}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">{score.label}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{score.score}/{score.max}</p>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.round(((score.score || 0) / (score.max || 20)) * 100)}%` }}
                  />
                </div>
                {score.note && <p className="text-xs text-muted-foreground mt-1">{score.note}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {makeover.fixes?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-space text-sm font-semibold">Fix these first</h3>
          <ol className="mt-3 space-y-2">
            {makeover.fixes.map((fix, index) => (
              <li key={fix} className="text-sm flex gap-2">
                <span className="text-primary tabular-nums shrink-0">{index + 1}.</span>
                <span>{fix}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-space text-sm font-semibold">Written for you</h3>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() =>
              copy(
                [
                  makeover.new_name,
                  makeover.new_bio,
                  makeover.new_link ? `Link: ${makeover.new_link}` : '',
                ]
                  .filter(Boolean)
                  .join('\n\n'),
                'Name, bio and link'
              )
            }
          >
            <Copy className="w-3 h-3" /> Copy the lot
          </Button>
        </div>

        <Field label="Name field" value={makeover.new_name} onCopy={copy} />
        <Field label="Bio" value={makeover.new_bio} onCopy={copy} hint={
          makeover.platform === 'youtube'
            ? 'Goes at the top of the channel description.'
            : 'Paste straight into the profile bio.'
        } />
        <Field label="Link" value={makeover.new_link} onCopy={copy} />
        <Field label="Pin this" value={makeover.pinned_plan} onCopy={copy} />

        {makeover.new_highlights?.length > 0 && (
          <div className="border-b border-border/60 pb-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {makeover.platform === 'youtube' ? 'Playlists and links' : 'Highlights'}
            </p>
            <div className="mt-2 space-y-1.5">
              {makeover.new_highlights.map((item) => (
                <div key={item.label} className="text-sm">
                  <span className="font-medium">{item.label}</span>
                  {item.guidance && <span className="text-muted-foreground"> — {item.guidance}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {makeover.ad_angles?.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ad angles from this account</p>
            <ul className="mt-2 space-y-1.5">
              {makeover.ad_angles.map((angle) => (
                <li key={angle} className="text-sm flex gap-2">
                  <Link2 className="w-3.5 h-3.5 text-primary mt-1 shrink-0" />
                  <span>{angle}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {copied && <p className="text-xs text-primary">{copied} copied.</p>}
      </div>

      <AssetPair avatar_url={makeover.avatar_url} banner_url={makeover.banner_url} title="The makeover visuals" />

      <GridPlan
        plan={makeover.grid_plan}
        onRenderTile={onRenderTile}
        busySlot={busySlot}
        note={makeover.brand_kit_id ? 'These tiles belong to the brand this account was rebranded to.' : undefined}
      />

      {makeover.checklist?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-space text-sm font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" /> In this order
          </h3>
          <ol className="mt-3 space-y-2">
            {makeover.checklist.map((item, index) => (
              <li key={item} className="text-sm flex gap-2">
                <span className="text-primary tabular-nums shrink-0">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}