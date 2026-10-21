import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, Target, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBusinessStore } from '@/lib/businessStore';
import { cn } from '@/lib/utils';

const GOALS = [
  { id: 'brand_awareness', label: 'Brand Awareness', desc: 'Reach new audiences and grow visibility', emoji: '📢' },
  { id: 'lead_generation', label: 'Lead Generation', desc: 'Capture potential customer info', emoji: '🎯' },
  { id: 'sales_conversion', label: 'Sales Conversion', desc: 'Drive direct purchases and revenue', emoji: '💰' },
  { id: 'community_engagement', label: 'Community Engagement', desc: 'Build loyal followers and community', emoji: '❤️' },
  { id: 'product_launch', label: 'Product Launch', desc: 'Announce and promote a new product', emoji: '🚀' },
  { id: 'event_promotion', label: 'Event Promotion', desc: 'Drive attendance to an event', emoji: '📅' },
  { id: 'customer_retention', label: 'Customer Retention', desc: 'Re-engage existing customers', emoji: '🔄' },
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  { id: 'facebook', label: 'Facebook', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  { id: 'youtube', label: 'YouTube Shorts', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  { id: 'google', label: 'Google Ads', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
];

const STRATEGIES = [
  { id: 'content_marketing', label: 'Content Marketing', desc: 'Educate and entertain with valuable content to build authority' },
  { id: 'social_proof', label: 'Social Proof', desc: 'Leverage reviews, testimonials and user-generated content' },
  { id: 'storytelling', label: 'Brand Storytelling', desc: 'Connect emotionally through behind-the-scenes and brand narrative' },
  { id: 'promotional', label: 'Promotional Blitz', desc: 'Offers, discounts and urgency-driven posts to drive action' },
  { id: 'influencer_style', label: 'Influencer-Style', desc: 'Relatable, personality-driven content with trending hooks' },
  { id: 'educational', label: 'Educational Series', desc: 'Position as an expert with tips, how-tos and tutorials' },
];

export default function CampaignWizard() {
  const navigate = useNavigate();
  const { activeBusiness } = useBusinessStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [aiStrategies, setAiStrategies] = useState([]);
  const [generatingStrategies, setGeneratingStrategies] = useState(false);
  const [saving, setSaving] = useState(false);

  const togglePlatform = (id) => {
    setSelectedPlatforms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const generateStrategies = async () => {
    setGeneratingStrategies(true);
    setStep(2);
    const goal = GOALS.find(g => g.id === selectedGoal);
    const result = await base44.functions.invoke('generateText', {
      task: 'campaign_strategies',
      business_id: activeBusiness.id,
      goal: selectedGoal,
      platforms: selectedPlatforms,
    });
    setAiStrategies(result.data?.strategies || []);
    setGeneratingStrategies(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const strategy = aiStrategies.find(s => s.name === selectedStrategy);
    const campaign = await base44.entities.Campaign.create({
      business_id: activeBusiness.id,
      name,
      goal: selectedGoal,
      platforms: selectedPlatforms,
      strategy: selectedStrategy,
      strategy_details: strategy ? `${strategy.approach}\n\nKey Tactics:\n${strategy.tactics?.map(t => `• ${t}`).join('\n')}\n\nExpected Outcome: ${strategy.outcome}` : '',
      status: 'planning',
      start_date: new Date().toISOString().split('T')[0],
    });
    setSaving(false);
    navigate(`/campaigns/${campaign.id}`);
  };

  if (!activeBusiness) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">Please select a business first.</p>
        <Button onClick={() => navigate('/businesses')} className="mt-4">Go to Businesses</Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <button onClick={() => navigate('/campaigns')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Campaigns
      </button>

      <h1 className="font-space text-3xl font-bold mb-1">New Campaign</h1>
      <p className="text-muted-foreground mb-8">For <span className="text-primary font-medium">{activeBusiness.name}</span></p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['Name & Platforms', 'Choose Goal', 'Select Strategy'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              step > i ? "bg-primary text-primary-foreground" : step === i ? "bg-primary/20 text-primary border border-primary" : "bg-secondary text-muted-foreground"
            )}>
              {step > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={cn("text-xs hidden sm:block", step === i ? "text-foreground font-medium" : "text-muted-foreground")}>{label}</span>
            {i < 2 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0: Name + Platforms */}
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-card border border-border rounded-xl p-6 space-y-6">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Launch 2025" className="bg-input" />
              </div>
              <div className="space-y-3">
                <Label>Target Platforms</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PLATFORMS.map(p => (
                    <button key={p.id} onClick={() => togglePlatform(p.id)}
                      className={cn("px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                        selectedPlatforms.includes(p.id) ? `${p.color} border-current` : "border-border text-muted-foreground hover:border-primary/30"
                      )}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setStep(1)} disabled={!name || selectedPlatforms.length === 0} className="bg-primary gap-2">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 1: Goal */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {GOALS.map(g => (
                <button key={g.id} onClick={() => setSelectedGoal(g.id)}
                  className={cn("text-left p-4 rounded-xl border transition-all",
                    selectedGoal === g.id ? "border-primary bg-primary/10 glow-primary-sm" : "border-border bg-card hover:border-primary/40"
                  )}>
                  <div className="text-2xl mb-2">{g.emoji}</div>
                  <div className="font-space font-semibold text-sm mb-1">{g.label}</div>
                  <div className="text-xs text-muted-foreground">{g.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button onClick={generateStrategies} disabled={!selectedGoal} className="bg-primary gap-2">
                <Sparkles className="w-4 h-4" /> Generate Strategies
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Strategy */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {generatingStrategies ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-muted-foreground">Generating tailored strategies...</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {aiStrategies.map((s, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => setSelectedStrategy(s.name)}
                      className={cn("w-full text-left p-5 rounded-xl border transition-all",
                        selectedStrategy === s.name ? "border-primary bg-primary/10 glow-primary-sm" : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="font-space font-semibold mb-1">{s.name}</div>
                      <p className="text-sm text-muted-foreground mb-3">{s.approach}</p>
                      <ul className="space-y-1">
                        {s.tactics?.map((t, ti) => (
                          <li key={ti} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-primary">•</span> {t}
                          </li>
                        ))}
                      </ul>
                      {s.outcome && <p className="text-xs text-primary mt-3 font-medium">📈 {s.outcome}</p>}
                    </motion.button>
                  ))}
                </div>
                <div className="flex justify-between mt-6">
                  <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                  <Button onClick={handleSave} disabled={!selectedStrategy || saving} className="bg-primary glow-primary-sm gap-2 min-w-36">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {saving ? 'Creating...' : 'Create Campaign'}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}