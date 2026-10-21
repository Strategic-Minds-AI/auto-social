import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import ApprovalCard from '@/components/approval/ApprovalCard';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'planned', label: 'Needs review' },
  { id: 'failed', label: 'Failed' },
  { id: 'approved', label: 'Approved' },
];

export default function ApprovalQueue() {
  const { business, ready } = useActiveBusiness();
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('planned');

  const load = useCallback(async () => {
    if (!business) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [postPage, accountPage] = await Promise.all([
      base44.entities.ScheduledPost.filter(
        { business_id: business.id, status: { $in: ['planned', 'approved', 'failed'] } },
        { sort: 'scheduled_date', limit: 200 }
      ),
      base44.entities.SocialAccount.filter({ business_id: business.id }, { limit: 50 }),
    ]);
    setPosts(postPage.items || []);
    setAccounts(accountPage.items || []);
    setLoading(false);
  }, [business]);

  useEffect(() => { load(); }, [load]);

  const handleDeleted = (id) => setPosts((prev) => prev.filter((p) => p.id !== id));

  const counts = {
    planned: posts.filter((p) => p.status === 'planned').length,
    failed: posts.filter((p) => p.status === 'failed').length,
    approved: posts.filter((p) => p.status === 'approved').length,
  };

  const shown = posts.filter((p) => p.status === tab);

  if (!ready) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto text-center">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="font-space font-bold text-2xl mb-2">Approval Queue</h1>
        <p className="text-muted-foreground mb-6">Add a business profile first — the queue is scoped to one business.</p>
        <Link to="/businesses/new"><Button className="bg-primary">Add a business</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-primary" /> Approval Queue
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Nothing publishes until it is approved here and scheduled for a slot. {business.name}
        </p>
      </div>

      <div className="flex gap-1 bg-card border border-border rounded-lg p-1 mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2',
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.id === 'failed' ? <AlertTriangle className="w-3 h-3" /> : null}
            {t.label}
            <span className={cn('px-1.5 rounded-full text-[10px]', tab === t.id ? 'bg-primary-foreground/20' : 'bg-secondary')}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-space font-semibold mb-1">
            {tab === 'planned' ? 'Nothing waiting for review' : tab === 'failed' ? 'No failed posts' : 'Nothing approved yet'}
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {tab === 'planned'
              ? 'Generate a plan in Auto Social or write drafts in the Content Studio, then promote them here for review.'
              : tab === 'failed'
                ? 'Posts that fail to publish will appear here with the exact reason, so you can fix and retry them.'
                : 'Approved posts move on to the calendar once you pick a slot for them.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {shown.map((post) => (
            <ApprovalCard
              key={post.id}
              post={post}
              accounts={accounts}
              onChanged={load}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}