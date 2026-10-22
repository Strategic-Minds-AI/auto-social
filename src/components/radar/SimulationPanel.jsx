import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookmarkPlus, FlaskConical, Loader2, Trophy } from 'lucide-react';
import VariantCard from '@/components/radar/VariantCard';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

const FORMATS = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'short_video', label: 'Short video' },
  { value: 'story', label: 'Story' },
  { value: 'image', label: 'Image' },
];

export default function SimulationPanel({ topicSuggestion }) {
  const { business } = useActiveBusiness();
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('reel');
  const [edited, setEdited] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulation, setSimulation] = useState(null);

  // The hottest live signal is the natural thing to test first; typing takes over.
  useEffect(() => {
    if (!edited && topicSuggestion) setTopic(topicSuggestion);
  }, [topicSuggestion, edited]);

  const run = async () => {
    if (!business?.id || !topic.trim()) return;
    setRunning(true);
    try {
      const response = await base44.functions.invoke('simulateContentVariants', {
        business_id: business.id,
        topic: topic.trim(),
        platform,
        format,
      });
      const payload = response.data || {};
      if (payload.error) throw new Error(payload.error);
      setSimulation(payload.simulation);
    } catch (error) {
      toast({ title: 'The simulation did not finish', description: error.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const saveWinner = async () => {
    if (!simulation || !business?.id) return;
    const winner = simulation.variants?.[0];
    if (!winner) return;
    setSaving(true);
    try {
      await base44.entities.ContentDraft.create({
        business_id: business.id,
        platform: simulation.platform,
        format: simulation.format,
        source: 'variation',
        brief: simulation.topic,
        tone: simulation.tone || business.tone,
        audience: simulation.audience || business.target_audience,
        title: winner.label,
        hook: winner.hook,
        caption: winner.caption,
        hashtags: winner.hashtags,
        call_to_action: winner.call_to_action,
        status: 'draft',
        ai_provider: simulation.engine || '',
        ai_model: simulation.model || '',
      });
      toast({
        title: 'Winning version saved',
        description: 'It is in Content Studio as a draft, ready to review.',
      });
    } catch (error) {
      toast({ title: 'The draft was not saved', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <FlaskConical className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-space font-semibold">Angle simulator</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Writes several different versions of one idea, scores each against the live market data and your own
            measured results, then names the version most likely to earn engagement and growth.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Topic or idea to test</label>
          <Input
            value={topic}
            onChange={(event) => {
              setEdited(true);
              setTopic(event.target.value);
            }}
            placeholder="e.g. Why most businesses waste their first AI budget"
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="text-xs text-muted-foreground">Channel</label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-36">
          <label className="text-xs text-muted-foreground">Format</label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={run} disabled={running || !topic.trim() || !business?.id}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
          {running ? 'Simulating' : 'Run simulation'}
        </Button>
      </div>

      {!business?.id && (
        <p className="text-xs text-muted-foreground">
          Pick a business first so the simulation can judge against its audience, tone and results.
        </p>
      )}

      {running && (
        <p className="text-xs text-muted-foreground">
          Writing the versions, then scoring each one against the evidence above.
        </p>
      )}

      {simulation && !running && (
        <div className="space-y-4">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <Trophy className="w-5 h-5 text-primary" />
            <div className="flex-1 min-w-[220px]">
              <p className="text-xs text-muted-foreground">Most likely to win</p>
              <p className="font-space font-semibold">{simulation.winner_label}</p>
              <p className="text-sm italic text-foreground/90 mt-1">“{simulation.winner_hook}”</p>
            </div>
            <div className="text-right">
              <p className="font-space font-bold text-2xl text-primary">{simulation.winner_score}/100</p>
              <p className="text-xs text-muted-foreground">
                judged on {simulation.signal_count} live signals and {simulation.metric_count} measured posts
              </p>
            </div>
            <Button variant="outline" onClick={saveWinner} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
              Save winning version as a draft
            </Button>
          </div>

          {simulation.rubric && <p className="text-xs text-muted-foreground">How it ranked: {simulation.rubric}</p>}

          <div className="grid gap-4 lg:grid-cols-2">
            {simulation.variants.map((variant, index) => (
              <VariantCard key={variant.label} variant={variant} isWinner={index === 0} rank={index + 1} />
            ))}
          </div>

          {Array.isArray(simulation.evidence) && simulation.evidence.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2">Evidence this ran on</p>
              <ul className="space-y-1">
                {simulation.evidence.map((row, index) => (
                  <li key={`${row.label}-${index}`} className="text-xs text-muted-foreground">
                    <span className="text-foreground">{row.label}:</span> {row.detail}
                    {row.metric ? ` — ${row.metric}` : ''}
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer" className="text-primary ml-1">
                        source
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}