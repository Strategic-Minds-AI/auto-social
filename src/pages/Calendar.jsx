import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import CalendarToolbar from '@/components/calendar/CalendarToolbar';
import MonthGrid, { monthMatrix, dateKey } from '@/components/calendar/MonthGrid';
import WeekGrid from '@/components/calendar/WeekGrid';
import StatusBadge from '@/components/scheduling/StatusBadge';
import PostDetailPanel from '@/components/calendar/PostDetailPanel';
import { Button } from '@/components/ui/button';
import { CalendarDays, Loader2 } from 'lucide-react';

const STATUS_LEGEND = [
  { key: 'planned', label: 'Needs review' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'failed', label: 'Failed' },
];

export default function Calendar() {
  const { business, ready } = useActiveBusiness();
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const weekDates = useMemo(() => {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - anchor.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const range = useMemo(() => {
    if (view === 'month') {
      const days = monthMatrix(anchor);
      return { from: dateKey(days[0]), to: dateKey(days[days.length - 1]) };
    }
    if (view === 'week') {
      return { from: dateKey(weekDates[0]), to: dateKey(weekDates[6]) };
    }
    return { from: dateKey(anchor), to: dateKey(anchor) };
  }, [view, anchor, weekDates]);

  const load = useCallback(async () => {
    if (!business) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [postPage, accountPage] = await Promise.all([
      base44.entities.ScheduledPost.filter(
        { business_id: business.id, scheduled_date: { $gte: range.from, $lte: range.to } },
        { sort: 'scheduled_at', limit: 200 }
      ),
      base44.entities.SocialAccount.filter({ business_id: business.id }, { limit: 50 }),
    ]);
    setPosts(postPage.items || []);
    setAccounts(accountPage.items || []);
    setLoading(false);
  }, [business, range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const handleChanged = async () => {
    await load();
    if (selected) {
      const fresh = await base44.entities.ScheduledPost.get(selected.id).catch(() => null);
      setSelected(fresh);
    }
  };

  const handleDeleted = () => {
    setSelected(null);
    load();
  };

  const postsByDate = useMemo(() => {
    return posts.reduce((acc, post) => {
      const key = post.scheduled_date;
      if (!key) return acc;
      acc[key] = acc[key] || [];
      acc[key].push(post);
      return acc;
    }, {});
  }, [posts]);

  const shift = (dir) => {
    const next = new Date(anchor);
    if (view === 'month') next.setMonth(anchor.getMonth() + dir);
    else if (view === 'week') next.setDate(anchor.getDate() + dir * 7);
    else next.setDate(anchor.getDate() + dir);
    setAnchor(next);
  };

  const label =
    view === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `Week of ${weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
        : anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  if (!ready) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto text-center">
        <CalendarDays className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="font-space font-bold text-2xl mb-2">Calendar</h1>
        <p className="text-muted-foreground mb-6">Add a business profile first — the calendar is scoped to one business.</p>
        <Link to="/businesses/new"><Button className="bg-primary">Add a business</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" /> Calendar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Scheduling and publishing timeline for {business.name}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-3">
        {STATUS_LEGEND.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge status={s.key} /> {s.label}
          </span>
        ))}
      </div>

      <CalendarToolbar
        view={view}
        onView={setView}
        label={label}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => setAnchor(new Date())}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : view === 'month' ? (
            <MonthGrid anchor={anchor} postsByDate={postsByDate} onSelect={setSelected} />
          ) : (
            <WeekGrid
              dates={view === 'week' ? weekDates : [anchor]}
              postsByDate={postsByDate}
              onSelect={setSelected}
            />
          )}
        </div>

        <aside className="xl:sticky xl:top-6 h-fit">
          {!selected ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Select a post to review, approve, reschedule or publish it.
              </p>
            </div>
          ) : (
            <PostDetailPanel
              post={selected}
              accounts={accounts}
              onChanged={handleChanged}
              onDeleted={handleDeleted}
              onClose={() => setSelected(null)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}