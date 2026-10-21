import { Circle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
  pending: { Icon: Circle, cls: 'text-muted-foreground' },
  running: { Icon: Loader2, cls: 'text-primary' },
  done: { Icon: CheckCircle2, cls: 'text-emerald-400' },
  failed: { Icon: AlertCircle, cls: 'text-destructive' },
};

export default function PipelineStatus({ stages }) {
  return (
    <ul className="space-y-3">
      {stages.map((stage) => {
        const { Icon, cls } = ICONS[stage.state] || ICONS.pending;
        return (
          <li key={stage.key} className="flex items-start gap-3">
            <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', cls, stage.state === 'running' && 'animate-spin')} />
            <div className="min-w-0">
              <p className={cn('text-sm', stage.state === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>
                {stage.label}
              </p>
              {stage.note && <p className="text-xs text-muted-foreground mt-0.5">{stage.note}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}