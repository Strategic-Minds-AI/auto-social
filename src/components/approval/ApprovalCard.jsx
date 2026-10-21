import StatusBadge from '@/components/scheduling/StatusBadge';
import PostActionBar from '@/components/scheduling/PostActionBar';
import { CalendarClock, AlertTriangle, Sparkles } from 'lucide-react';

export default function ApprovalCard({ post, accounts, onChanged, onDeleted }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-space font-semibold truncate">{post.title || 'Untitled post'}</p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={post.status} />
            <span className="text-xs text-muted-foreground capitalize">{post.platform}</span>
            {post.scheduled_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                {post.scheduled_date} {post.scheduled_time || ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {post.hook && (
        <p className="text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">{post.hook}</p>
      )}

      <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{post.caption || 'No caption yet.'}</p>

      {post.status === 'failed' && post.publish_error && (
        <p className="text-xs text-destructive flex gap-1.5 bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {post.publish_error}
        </p>
      )}

      <div className="pt-1 border-t border-border">
        <PostActionBar post={post} accounts={accounts} onChanged={onChanged} onDeleted={onDeleted} />
      </div>

      {post.content_draft_id && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Promoted from a Content Studio draft
        </p>
      )}
    </div>
  );
}