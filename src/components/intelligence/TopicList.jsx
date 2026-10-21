import { Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MOMENTUM = {
  rising: { Icon: TrendingUp, cls: 'text-emerald-400' },
  steady: { Icon: Minus, cls: 'text-muted-foreground' },
  declining: { Icon: TrendingDown, cls: 'text-destructive' },
};

const CATEGORY_CLS = {
  service: 'bg-primary/15 text-primary border-primary/30',
  industry: 'bg-secondary text-secondary-foreground border-border',
  question: 'bg-neon-pink/15 text-neon-pink border-neon-pink/30',
  seasonal: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  local: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

export default function TopicList({ topics, running, onRefresh, geo, setGeo, note }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">{note || 'Ranked from most to least wanted by your market.'}</p>
        <div className="flex items-center gap-2">
          <Input
            value={geo}
            onChange={(e) => setGeo(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="US"
            className="bg-input w-16 h-9 text-center"
            aria-label="Region code"
          />
          <Button onClick={onRefresh} disabled={running} variant="outline" size="sm" className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {running ? 'Researching...' : 'Refresh topics'}
          </Button>
        </div>
      </div>

      {!topics.length ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No topics yet. Refresh to rank the subjects your customers actually search for.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => {
            const { Icon, cls } = MOMENTUM[topic.momentum] || MOMENTUM.steady;
            return (
              <li key={topic.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                <span className="font-space font-bold text-sm text-muted-foreground w-6 flex-shrink-0 pt-0.5">
                  {topic.rank}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{topic.topic}</span>
                    <span
                      className={cn(
                        'text-[11px] px-1.5 py-0.5 rounded-full border capitalize',
                        CATEGORY_CLS[topic.category] || CATEGORY_CLS.industry
                      )}
                    >
                      {topic.category}
                    </span>
                    {topic.used && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                        used
                      </span>
                    )}
                  </div>
                  {topic.keywords && <p className="text-xs text-muted-foreground">{topic.keywords}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                  <Icon className={cn('w-3.5 h-3.5', cls)} />
                  <span className="text-xs text-muted-foreground tabular-nums">{topic.interest}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}