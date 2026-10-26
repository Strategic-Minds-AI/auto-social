import { AlertTriangle, CheckCircle2, CircleAlert, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// What each state looks like: repaired by the loop, waiting on a person, or watched.
const STATE = {
  auto_fixed: { label: 'Repaired', icon: CheckCircle2, tone: 'text-primary border-primary/40 bg-primary/10' },
  needs_you: { label: 'Needs you', icon: AlertTriangle, tone: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
  open: { label: 'Watching', icon: Eye, tone: 'text-muted-foreground border-border bg-surface-2' },
  resolved: { label: 'Cleared', icon: CheckCircle2, tone: 'text-muted-foreground border-border bg-surface-2' },
};

const seen = (value) => (value ? new Date(value).toLocaleString() : 'just now');

export default function IssueRow({ item }) {
  const state = STATE[item.status] || STATE.open;
  const Icon = state.icon;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border shrink-0', state.tone)}>
          <Icon className="w-3 h-3" />
          {state.label}
        </span>
      </div>

      <p className="text-xs text-foreground/80 bg-surface-2 border border-border rounded-lg p-2.5 leading-relaxed">
        {item.fix}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CircleAlert className="w-3 h-3" />
          {item.kind}
        </span>
        <span>seen {seen(item.last_seen_at)}</span>
        {Number(item.occurrences) > 1 && <span>{item.occurrences} times</span>}
      </div>
    </div>
  );
}