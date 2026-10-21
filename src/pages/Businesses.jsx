import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Building2, Globe, Instagram, ExternalLink, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useBusinessStore } from '@/lib/businessStore';

export default function Businesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { setActiveBusiness } = useBusinessStore();

  const load = async () => {
    const data = await base44.entities.Business.list('-created_date');
    setBusinesses(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Business.delete(id);
    load();
  };

  const handleSelect = (b) => {
    setActiveBusiness(b);
    navigate('/campaigns');
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-space text-3xl font-bold text-foreground">Your Businesses</h1>
          <p className="text-muted-foreground mt-1">Manage your brands and their marketing profiles</p>
        </div>
        <Button
          onClick={() => navigate('/businesses/new')}
          className="bg-primary hover:bg-primary/90 glow-primary-sm font-medium gap-2"
        >
          <Plus className="w-4 h-4" /> New Business
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-52 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-space text-xl font-semibold mb-2">No businesses yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Add your first business to start creating AI-powered social media campaigns.</p>
          <Button onClick={() => navigate('/businesses/new')} className="bg-primary gap-2">
            <Plus className="w-4 h-4" /> Add Your First Business
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              onClick={() => handleSelect(b)}
              className="group relative bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:glow-primary-sm transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/businesses/edit/${b.id}`); }}
                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(b.id, e)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-space font-semibold text-lg text-foreground mb-1">{b.name}</h3>
              {b.industry && <p className="text-xs text-primary font-medium mb-2">{b.industry}</p>}
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{b.description || 'No description'}</p>
              <div className="flex gap-2 flex-wrap">
                {b.website && (
                  <a href={b.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <Globe className="w-3 h-3" /> Website
                  </a>
                )}
                {b.social_links?.instagram && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Instagram className="w-3 h-3" /> IG
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}