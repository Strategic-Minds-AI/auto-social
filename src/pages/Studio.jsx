import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useBusinessStore } from '@/lib/businessStore';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Sparkles, Server, Loader2 } from 'lucide-react';
import StudioForm from '@/components/studio/StudioForm';
import DraftCard from '@/components/studio/DraftCard';
import EditDraftModal from '@/components/studio/EditDraftModal';

export default function Studio() {
  const { activeBusiness, setActiveBusiness } = useBusinessStore();
  const { toast } = useToast();
  const [business, setBusiness] = useState(activeBusiness);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (activeBusiness) {
      setBusiness(activeBusiness);
      return;
    }
    base44.entities.Business.list({ sort: '-created_date', limit: 1 }).then((page) => {
      const first = (page.items || [])[0] || null;
      setBusiness(first);
      if (first) setActiveBusiness(first);
    });
  }, [activeBusiness, setActiveBusiness]);

  const loadDrafts = useCallback(async () => {
    if (!business) {
      setDrafts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const page = await base44.entities.ContentDraft.filter(
      { business_id: business.id },
      { sort: '-created_date', limit: 60 }
    );
    setDrafts(page.items || []);
    setLoading(false);
  }, [business]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const handleGenerate = async (options) => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateStudioContent', { business_id: business.id, ...options });
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      setLastRun(data.meta || null);
      toast({
        title: `${data.created} draft${data.created === 1 ? '' : 's'} ready`,
        description: `Written on ${data.meta?.provider || 'your AI gateway'}.`,
      });
      await loadDrafts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not generate content',
        description: error?.response?.data?.error || error.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (data) => {
    await base44.entities.ContentDraft.update(editing.id, data);
    setEditing(null);
    await loadDrafts();
  };

  const handleDelete = async (draft) => {
    await base44.entities.ContentDraft.delete(draft.id);
    await loadDrafts();
  };

  if (!business && !loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto text-center">
        <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="font-space font-bold text-2xl mb-2">AI Content Studio</h1>
        <p className="text-muted-foreground mb-6">Add a business profile first — the studio writes in its brand voice.</p>
        <Link to="/businesses/new">
          <Button className="bg-primary font-medium">Add a business</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Content Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5" />
          {lastRun?.provider
            ? `Connected to ${lastRun.provider}`
            : 'Runs on your own AI gateway — no platform AI credits used.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        <StudioForm business={business} busy={generating} onGenerate={handleGenerate} lastRun={lastRun} />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-space font-semibold text-lg">
              Drafts <span className="text-muted-foreground text-sm font-normal ml-1">({drafts.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : generating ? (
            <div className="flex items-center justify-center gap-3 py-16 bg-card border border-primary/30 rounded-xl">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Writing your content…</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Sparkles className="w-9 h-9 text-primary mx-auto mb-4" />
              <h3 className="font-space font-bold text-lg mb-2">No drafts yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Describe what you want to post and the studio will write it — hooks, captions, hashtags and image briefs.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {drafts.map((draft) => (
                <DraftCard key={draft.id} draft={draft} onEdit={setEditing} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && <EditDraftModal draft={editing} onSave={handleSave} onClose={() => setEditing(null)} />}
    </div>
  );
}