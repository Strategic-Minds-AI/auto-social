import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useBusinessStore } from '@/lib/businessStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PipelineStatus from '@/components/onboarding/PipelineStatus';

const TONES = ['professional', 'casual', 'playful', 'luxury', 'inspirational', 'educational'];
const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x'];

// The ten questions every business is onboarded with. Each answer feeds either
// the skip trace or the topic research, so nothing here is decoration.
const STEPS = [
  { key: 'name', label: 'What is the business called?', hint: 'Exactly as your customers know it.', type: 'text', placeholder: 'Luxe Coffee Co.' },
  { key: 'website', label: 'What is your website address?', hint: 'Your real page is fetched during the skip trace.', type: 'text', placeholder: 'https://yourbusiness.com' },
  { key: 'industry', label: 'What industry are you in?', hint: 'Name the niche, not just the sector.', type: 'text', placeholder: 'Specialty coffee retail' },
  { key: 'services', label: 'What do you sell?', hint: 'One service or product per line. Specific answers make sharper topics.', type: 'textarea', placeholder: 'Single-origin beans\nBarista training\nCafe fit-outs' },
  { key: 'target_audience', label: 'Who is your ideal customer?', hint: 'Who they are, and what they care about.', type: 'textarea', placeholder: 'Home baristas aged 25-45 who buy beans monthly' },
  { key: 'service_area', label: 'Where do you serve customers?', hint: 'City, region or country. This drives local and seasonal topics.', type: 'text', placeholder: 'Greater Boston, Massachusetts' },
  { key: 'differentiators', label: 'What makes you different?', hint: 'The honest reason someone picks you over the shop down the road.', type: 'textarea', placeholder: 'We roast in-house every Tuesday and publish the cupping scores' },
  { key: 'tone', label: 'How should the content sound?', hint: 'Every caption is written in this voice.', type: 'select', options: TONES, default: 'professional' },
  { key: 'primary_platforms', label: 'Where do you want to post?', hint: 'Plans default to the platforms you pick here.', type: 'multi', options: PLATFORMS, default: ['instagram', 'facebook'] },
  { key: 'primary_goal', label: 'What should this achieve?', hint: 'The outcome the content is pointed at.', type: 'select', options: ['More leads and enquiries', 'More bookings and appointments', 'More online sales', 'More foot traffic', 'Brand awareness', 'Customer retention'], default: 'More leads and enquiries' },
];

const STAGES = [
  { key: 'profile', label: 'Saving your business profile' },
  { key: 'discovery', label: 'Skip tracing the company, industry and services' },
  { key: 'topics', label: 'Ranking what your market searches for' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { setActiveBusiness } = useBusinessStore();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() =>
    STEPS.reduce((acc, s) => ({ ...acc, [s.key]: s.default ?? (s.type === 'multi' ? [] : '') }), {})
  );
  const [phase, setPhase] = useState('questions');
  const [stages, setStages] = useState(STAGES.map((s) => ({ ...s, state: 'pending', note: '' })));
  const [outcome, setOutcome] = useState(null);

  const current = STEPS[step];
  const value = answers[current.key];

  const patch = (key, val) => setAnswers((prev) => ({ ...prev, [key]: val }));
  const setStage = (key, state, note = '') =>
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, state, note } : s)));

  const togglePlatform = (platform) =>
    patch('primary_platforms', value.includes(platform) ? value.filter((p) => p !== platform) : [...value, platform]);

  const canAdvance = current.key !== 'name' || String(value).trim().length > 1;

  const finish = async () => {
    setPhase('running');
    setStage('profile', 'running');

    const business = await base44.entities.Business.create({
      ...answers,
      name: String(answers.name).trim(),
      onboarded_at: new Date().toISOString(),
    });
    setActiveBusiness(business);
    setStage('profile', 'done', 'Profile saved');

    let discovery = null;
    let topics = [];

    setStage('discovery', 'running');
    const trace = await base44.functions.invoke('researchBusiness', { business_id: business.id });
    if (trace.data?.error) {
      setStage('discovery', 'failed', trace.data.error);
    } else {
      discovery = trace.data?.results?.[0]?.discovery || null;
      setStage('discovery', 'done', trace.data?.results?.[0]?.website_note || 'Dossier built');
    }

    setStage('topics', 'running');
    const trends = await base44.functions.invoke('researchTrends', { business_id: business.id });
    if (trends.data?.error) {
      setStage('topics', 'failed', trends.data.error);
    } else {
      topics = trends.data?.results?.[0]?.topics || [];
      setStage('topics', 'done', trends.data?.results?.[0]?.trend_note || `${topics.length} topics ranked`);
    }

    setOutcome({ business, discovery, topics });
    setPhase('done');
  };

  if (phase === 'running' || phase === 'done') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-card border border-border rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            {phase === 'done' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            )}
            <div>
              <h1 className="font-space font-bold text-xl">
                {phase === 'done' ? 'Your content engine is ready' : 'Building your content engine'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {phase === 'done'
                  ? outcome?.business?.name
                  : 'Reading your site, researching the market and ranking topics.'}
              </p>
            </div>
          </div>

          <PipelineStatus stages={stages} />

          {phase === 'done' && (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground pt-2">
                {outcome?.topics?.length
                  ? `${outcome.topics.length} topics ranked. Top three: ${outcome.topics.slice(0, 3).map((t) => t.topic).join(', ')}.`
                  : 'No topics were ranked. You can run the research again from the Intelligence page.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => navigate('/intelligence')} className="gap-2">
                  <Sparkles className="w-4 h-4" /> Open Intelligence
                </Button>
                <Button variant="outline" onClick={() => navigate('/auto-social')}>
                  Build the 30-day plan
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-secondary')}
            />
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-5">
          <p className="text-xs text-muted-foreground font-medium">
            Question {step + 1} of {STEPS.length}
          </p>

          <div className="space-y-1">
            <h1 className="font-space font-bold text-xl">{current.label}</h1>
            {current.hint && <p className="text-sm text-muted-foreground">{current.hint}</p>}
          </div>

          <div className="space-y-2">
            <Label className="sr-only">{current.label}</Label>
            {current.type === 'textarea' && (
              <Textarea
                value={value}
                onChange={(e) => patch(current.key, e.target.value)}
                placeholder={current.placeholder}
                className="bg-input h-28 resize-none"
              />
            )}
            {current.type === 'text' && (
              <Input
                value={value}
                onChange={(e) => patch(current.key, e.target.value)}
                placeholder={current.placeholder}
                className="bg-input"
              />
            )}
            {current.type === 'select' && (
              <Select value={value} onValueChange={(v) => patch(current.key, v)}>
                <SelectTrigger className="bg-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {current.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {current.type === 'multi' && (
              <div className="flex flex-wrap gap-2">
                {current.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => togglePlatform(opt)}
                    className={cn(
                      'px-4 py-2 rounded-lg border text-sm capitalize transition-colors',
                      value.includes(opt)
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance} className="gap-2">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={!String(answers.name).trim()} className="gap-2 glow-primary-sm">
                <Sparkles className="w-4 h-4" /> Build my engine
              </Button>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}