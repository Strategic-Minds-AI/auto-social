import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Plus, Megaphone, Target, Calendar, ArrowRight, Trash2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useBusinessStore } from '@/lib/businessStore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const GOAL_LABELS = {
  brand_awareness: 'Brand Awareness',
  lead_generation: 'Lead Generation',
  sales_conversion: 'Sales Conversion',
  community_engagement: 'Community Engagement',
  product_launch: 'Product Launch',
  event_promotion: 'Event Promotion',
  customer_retention: 'Customer Retention',
};

const GOAL_COLORS = {
  brand_awareness: 'text-blue-400 bg-blue-400/10',
  lead_generation: 'text-emerald-400 bg-emerald-400/10',
  sales_conversion: 'text-yellow-400 bg-yellow-400/10',
  community_engagement: 'text-pink-400 bg-pink-400/10',
  product_launch: 'text-purple-400 bg-purple-400/10',
  event_promotion: 'text-orange-400 bg-orange-400/10',
  customer_retention: 'text-cyan-400 bg-cyan-400/10',
};

const STATUS_COLORS = {
  planning: 'text-muted-foreground bg-secondary',
  active: 'text-emerald-400 bg-emerald-400/10',
  paused: 'text-yellow-400 bg-yellow-400/10',
  completed: 'text-blue-400 bg-blue-400/10',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeBusiness } = useBusinessStore();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const filter = activeBusiness ? { business_id: activeBusiness.id } : {};
    const data = await base44.entities.Campaign.filter(filter, '-created_date');
    setCampaigns(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeBusiness]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Campaign.delete(id);
    load();
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-space text-3xl font-bold">Campaigns</h1>
          {activeBusiness && <p className="text-muted-foreground mt-1">For <span className="text-primary font-medium">{activeBusiness.name}</span></p>}
        </div>
        {activeBusiness && (
          <Button onClick={() => navigate('/campaigns/new')} className="bg-primary hover:bg-primary/90 glow-primary-sm gap-2">
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        )}
      </div>

      {!activeBusiness ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-space text-xl font-semibold mb-2">Select a Business First</h3>
          <p className="text-muted-foreground mb-6">Choose a business from the sidebar switcher to view its campaigns.</p>
          <Button onClick={() => navigate('/businesses')} variant="outline">Go to Businesses</Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-44 rounded-xl bg-card animate-pulse border border-border" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-space text-xl font-semibold mb-2">No campaigns yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Create your first AI-powered campaign for {activeBusiness.name}.</p>
          <Button onClick={() => navigate('/campaigns/new')} className="bg-primary gap-2">
            <Plus className="w-4 h-4" /> Create First Campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="group bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-all duration-200 cursor-pointer"
              onClick={() => navigate(`/campaigns/${c.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-space font-semibold text-foreground">{c.name}</h3>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[c.status])}>
                      {c.status}
                    </span>
                  </div>
                </div>
                <button onClick={(e) => handleDelete(c.id, e)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {c.goal && (
                <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium mb-3", GOAL_COLORS[c.goal])}>
                  <Target className="w-3 h-3" />
                  {GOAL_LABELS[c.goal]}
                </span>
              )}

              {c.platforms?.length > 0 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {c.platforms.map(p => (
                    <span key={p} className="text-xs px-2 py-0.5 bg-secondary rounded-md text-muted-foreground capitalize">{p}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {c.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(c.start_date), 'MMM d, yyyy')}</span>}
                <span className="flex items-center gap-1 text-primary font-medium">View Campaign <ArrowRight className="w-3 h-3" /></span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}