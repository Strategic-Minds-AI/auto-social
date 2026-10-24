import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useBusinessStore } from '@/lib/businessStore';
import { Loader2, Sparkles, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ContentPieceCard from '@/components/content/ContentPieceCard';

const PLATFORM_TABS = ['all', 'instagram', 'facebook', 'tiktok', 'youtube', 'google'];

export default function Content() {
  const [content, setContent] = useState([]);
  const [businesses, setBusinesses] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { activeBusiness } = useBusinessStore();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const filter = activeBusiness ? { business_id: activeBusiness.id } : {};
    const pieces = await base44.entities.ContentPiece.filter(filter, '-created_date', 50);
    setContent(pieces);

    // Load businesses for cards
    const bizIds = [...new Set(pieces.map(p => p.business_id).filter(Boolean))];
    const bizMap = {};
    await Promise.all(bizIds.map(async bid => {
      const [b] = await base44.entities.Business.filter({ id: bid });
      if (b) bizMap[bid] = b;
    }));
    setBusinesses(bizMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeBusiness]);

  const filtered = activeTab === 'all' ? content : content.filter(c => c.platform === activeTab);

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-space text-3xl font-bold">Content Pieces</h1>
          {activeBusiness && <p className="text-muted-foreground mt-1">All content for <span className="text-primary font-medium">{activeBusiness.name}</span></p>}
        </div>
        <Button onClick={() => navigate('/campaigns')} variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
          <Sparkles className="w-4 h-4" /> Go to Campaigns
        </Button>
      </div>

      {/* Platform filter */}
      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 mb-6 overflow-x-auto">
        {PLATFORM_TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap capitalize",
              activeTab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === 'all' ? 'All Platforms' : t === 'youtube' ? 'YouTube' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-space text-xl font-semibold mb-2">No content yet</h3>
          <p className="text-muted-foreground mb-6">Create a campaign and generate content to see it here.</p>
          <Button onClick={() => navigate('/campaigns/new')} className="bg-primary gap-2">
            <Sparkles className="w-4 h-4" /> Create a Campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((piece, i) => (
            <motion.div key={piece.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <ContentPieceCard
                piece={piece}
                business={businesses[piece.business_id]}
                onDelete={async (id) => {
                  await base44.entities.ContentPiece.delete(id);
                  setContent(c => c.filter(x => x.id !== id));
                }}
                onUpdate={load}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}