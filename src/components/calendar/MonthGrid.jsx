import PostPill from './PostPill';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthMatrix(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function MonthGrid({ anchor, postsByDate, onSelect }) {
  const days = monthMatrix(anchor);
  const today = dateKey(new Date());

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-xs text-muted-foreground text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const posts = postsByDate[key] || [];
          const outside = day.getMonth() !== anchor.getMonth();
          return (
            <div
              key={key}
              className={cn(
                'min-h-[104px] border-b border-r border-border p-1.5 space-y-1',
                outside && 'bg-background/40'
              )}
            >
              <div className={cn('text-xs mb-1 flex items-center justify-between', outside ? 'text-muted-foreground/50' : 'text-muted-foreground')}>
                <span className={cn(key === today && 'text-primary font-bold')}>{day.getDate()}</span>
                {posts.length > 1 && <span className="text-[10px]">{posts.length}</span>}
              </div>
              {posts.slice(0, 3).map((post) => (
                <PostPill key={post.id} post={post} onClick={() => onSelect(post)} />
              ))}
              {posts.length > 3 && (
                <p className="text-[10px] text-muted-foreground px-1">+{posts.length - 3} more</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}