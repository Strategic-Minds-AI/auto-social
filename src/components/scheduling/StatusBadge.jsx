import { cn } from '@/lib/utils';

const STATUS = {
  planned: { label: 'Needs review', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  scheduled: { label: 'Scheduled', cls: 'bg-primary/15 text-primary border-primary/30' },
  publishing: { label: 'Publishing', cls: 'bg-primary/25 text-primary border-primary/40' },
  published: { label: 'Published', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  failed: { label: 'Failed', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-secondary text-muted-foreground border-border' },
};

export const STATUS_DOT = {
  planned: 'bg-amber-400',
  approved: 'bg-sky-400',
  scheduled: 'bg-primary',
  publishing: 'bg-primary animate-pulse',
  published: 'bg-emerald-400',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground',
};

export function statusLabel(status) {
  return (STATUS[status] || STATUS.planned).label;
}

export default function StatusBadge({ status, className }) {
  const style = STATUS[status] || STATUS.planned;
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap', style.cls, className)}>
      {style.label}
    </span>
  );
}