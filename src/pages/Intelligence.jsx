import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { Loader2, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import DiscoveryPanel from '@/components/intelligence/DiscoveryPanel';
import TopicList from '@/components/intelligence/TopicList';
import PromptTransformer from '@/components/intelligence/PromptTransformer';

const TABS = [
  { key: 'discovery', label: 'Discovery' },
  { key: 'topics', label: 'Top topics' },
  { key: 'transformer', label: 'Prompt transformer' },
];

export default function Intelligence() {
  const { business, ready } = useActiveBusiness();
  const [tab, setTab] = useState('discovery');
  const [discovery, setDiscovery] = useState(null);
  const [topics, setTopics] = useState([]);
  const [geo, setGeo] = useState('US');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!business?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [discoveryPage, topicPage] = await Promise.all([
        base44.entities.BusinessDiscovery.filter({ business_id: business.id }, { limit: 1 }),
        base44.entities.TrendTopic.filter({ business_id: business.id }, { sort: 'rank', limit: 30 }),
      ]);
      setDiscovery((discoveryPage.items || [])[0] || null);
      setTopics(topicPage.items || []);
    } finally {
      setLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  const runDiscovery = async () => {
    setRunning('discovery');
    setNote('');
    const res = await base44.functions.invoke('researchBusiness', { business_id: business.id });
    setRunning('');
    if (res.data?.error) setNote(res.data.error);
    else setDiscovery(res.data?.results?.[0]?.discovery || null);
  };

  const runTopics = async () => {
    setRunning('topics');
    setNote('');
    const res = await base44.functions.invoke('researchTrends', { business_id: business.id, geo });
    setRunning('');
    if (res.data?.error) setNote(res.data.error);
    else {
      setTopics(res.data?.results?.[0]?.topics || []);
      setNote(res.data?.results?.[0]?.trend_note || '');
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
          <Compass className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-space font-semibold text-lg">No business yet</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            The research engine works on a business. Onboard one and it will skip trace it for you.
          </p>
          <Button asChild>
            <Link to="/onboarding">Start guided onboarding</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-space font-bold text-2xl">Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The research behind every post generated for {business.name}.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {note && <p className="text-sm text-muted-foreground rounded-lg border border-border bg-surface-2 p-3">{note}</p>}

      {running && (
        <p className="text-xs text-primary flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {running === 'discovery' ? 'Skip tracing the company...' : 'Ranking what your market searches for...'}
        </p>
      )}

      {tab === 'discovery' && (
        <DiscoveryPanel discovery={discovery} running={running === 'discovery'} onRun={runDiscovery} />
      )}

      {tab === 'topics' && (
        <TopicList
          topics={topics}
          running={running === 'topics'}
          onRefresh={runTopics}
          geo={geo}
          setGeo={setGeo}
          note={note}
        />
      )}

      {tab === 'transformer' && <PromptTransformer business={business} />}
    </div>
  );
}