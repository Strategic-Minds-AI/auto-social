import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import MonthGrid from '@/components/calendar/MonthGrid';
import PostDetailPanel from '@/components/calendar/PostDetailPanel';
import StatusBadge from '@/components/scheduling/StatusBadge';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const LEGEND = [
  { key: 'planned', label: 'Needs review' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'failed', label: 'Failed' },
];

export default function ContentCalendar({ posts, accounts, onChanged }) {
  const [anchor, setAnchor] = useState(new Date());
  const [selected, setSelected] = useState(null);

  const postsByDate = useMemo(
    () =>
      posts.reduce((acc, post) => {
        if (!post.scheduled_date) return acc;
        acc[post.scheduled_date] = acc[post.scheduled_date] || [];
        acc[post.scheduled_date].push(post);
        return acc;
      }, {}),
    [posts]
  );

  const monthPrefix = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
  const monthCount = posts.filter((post) => String(post.scheduled_date || '').startsWith(monthPrefix)).length;

  const shift = (direction) => {
    const next = new Date(anchor);
    next.setMonth(anchor.getMonth() + direction);
    setAnchor(next);
  };

  const handleChanged = async () => {
    await onChanged();
    if (selected) {
      const fresh = await base44.entities.ScheduledPost.get(selected.id).catch(() => null);
      setSelected(fresh);
    }
  };

  const handleDeleted = async () => {
    setSelected(null);
    await onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <span className="font-space font-semibold ml-2">
          {anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {monthCount === 0
            ? 'Nothing scheduled this month'
            : `${monthCount} post${monthCount === 1 ? '' : 's'} this month`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {LEGEND.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge status={item.key} /> {item.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <MonthGrid anchor={anchor} postsByDate={postsByDate} onSelect={setSelected} />

        {selected ? (
          <PostDetailPanel
            post={selected}
            accounts={accounts}
            onChanged={handleChanged}
            onDeleted={handleDeleted}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 text-center h-fit">
            <CalendarDays className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a post to review, approve, reschedule or publish it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}