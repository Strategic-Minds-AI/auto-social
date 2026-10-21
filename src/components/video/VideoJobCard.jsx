import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, RotateCcw, X } from 'lucide-react';
import VideoScorePanel from './VideoScorePanel';

const STATUS = {
  queued: { label: 'Queued', cls: 'bg-secondary text-muted-foreground border-border' },
  generating: { label: 'Rendering', cls: 'bg-primary/15 text-primary border-primary/30' },
  scoring: { label: 'Scoring', cls: 'bg-primary/20 text-primary border-primary/40' },
  passed: { label: 'Passed QA', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  flagged: { label: 'Below benchmark', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  rejected: { label: 'Rejected', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  failed: { label: 'Failed', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-secondary text-muted-foreground border-border' },
};

export default function VideoJobCard({ job, onReview, onRetry, busy }) {
  const style = STATUS[job.status] || STATUS.queued;
  const reviewable = job.video_url && ['passed', 'flagged', 'approved', 'rejected'].includes(job.status);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-space font-semibold">{job.post_title || 'Scheduled post'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {job.scheduled_date} · {job.platform} {job.format} · {job.seconds}s {job.aspect_ratio}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', style.cls)}>{style.label}</span>
            {typeof job.score_total === 'number' && job.score_total > 0 && (
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full border font-semibold tabular-nums',
                  job.benchmark_passed
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                )}
              >
                {job.score_total}/{job.benchmark_target}
              </span>
            )}
          </div>
        </div>

        {job.video_url ? (
          <video src={job.video_url} controls className="w-full rounded-lg bg-black aspect-video" />
        ) : (
          <div className="w-full rounded-lg bg-secondary flex items-center justify-center py-10 text-xs text-muted-foreground">
            {job.status === 'failed' ? job.last_error || 'This video failed.' : 'Video not stored yet.'}
          </div>
        )}

        {job.qa_summary && (
          <div className="rounded-lg bg-surface-2 border border-border p-3">
            <p className="text-xs text-muted-foreground">{job.qa_summary}</p>
          </div>
        )}

        <VideoScorePanel job={job} />

        {(reviewable || ['failed', 'rejected', 'flagged'].includes(job.status)) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {reviewable && (
              <>
                <Button size="sm" onClick={() => onReview(job, 'approved')} disabled={busy}>
                  <Check className="w-3.5 h-3.5" /> Approve video
                </Button>
                <Button size="sm" variant="outline" onClick={() => onReview(job, 'rejected')} disabled={busy}>
                  <X className="w-3.5 h-3.5" /> Reject
                </Button>
              </>
            )}
            {['failed', 'rejected', 'flagged'].includes(job.status) && (
              <Button size="sm" variant="ghost" onClick={() => onRetry(job)} disabled={busy}>
                <RotateCcw className="w-3.5 h-3.5" /> Rebuild video
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}