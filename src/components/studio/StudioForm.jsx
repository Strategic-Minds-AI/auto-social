import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
];
const FORMATS = ['post', 'story', 'reel', 'short_video', 'image'];
const TONES = ['brand voice', 'professional', 'casual', 'playful', 'luxury', 'inspirational', 'educational'];
const COUNTS = [1, 3, 5, 7];
const MODES = [
  { id: 'create', label: 'Write new' },
  { id: 'rewrite', label: 'Rewrite one' },
  { id: 'variation', label: 'Variations' },
];

const chip = (active) =>
  cn('px-3 py-1.5 rounded-lg border text-sm font-medium transition-all capitalize',
    active ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/30');

export default function StudioForm({ business, busy, onGenerate, lastRun }) {
  const [mode, setMode] = useState('create');
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('post');
  const [tone, setTone] = useState('brand voice');
  const [count, setCount] = useState(3);
  const [brief, setBrief] = useState('');
  const [existingText, setExistingText] = useState('');

  const needsText = mode !== 'create';
  const ready = needsText ? existingText.trim().length > 10 : brief.trim().length > 3;

  const submit = () =>
    onGenerate({
      mode,
      platform,
      format,
      count,
      tone: tone === 'brand voice' ? '' : tone,
      brief: brief.trim(),
      existing_text: existingText.trim(),
    });

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
      <div className="space-y-2">
        <Label>What do you want to do?</Label>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} className={cn(chip(mode === m.id), 'flex-1')}>{m.label}</button>
          ))}
        </div>
      </div>

      {needsText ? (
        <div className="space-y-2">
          <Label htmlFor="existing">Paste the post to work from</Label>
          <Textarea id="existing" rows={6} value={existingText} placeholder="Paste an existing caption…"
            onChange={(e) => setExistingText(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="brief">Brief</Label>
          <Textarea id="brief" rows={6} value={brief}
            placeholder="e.g. Promote our spring detailing package to local car owners"
            onChange={(e) => setBrief(e.target.value)} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Platform</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button key={p.id} onClick={() => setPlatform(p.id)} className={chip(platform === p.id)}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button key={f} onClick={() => setFormat(f)} className={chip(format === f)}>{f.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tone</Label>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button key={t} onClick={() => setTone(t)} className={chip(tone === t)}>{t}</button>
          ))}
        </div>
      </div>

      {!needsText && (
        <div className="space-y-2">
          <Label>How many</Label>
          <div className="flex gap-2">
            {COUNTS.map((n) => (
              <button key={n} onClick={() => setCount(n)} className={cn(chip(count === n), 'flex-1')}>{n}</button>
            ))}
          </div>
        </div>
      )}

      <Button onClick={submit} disabled={busy || !ready}
        className="w-full bg-primary glow-purple-sm gap-2 font-medium">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? 'Writing…' : mode === 'rewrite' ? 'Rewrite with AI' : `Generate ${needsText ? count : count} with AI`}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Runs on your connected AI gateway{business?.name ? ` for ${business.name}` : ''}.
      </p>

      {lastRun?.provider && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Last run: <span className="text-foreground">{lastRun.provider}</span>
            {lastRun.model ? <> · {lastRun.model}</> : null}
            {lastRun.total_tokens ? <> · {lastRun.total_tokens} tokens</> : null}
            {lastRun.attempts > 1 ? <> · {lastRun.attempts} attempts</> : null}
          </p>
        </div>
      )}
    </div>
  );
}