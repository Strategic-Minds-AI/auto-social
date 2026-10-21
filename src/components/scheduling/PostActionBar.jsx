import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Check, CalendarClock, Ban, RotateCcw, Send, AlertTriangle, ExternalLink } from 'lucide-react';
import ScheduleModal from './ScheduleModal';

// All status transitions for one post live here so the calendar and the approval
// queue behave identically. Publishing is always a deliberate, confirmed action.
export default function PostActionBar({ post, accounts = [], onChanged, onDeleted }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const act = async (action, extra = {}) => {
    setBusy(action);
    setError('');
    try {
      await base44.functions.invoke('manageScheduledPost', { action, post_id: post.id, ...extra });
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    } finally {
      setBusy('');
      setConfirming(false);
    }
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await base44.entities.ScheduledPost.delete(post.id);
      onDeleted?.(post.id);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const btn = (label, action, Icon, extra = {}, variant = 'outline') => (
    <Button
      size="sm"
      variant={variant}
      disabled={Boolean(busy)}
      onClick={() => act(action, extra)}
      className="gap-1.5"
    >
      {busy === action ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {post.status === 'planned' && btn('Approve', 'approve', Check, {}, 'default')}
        {post.status === 'planned' && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowSchedule(true)} disabled={Boolean(busy)}>
            <CalendarClock className="w-3.5 h-3.5" /> Schedule
          </Button>
        )}

        {post.status === 'approved' && (
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => setShowSchedule(true)} disabled={Boolean(busy)}>
            <CalendarClock className="w-3.5 h-3.5" /> Schedule
          </Button>
        )}

        {post.status === 'scheduled' && (
          <>
            {btn('Publish now', 'publish_now', Send, {}, 'default')}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowSchedule(true)} disabled={Boolean(busy)}>
              <CalendarClock className="w-3.5 h-3.5" /> Reschedule
            </Button>
          </>
        )}

        {post.status === 'failed' && (
          <>
            {btn('Retry', 'retry', RotateCcw, {}, 'default')}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowSchedule(true)} disabled={Boolean(busy)}>
              <CalendarClock className="w-3.5 h-3.5" /> Reschedule
            </Button>
          </>
        )}

        {['approved', 'scheduled', 'failed'].includes(post.status) && btn('Back to review', 'reopen', RotateCcw)}
        {['planned', 'approved', 'scheduled', 'failed'].includes(post.status) && btn('Cancel post', 'cancel', Ban)}
        {post.status !== 'published' && (
          <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={remove} className="text-muted-foreground hover:text-destructive">
            {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete'}
          </Button>
        )}

        {post.status === 'published' && post.published_url && (
          <a href={post.published_url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> View on Facebook
            </Button>
          </a>
        )}
      </div>

      {confirming && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-3">
          <p className="text-sm text-amber-300 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            This publishes to Facebook immediately and cannot be undone from here.
          </p>
          <div className="text-xs text-muted-foreground">
            Page: <span className="text-foreground">{accounts.find((a) => a.id === post.social_account_id)?.name || 'not linked'}</span>
            <br />
            Post: <span className="text-foreground line-clamp-2">{post.caption || post.title}</span>
          </div>
          <div className="flex gap-2">
            {btn('Yes, publish now', 'publish_now', Send, {}, 'default')}
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Not yet</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showSchedule && (
        <ScheduleModal post={post} accounts={accounts} onClose={() => setShowSchedule(false)} onSaved={onChanged} />
      )}

      {post.status === 'scheduled' && !confirming && (
        <p className="text-xs text-muted-foreground">
          "Publish now" asks for confirmation before it sends anything.
        </p>
      )}
    </div>
  );
}