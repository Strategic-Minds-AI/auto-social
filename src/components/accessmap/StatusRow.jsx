import { CheckCircle2, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatusRow({ name, detail, state }) {
  const live = state === 'connected';
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex gap-3">
      <span
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          live ? 'bg-emerald-500/15 text-emerald-400' : 'bg-primary/15 text-primary'
        )}
      >
        {live ? <CheckCircle2 className="w-4 h-4" /> : <Plug className="w-4 h-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}