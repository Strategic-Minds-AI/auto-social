import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useBusinessStore } from '@/lib/businessStore';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Sparkles, CalendarClock, Loader2 } from 'lucide-react';
import PlanGeneratorModal from '@/components/autosocial/PlanGeneratorModal';
import EditPostModal from '@/components/autosocial/EditPostModal';
import PostRow from '@/components/autosocial/PostRow';

const todayString = () => new Date().toISOString().slice(0, 10);

const formatDay = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = todayString();
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const label = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  if (dateStr === today) return `Today · ${label}`;
  if (dateStr === tomorrow.toISOString().slice(0, 10)) return `Tomorrow · ${label}`;
  return label;
};

export default function AutoSocial() {
  const { activeBusiness, setActiveBusiness } = useBusinessStore();
  const { toast } = useToast();
  const [business, setBusiness] = useState(activeBusiness);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
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

  const loadPosts = useCallback(async () => {
    if (!business) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const page = await base44.entities.ScheduledPost.filter(
      { business_id: business.id },
      { sort: 'scheduled_date', limit: 200 }
    );
    setPosts(page.items || []);
    setLoading(false);
  }, [business]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleGenerate = async (options) => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateAutoSocialPlan', { business_id: business.id, ...options });
      const created = res.data?.created || 0;
      toast({ title: `${created} posts planned`, description: 'Your calendar is ready to review and adjust.' });
      setShowGenerator(false);
      await loadPosts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not generate the plan',
        description: error?.response?.data?.error || error.message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (data) => {
    await base44.entities.ScheduledPost.update(editing.id, data);
    setEditing(null);
    await loadPosts();
  };

  const handleDelete = async (post) => {
    await base44.entities.ScheduledPost.delete(post.id);
    await loadPosts();
  };

  const grouped = posts.reduce((acc, post) => {
    const key = post.scheduled_date || 'unscheduled';
    acc[key] = acc[key] || [];
    acc[key].push(post);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  const counts = [
    { label: 'Planned', value: posts.filter((p) => p.status === 'planned').length },
    { label: 'Scheduled', value: posts.filter((p) => p.status === 'scheduled').length },
    { label: 'Published', value: posts.filter((p) => p.status === 'published').length },
    { label: 'A/B tests', value: posts.filter((p) => p.ab_test).length },
  ];

  if (!business && !loading) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto text-center">
        <CalendarClock className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="font-space font-bold text-2xl mb-2">Auto Social</h1>
        <p className="text-muted-foreground mb-6">Add a business profile first — Auto Social builds the content around it.</p>
        <Link to="/businesses/new">
          <Button className="bg-primary font-medium">Add a business</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-space font-bold text-2xl flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-primary" />
            Auto Social
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {business ? `Autonomous content engine for ${business.name}` : 'Autonomous content engine'}
          </p>
        </div>
        <Button onClick={() => setShowGenerator(true)} disabled={!business || generating} className="bg-primary glow-purple-sm gap-2 font-medium">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Working…' : 'Generate plan'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {counts.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-space font-bold">{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : dates.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-space font-bold text-lg mb-2">No content planned yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Auto Social will write a full calendar of posts — hooks, captions, hashtags, image briefs and A/B variants.
          </p>
          <Button onClick={() => setShowGenerator(true)} className="bg-primary gap-2 font-medium">
            <Sparkles className="w-4 h-4" />
            Generate plan
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((date) => (
            <section key={date}>
              <h2 className="font-space font-semibold text-sm text-muted-foreground mb-3">{formatDay(date)}</h2>
              <div className="space-y-3">
                {grouped[date].map((post) => (
                  <PostRow key={post.id} post={post} onEdit={setEditing} onDelete={handleDelete} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showGenerator && (
        <PlanGeneratorModal
          business={business}
          busy={generating}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerator(false)}
        />
      )}

      {editing && <EditPostModal post={editing} onSave={handleSave} onClose={() => setEditing(null)} />}
    </div>
  );
}