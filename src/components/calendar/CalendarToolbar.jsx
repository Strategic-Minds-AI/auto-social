import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const VIEWS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

export default function CalendarToolbar({ view, onView, label, onPrev, onNext, onToday }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} aria-label="Previous period">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
        <Button variant="outline" size="icon" onClick={onNext} aria-label="Next period">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="font-space font-semibold ml-2">{label}</span>
      </div>

      <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => onView(v.id)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-all',
              view === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}