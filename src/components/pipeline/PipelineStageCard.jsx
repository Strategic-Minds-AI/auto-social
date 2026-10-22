import { Link } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Circle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const STAGE_STATUS = {
  done: {
    label: 'Complete',
    icon: CheckCircle2,
    tint: 'text-emerald-400',
    chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    badge: 'bg-emerald-500 border-emerald-500 text-emerald-950',
  },
  active: {
    label: 'In progress',
    icon: Activity,
    tint: 'text-sky-400',
    chip: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    badge: 'bg-sky-500 border-sky-500 text-sky-950',
  },
  action: {
    label: 'Needs you',
    icon: AlertCircle,
    tint: 'text-amber-400',
    chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    badge: 'bg-amber-500 border-amber-500 text-amber-950',
  },
  blocked: {
    label: 'Blocked',
    icon: XCircle,
    tint: 'text-red-400',
    chip: 'bg-red-500/15 text-red-400 border-red-500/30',
    badge: 'bg-red-500 border-red-500 text-red-950',
  },
  optional: {
    label: 'Optional',
    icon: Circle,
    tint: 'text-muted-foreground',
    chip: 'bg-muted text-muted-foreground border-border',
    badge: 'bg-card border-border text-muted-foreground',
  },
  idle: {
    label: 'Not started',
    icon: Circle,
    tint: 'text-muted-foreground',
    chip: 'bg-muted text-muted-foreground border-border',
    badge: 'bg-card border-border text-muted-foreground',
  },
};

export default function PipelineStageCard({ stage, step, last }) {
  const meta = STAGE_STATUS[stage.status] || STAGE_STATUS.idle;
  const Icon = meta.icon;

  return (
    <li className="relative pl-12">
      {!last && <span className="absolute left-4 top-10 bottom-0 w-px bg-border" aria-hidden="true" />}
      <span
        className={cn(
          'absolute left-0 top-1 w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold font-space',
          meta.badge
        )}
      >
        {step}
      </span>

      <div
        className={cn(
          'bg-card rounded-xl p-4 border',
          stage.status === 'optional' ? 'border-dashed border-border' : 'border-border'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-space font-semibold text-base">{stage.title}</h3>
          <span className={cn('text-xs px-2 py-0.5 rounded-full border flex items-center gap-1', meta.chip)}>
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mt-1">{stage.summary}</p>

        <p className="text-xs mt-3 bg-surface-2 border border-border rounded-lg px-3 py-2 text-foreground/80">
          {stage.evidence}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <span className="text-xs text-muted-foreground">{stage.automation}</span>
          <Link to={stage.action.to} className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
            {stage.action.label}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </li>
  );
}