import { cn } from '@/lib/utils';

const PIECE_STATUS = [
  { key: 'draft', label: 'Draft', dot: 'bg-amber-400' },
  { key: 'approved', label: 'Approved', dot: 'bg-sky-400' },
  { key: 'published', label: 'Published', dot: 'bg-emerald-400' },
];

export default function PieceStatusBar({ counts }) {
  const total = PIECE_STATUS.reduce((sum, { key }) => sum + (counts[key] || 0), 0);
  if (!total) {
    return <p className="text-xs text-muted-foreground">No content pieces written yet.</p>;
  }
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {PIECE_STATUS.map(({ key, label, dot }) => (
        <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn('w-2 h-2 rounded-full', dot)} />
          {label}
          <span className="text-foreground font-semibold">{counts[key] || 0}</span>
        </span>
      ))}
    </div>
  );
}