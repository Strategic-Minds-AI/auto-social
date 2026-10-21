import PostPill from './PostPill';
import { dateKey } from './MonthGrid';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Used for both the week view (7 columns) and the day view (a single column).
export default function WeekGrid({ dates, postsByDate, onSelect }) {
  const today = dateKey(new Date());
  const single = dates.length === 1;

  return (
    <div className={cn('grid gap-2', single ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-7')}>
      {dates.map((day) => {
        const key = dateKey(day);
        const posts = postsByDate[key] || [];
        return (
          <div
            key={key}
            className={cn(
              'bg-card border rounded-xl p-3 min-h-[180px]',
              key === today ? 'border-primary/40' : 'border-border'
            )}
          >
            <div className="mb-2">
              <p className="text-xs text-muted-foreground">{WEEKDAYS[day.getDay()]}</p>
              <p className={cn('font-space font-semibold text-sm', key === today && 'text-primary')}>
                {day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="space-y-1.5">
              {posts.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">Nothing scheduled</p>
              ) : (
                posts.map((post) => <PostPill key={post.id} post={post} onClick={() => onSelect(post)} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}