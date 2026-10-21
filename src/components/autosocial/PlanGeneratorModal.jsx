import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
];
const DAYS = [7, 14, 30];
const PER_WEEK = [3, 5, 7];

export default function PlanGeneratorModal({ business, busy, onGenerate, onClose }) {
  const [platforms, setPlatforms] = useState(['instagram', 'facebook']);
  const [days, setDays] = useState(30);
  const [perWeek, setPerWeek] = useState(5);
  const [startDate, setStartDate] = useState('');

  const togglePlatform = (id) => {
    setPlatforms((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-space font-bold text-lg">Generate a content plan</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Auto Social writes the whole calendar for {business?.name || 'this business'} — hooks, captions, hashtags and image briefs.
        </p>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.id} onClick={() => togglePlatform(p.id)}
                  className={cn('px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                    platforms.includes(p.id) ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Plan length</Label>
            <div className="flex gap-2">
              {DAYS.map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
                    days === d ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                  )}>
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Posts per week</Label>
            <div className="flex gap-2">
              {PER_WEEK.map((n) => (
                <button key={n} onClick={() => setPerWeek(n)}
                  className={cn('flex-1 py-2 rounded-lg border text-sm font-medium transition-all',
                    perWeek === n ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary/30'
                  )}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Start date</Label>
            <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">Leave empty to start tomorrow.</p>
          </div>
        </div>

        <Button
          onClick={() => onGenerate({ platforms, days, posts_per_week: perWeek, start_date: startDate || undefined })}
          disabled={busy || !platforms.length}
          className="w-full mt-6 bg-primary glow-primary-sm gap-2 font-medium"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? 'Writing your plan…' : `Generate ${days}-day plan`}
        </Button>
      </div>
    </div>
  );
}