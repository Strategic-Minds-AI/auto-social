import { CalendarClock } from 'lucide-react';
import StatusBadge from '@/components/scheduling/StatusBadge';
import { slotLabel } from '@/lib/slot';

export default function UpcomingSchedule({ posts, campaignNames }) {
  if (!posts.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <CalendarClock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nothing is queued up to go out yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl divide-y divide-border">
      {posts.map((post) => (
        <div key={post.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm truncate">{post.title || post.hook || 'Untitled post'}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {slotLabel(post)}
              {post.campaign_id && campaignNames[post.campaign_id] ? ` · ${campaignNames[post.campaign_id]}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground capitalize">{post.platform}</span>
            <StatusBadge status={post.status} />
          </div>
        </div>
      ))}
    </div>
  );
}