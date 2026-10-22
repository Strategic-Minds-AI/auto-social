import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { BarChart3, Loader2, RefreshCw } from 'lucide-react';
import TopicPerformance from '@/components/analytics/TopicPerformance';
import PostPerformanceTable from '@/components/analytics/PostPerformanceTable';
import PageTrend from '@/components/analytics/PageTrend';

function formatCaptured(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Analytics() {
  const { business, ready } = useActiveBusiness();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [topics, setTopics] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [trend, setTrend] = useState([]);
  const [readings, setReadings] = useState(0);

  const load = useCallback(async () => {
    if (!business?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [topicAgg, postPage, trendPage, total] = await Promise.all([
        base44.entities.PostMetric.aggregate({
          query: { business_id: business.id, scope: 'post' },
          groupBy: 'topic',
          sum: ['views', 'engagements'],
        }),
        base44.entities.PostMetric.filter(
          { business_id: business.id, scope: 'post' },
          { sort: '-views', limit: 12 }
        ),
        base44.entities.PostMetric.filter(
          { business_id: business.id, scope: 'page_day' },
          { sort: 'metric_date', limit: 28 }
        ),
        base44.entities.PostMetric.count({ business_id: business.id }),
      ]);

      setTopics(
        (topicAgg?.rows || [])
          .filter((row) => row.topic)
          .sort((a, b) => (b.sum_views || 0) - (a.sum_views || 0))
      );
      setTopPosts(postPage.items || []);
      setTrend(trendPage.items || []);
      setReadings(total || 0);
    } finally {
      setLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  const latest = topPosts
    .map((post) => post.captured_at)
    .concat(trend.map((day) => day.captured_at))
    .filter(Boolean)
    .sort()
    .pop();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncPostMetrics', {});
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      toast({
        title: data.posts_stored ? `${data.posts_stored} posts read` : 'Nothing new to read',
        description:
          data.message ||
          `${data.days_stored || 0} days of Page numbers stored from ${data.synced_pages || 0} Page.`,
      });
      await load();
    } catch (error) {
      toast({
        title: 'The refresh did not finish',
        description: error?.response?.data?.error || error?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!business?.id) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-space font-semibold text-lg">No business yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Analytics follow the business you are working on.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-space text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business.name}
            {latest ? ` · read ${formatCaptured(latest)}` : ''}
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Reading Facebook' : 'Sync performance'}
        </Button>
      </div>

      {readings === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-space font-semibold mb-1">No performance data yet</p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Sync reads the numbers for the posts on your connected Facebook Page and files them against the topic each
            post was built on, so the best topics surface on their own. Publish a post, then sync.
          </p>
        </div>
      ) : (
        <>
          <TopicPerformance rows={topics} />
          <div className="grid gap-5 lg:grid-cols-2">
            <PostPerformanceTable posts={topPosts} />
            <PageTrend rows={trend} />
          </div>
        </>
      )}
    </div>
  );
}