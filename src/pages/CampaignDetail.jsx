import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Loader2, Target, FileText, Image, Video, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ContentPieceCard from '@/components/content/ContentPieceCard';
import GenerateContentModal from '@/components/content/GenerateContentModal';

const GOAL_LABELS = {
  brand_awareness: 'Brand Awareness', lead_generation: 'Lead Generation',
  sales_conversion: 'Sales Conversion', community_engagement: 'Community Engagement',
  product_launch: 'Product Launch', event_promotion: 'Event Promotion', customer_retention: 'Customer Retention',
};

const PLATFORM_COLORS = {
  instagram: 'bg-pink-500/15 text-pink-400',
  facebook: 'bg-blue-500/15 text-blue-400',
  tiktok: 'bg-slate-500/15 text-slate-300',
  youtube: 'bg-red-500/15 text-red-400',
  google: 'bg-yellow-500/15 text-yellow-400',
};

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [business, setBusiness] = useState(null);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const load = async () => {
    const [camps] = await Promise.all([base44.entities.Campaign.filter({ id })]);
    const camp = camps[0];
    setCampaign(camp);
    if (camp?.business_id) {
      const [biz] = await base44.entities.Business.filter({ id: camp.business_id });
      setBusiness(biz);
    }
    const pieces = await base44.entities.ContentPiece.filter({ campaign_id: id }, '-created_date');
    setContent(pieces);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleGenerate = async (options) => {
    setGenerating(true);
    setShowGenerate(false);
    const { platform, type, count } = options;

    // Runs on the app's own AI gateway, not Base44 AI credits. The pieces are
    // created server-side, so the list is simply reloaded afterwards.
    await base44.functions.invoke('generateText', {
      task: 'campaign_content',
      campaign_id: id,
      platform,
      type,
      count,
    });
    await load();
    setGenerating(false);
  };

  const handleDelete = async (contentId) => {
    await base44.entities.ContentPiece.delete(contentId);
    setContent(c => c.filter(x => x.id !== contentId));
  };

  const TABS = ['all', 'post', 'story', 'reel', 'short_video', 'google_ad'];
  const filtered = activeTab === 'all' ? content : content.filter(c => c.type === activeTab);

  if (loading) return (
    <div className="p-10 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <button onClick={() => navigate('/campaigns')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Campaigns
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-space text-2xl font-bold mb-1">{campaign?.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {campaign?.goal && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-medium flex items-center gap-1">
                  <Target className="w-3 h-3" /> {GOAL_LABELS[campaign.goal]}
                </span>
              )}
              {campaign?.platforms?.map(p => (
                <span key={p} className={cn("text-xs px-2 py-0.5 rounded-full capitalize font-medium", PLATFORM_COLORS[p])}>
                  {p}
                </span>
              ))}
            </div>
            {campaign?.strategy && <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Strategy:</span> {campaign.strategy}</p>}
          </div>
          <Button
            onClick={() => setShowGenerate(true)}
            disabled={generating}
            className="bg-primary glow-purple-sm gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate Content'}
          </Button>
        </div>

        {campaign?.strategy_details && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1 uppercase tracking-wide">Strategy Overview</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{campaign.strategy_details}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-space font-semibold text-lg">Content Library <span className="text-muted-foreground text-sm font-normal ml-1">({content.length} pieces)</span></h2>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap capitalize",
                activeTab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
              )}>
              {t === 'all' ? 'All' : t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {generating && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-3 py-12 bg-card border border-primary/30 rounded-xl mb-4">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-muted-foreground">AI is crafting your content...</p>
        </motion.div>
      )}

      {filtered.length === 0 && !generating ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-xl">
          <Sparkles className="w-8 h-8 text-primary mb-3" />
          <p className="font-space font-semibold mb-1">No content yet</p>
          <p className="text-sm text-muted-foreground mb-4">Click "Generate Content" to create AI-powered social media content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((piece, i) => (
            <motion.div key={piece.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <ContentPieceCard piece={piece} onDelete={handleDelete} onUpdate={load} business={business} />
            </motion.div>
          ))}
        </div>
      )}

      {showGenerate && (
        <GenerateContentModal
          campaign={campaign}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </div>
  );
}