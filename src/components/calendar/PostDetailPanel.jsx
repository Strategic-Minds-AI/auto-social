import StatusBadge from '@/components/scheduling/StatusBadge';
import PostActionBar from '@/components/scheduling/PostActionBar';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';

// Post detail with its action bar. Shared by the Calendar page and the dashboard
// content-flow calendar so a post behaves identically wherever it is opened.
export default function PostDetailPanel({ post, accounts, onChanged, onDeleted, onClose }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-space font-semibold truncate">{post.title || 'Untitled post'}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge status={post.status} />
            <span className="text-xs text-muted-foreground capitalize">{post.platform}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {post.scheduled_at && (
        <p className="text-xs text-muted-foreground">
          Due {new Date(post.scheduled_at).toLocaleString()} ({post.timezone})
        </p>
      )}

      {post.hook && (
        <p className="text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">{post.hook}</p>
      )}

      <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-56 overflow-auto">
        {post.caption || 'No caption yet.'}
      </p>

      {post.publish_error && (
        <p className="text-xs text-destructive flex gap-1.5 bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {post.publish_error}
        </p>
      )}

      <div className="pt-3 border-t border-border">
        <PostActionBar post={post} accounts={accounts} onChanged={onChanged} onDeleted={onDeleted} />
      </div>

      {Array.isArray(post.publish_history) && post.publish_history.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">History</p>
          <div className="space-y-1.5 max-h-40 overflow-auto">
            {post.publish_history.slice().reverse().map((entry, i) => (
              <div key={i} className="text-xs text-muted-foreground">
                <span className="text-foreground">{entry.event}</span> · {new Date(entry.at).toLocaleString()}
                {entry.message ? <span className="block text-muted-foreground/80">{entry.message}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {post.published_url && (
        <a
          href={post.published_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary flex items-center gap-1.5 hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Open the live post
        </a>
      )}
    </div>
  );
}