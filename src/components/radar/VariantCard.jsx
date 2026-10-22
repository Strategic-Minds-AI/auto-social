import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VariantCard({ variant, isWinner, rank }) {
  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-5 flex flex-col gap-3',
        isWinner ? 'border-primary glow-primary-sm' : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isWinner ? 'default' : 'secondary'} className="gap-1">
            {isWinner && <Trophy className="w-3 h-3" />}
            {variant.label}
          </Badge>
          <span className="text-xs text-muted-foreground">#{rank} · {variant.angle}</span>
        </div>
        <span className="shrink-0 font-space font-semibold text-primary">{variant.predicted_score}/100</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Predicted engagement</p>
          <p className="text-sm font-space font-semibold">{variant.predicted_engagement_rate}%</p>
        </div>
        <div className="bg-surface rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Borrows its pattern from</p>
          <p className="text-xs mt-0.5 line-clamp-2">{variant.based_on || 'the pattern read'}</p>
        </div>
      </div>

      <p className="text-sm italic text-foreground/90">“{variant.hook}”</p>
      <p className="text-sm text-muted-foreground whitespace-pre-line">{variant.caption}</p>

      {variant.call_to_action && (
        <p className="text-xs">
          <span className="text-muted-foreground">Call to action:</span> {variant.call_to_action}
        </p>
      )}
      {variant.hashtags && <p className="text-xs text-primary">{variant.hashtags}</p>}

      <div className="border-t border-border pt-3 space-y-2">
        {variant.why_it_will_win && (
          <p className="text-xs">
            <span className="text-muted-foreground">Why it should win:</span> {variant.why_it_will_win}
          </p>
        )}
        {variant.risks && (
          <p className="text-xs">
            <span className="text-muted-foreground">What could sink it:</span> {variant.risks}
          </p>
        )}
        {Array.isArray(variant.pattern_tags) && variant.pattern_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {variant.pattern_tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}