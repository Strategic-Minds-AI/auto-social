import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { Film, Loader2, Play } from 'lucide-react';
import VideoJobCard from '@/components/video/VideoJobCard';

// The review surface for the video factory: everything the pipeline made from
// the next week of the content plan, with its tests and benchmark verdict.
export default function VideoStudio() {
  const { business, ready } = useActiveBusiness();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const load = useCallback(async (businessId) => {
    if (!businessId) {
      setJobs([]);
      setLoading(false);
      return;
    }
    const page = await base44.entities.VideoJob.filter({ business_id: businessId }, { sort: 'scheduled_date', limit: 50 });
    setJobs(page.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    base44.auth.me().then((me) => setUserEmail(me?.email || '')).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready) return;
    load(business?.id);
  }, [ready, business, load]);

  const build = async () => {
    setRunning(true);
    setNotice('');
    try {
      const planned = await base44.functions.invoke('planVideoBatch', { business_id: business.id });
      const processed = await base44.functions.invoke('processVideoBatch', { business_id: business.id });
      const p = planned.data || {};
      const c = processed.data || {};
      setNotice(
        `Briefed ${p.planned || 0} post(s), sent ${p.submitted || 0} to the video engine, stored ${c.stored || 0}, still rendering ${c.still_rendering || 0}, flagged ${c.flagged || 0}.`
      );
      await load(business.id);
    } catch (error) {
      setNotice(error?.message || 'The video factory could not run.');
    } finally {
      setRunning(false);
    }
  };

  const review = async (job, status) => {
    setBusy(true);
    try {
      await base44.entities.VideoJob.update(job.id, {
        status,
        reviewed_by: userEmail,
        reviewed_at: new Date().toISOString(),
      });
      setJobs((prev) => prev.map((entry) => (entry.id === job.id ? { ...entry, status } : entry)));
    } finally {
      setBusy(false);
    }
  };

  const retry = async (job) => {
    setBusy(true);
    try {
      await base44.entities.VideoJob.update(job.id, {
        status: 'queued',
        gateway_video_id: '',
        video_url: '',
        tests: [],
        scores: [],
        score_total: 0,
        benchmark_passed: false,
        safety_ok: false,
        qa_summary: '',
        last_error: '',
      });
      setJobs((prev) =>
        prev.map((entry) => (entry.id === job.id ? { ...entry, status: 'queued', video_url: '', score_total: 0 } : entry))
      );
    } finally {
      setBusy(false);
    }
  };

  const estimatedCredits = jobs.reduce((sum, job) => sum + (Number(job.estimated_credits) || 0), 0);

  const counts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  if (loading && ready) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <Film className="w-10 h-10 text-primary mx-auto mb-4" />
        <h1 className="font-space text-2xl font-bold mb-2">Add a business first</h1>
        <p className="text-muted-foreground">The video factory builds from a business's content plan.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-space text-3xl font-bold">Video Studio</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Every video is built from a post in the next 7 days of your content plan, tested, scored against the
            benchmark, and stored here for you before anything publishes.
          </p>
        </div>
        <Button onClick={build} disabled={running || !business}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Build this week's videos
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {[
          ['Waiting', counts.queued || 0],
          ['Rendering', (counts.generating || 0) + (counts.scoring || 0)],
          ['Passed', counts.passed || 0],
          ['Below benchmark', counts.flagged || 0],
          ['Approved', counts.approved || 0],
          ['Failed', counts.failed || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="ml-2 font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {estimatedCredits > 0 && (
        <p className="text-xs text-muted-foreground">
          Estimated engine cost for the clips shown: {estimatedCredits.toLocaleString()} integration credits.
        </p>
      )}

      {notice && <p className="text-sm text-muted-foreground rounded-lg border border-border bg-surface-2 p-3">{notice}</p>}

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Film className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No videos yet</p>
          <p className="text-sm text-muted-foreground">
            Once your content plan has posts in the next 7 days, the factory runs on its own every 20 minutes.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <VideoJobCard key={job.id} job={job} onReview={review} onRetry={retry} busy={busy} />
          ))}
        </div>
      )}
    </div>
  );
}