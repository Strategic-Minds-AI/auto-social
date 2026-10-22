import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { buildPipelineStages, summarizeStages } from '@/lib/pipelineStages';

const toCounts = (rows = []) =>
  (rows || []).reduce((acc, row) => {
    const key = row.status ?? row.group ?? row.key;
    if (key != null) acc[key] = row.count ?? 0;
    return acc;
  }, {});

// Every stage of the pipeline reads its own live evidence, in one parallel load.
export function usePipeline() {
  const { business, ready } = useActiveBusiness();
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState([]);
  const [summary, setSummary] = useState(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    if (!business?.id) {
      setStages([]);
      setSummary(null);
      setLoading(false);
      return;
    }

    const id = business.id;
    setLoading(true);
    try {
      const [
        dossierPage,
        topicCount,
        topicsUsed,
        topTopicPage,
        signalCount,
        latestSignalPage,
        simulationCount,
        latestSimulationPage,
        postAgg,
        nextScheduledPage,
        nextPlannedPage,
        lastPublishedPage,
        accountPage,
        videoPage,
        metricCount,
        latestMetricPage,
      ] = await Promise.all([
        base44.entities.BusinessDiscovery.filter({ business_id: id }, { sort: '-generated_at', limit: 1 }),
        base44.entities.TrendTopic.count({ business_id: id }),
        base44.entities.TrendTopic.count({ business_id: id, used: true }),
        base44.entities.TrendTopic.filter({ business_id: id }, { sort: '-interest', limit: 1 }),
        base44.entities.TrendSignal.count({ business_id: id }),
        base44.entities.TrendSignal.filter({ business_id: id }, { sort: '-captured_at', limit: 1 }),
        base44.entities.ContentSimulation.count({ business_id: id }),
        base44.entities.ContentSimulation.filter({ business_id: id }, { sort: '-created_date', limit: 1 }),
        base44.entities.ScheduledPost.aggregate({ query: { business_id: id }, groupBy: 'status' }),
        base44.entities.ScheduledPost.filter(
          { business_id: id, status: 'scheduled' },
          { sort: 'scheduled_at', limit: 1 }
        ),
        base44.entities.ScheduledPost.filter({ business_id: id, status: 'planned' }, { sort: 'scheduled_date', limit: 1 }),
        base44.entities.ScheduledPost.filter(
          { business_id: id, status: 'published' },
          { sort: '-published_at', limit: 1 }
        ),
        base44.entities.SocialAccount.filter({ business_id: id }, { limit: 50 }),
        base44.entities.VideoJob.filter({ business_id: id }, { limit: 100 }),
        base44.entities.PostMetric.count({ business_id: id }),
        base44.entities.PostMetric.filter({ business_id: id }, { sort: '-captured_at', limit: 1 }),
      ]);

      if (request !== requestRef.current) return;

      const built = buildPipelineStages(business, {
        dossier: (dossierPage?.items || [])[0] || null,
        topicCount,
        topicsUsed,
        topTopic: (topTopicPage?.items || [])[0] || null,
        signalCount,
        latestSignal: (latestSignalPage?.items || [])[0] || null,
        simulationCount,
        latestSimulation: (latestSimulationPage?.items || [])[0] || null,
        postStatus: toCounts(postAgg?.rows),
        nextScheduled: (nextScheduledPage?.items || [])[0] || null,
        nextPlanned: (nextPlannedPage?.items || [])[0] || null,
        lastPublished: (lastPublishedPage?.items || [])[0] || null,
        accounts: accountPage?.items || [],
        videos: videoPage?.items || [],
        metricCount,
        latestMetric: (latestMetricPage?.items || [])[0] || null,
      });

      setStages(built);
      setSummary(summarizeStages(built));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  return { business, ready, loading, stages, summary };
}