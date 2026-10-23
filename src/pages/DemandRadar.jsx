import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Radar } from 'lucide-react';
import RadarControls from '@/components/radar/RadarControls';
import SignalCard from '@/components/radar/SignalCard';
import SourceStrip from '@/components/radar/SourceStrip';
import SimulationPanel from '@/components/radar/SimulationPanel';
import TopStylesPanel from '@/components/radar/TopStylesPanel';
import { fromSignal, KIND_LABEL } from '@/lib/libraryItems';

const FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'winners', label: 'Top videos' },
  { value: 'spikes', label: 'Search spikes' },
  { value: 'news', label: 'Live coverage' },
  { value: 'own', label: 'My own posts' },
];

const nicheKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function DemandRadar() {
  const { business, ready } = useActiveBusiness();
  const { toast } = useToast();
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('US');
  const [signals, setSignals] = useState([]);
  const [notes, setNotes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [savedIds, setSavedIds] = useState([]);
  const [scanSeq, setScanSeq] = useState(0);

  const loadSignals = useCallback(async (value) => {
    const key = nicheKey(value);
    if (!key) {
      setSignals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const page = await base44.entities.TrendSignal.filter(
        { niche_key: key },
        { sort: '-score', limit: 60 }
      );
      setSignals(page.items || []);
      setNotes([]);
    } catch {
      setSignals([]);
    } finally {
      setLoading(false);
      setScanSeq((count) => count + 1);
    }
  }, []);

  // Prefill from the active business, then show whatever that industry already has on file.
  useEffect(() => {
    if (!ready) return;
    const preset = industry.trim() || business?.industry || business?.name || '';
    if (!preset) {
      setLoading(false);
      return;
    }
    if (!industry.trim()) setIndustry(preset);
    loadSignals(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, business?.id, loadSignals]);

  const handleScan = async () => {
    const value = industry.trim();
    if (!value) return;
    setScanning(true);
    try {
      const response = await base44.functions.invoke('gatherDemandSignals', {
        industry: value,
        region,
        business_id: business?.id,
      });
      const payload = response.data || {};
      if (payload.error) throw new Error(payload.error);
      setSignals(payload.signals || []);
      setNotes(payload.notes || []);
      setFilter('all');
    } catch (error) {
      toast({
        title: 'The scan did not finish',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const counts = [
    {
      label: 'Top videos',
      value: signals.filter((s) => s.source === 'youtube_topic_search' || s.source === 'youtube_most_popular').length,
    },
    { label: 'Search spikes', value: signals.filter((s) => s.source === 'google_trends_rising').length },
    { label: 'Live coverage', value: signals.filter((s) => s.source === 'google_news_latest').length },
    { label: 'Your own posts', value: signals.filter((s) => s.source === 'own_channel').length },
  ];

  // One signal carries a hook, a look and an editing method. Keeping it puts all
  // three in the library, where the writer and the viral editor pick them up.
  const saveSignal = async (signal) => {
    const items = fromSignal(signal, business?.id);
    if (!items.length) {
      toast({
        title: 'Nothing to keep from that one',
        description: 'This signal carries no hook, look or editing method yet.',
      });
      return;
    }
    try {
      await base44.entities.LibraryItem.bulkCreate(items);
      setSavedIds((list) => [...list, signal.id]);
      toast({
        title: `${items.length} template${items.length > 1 ? 's' : ''} saved`,
        description: items.map((item) => KIND_LABEL[item.kind]).join(' · '),
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save that pattern', description: error.message });
    }
  };

  // The hottest live signal is the natural thing to test first; the owner can type over it.
  const topicSuggestion =
    (signals.find((signal) => signal.source === 'google_trends_rising') || signals[0])?.title || industry;

  const visible = signals.filter((signal) => {
    if (filter === 'winners') {
      return signal.source === 'youtube_topic_search' || signal.source === 'youtube_most_popular';
    }
    if (filter === 'spikes') return signal.source === 'google_trends_rising';
    if (filter === 'news') return signal.source === 'google_news_latest';
    if (filter === 'own') return signal.source === 'own_channel';
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <Radar className="w-6 h-6 text-primary" />
          Demand Radar
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What is winning in any industry right now, why it worked, and whether it can be made without a face.
        </p>
      </div>

      <RadarControls
        industry={industry}
        onIndustryChange={setIndustry}
        region={region}
        onRegionChange={setRegion}
        onScan={handleScan}
        scanning={scanning}
      />

      {notes.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-1">
          {notes.map((note) => (
            <p key={note} className="text-xs text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      )}

      {signals.length > 0 && <SourceStrip signals={signals} />}

      <SimulationPanel topicSuggestion={topicSuggestion} />

      {signals.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {counts.map((tile) => (
              <div key={tile.label} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="font-space font-bold text-xl mt-1">{tile.value}</p>
              </div>
            ))}
          </div>

          <TopStylesPanel
            nicheKey={nicheKey(industry)}
            businessId={business?.id}
            platform={business?.primary_platforms?.[0] || ''}
            scanSeq={scanSeq}
          />

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full border transition-colors',
                  filter === option.value
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

      {loading || scanning ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {scanning ? 'Reading the market — this takes a moment.' : 'Loading what is on file.'}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Radar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-space font-semibold">Nothing on file for this industry yet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Name the industry above and scan it. The radar reads what is winning there, along with your own numbers.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              saved={savedIds.includes(signal.id)}
              onSave={saveSignal}
            />
          ))}
        </div>
      )}
    </div>
  );
}