import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Activity, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import HealthSummary from '@/components/health/HealthSummary';
import IssueRow from '@/components/health/IssueRow';
import BudgetMeter from '@/components/health/BudgetMeter';

// The health board: what the self-healing loop found, what it repaired on its own,
// and the small remainder that genuinely needs a person. A sweep runs every fifteen
// minutes on its own; an admin can also run one on demand.

const DAY_MS = 24 * 60 * 60 * 1000;

export default function SystemHealth() {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [active, setActive] = useState([]);
  const [recent, setRecent] = useState([]);
  const [usage, setUsage] = useState({ calls: 0, tokens: 0 });
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  const load = useCallback(async () => {
    const me = await base44.auth.me().catch(() => null);
    setIsAdmin(me?.role === 'admin');

    const since = new Date(Date.now() - DAY_MS).toISOString();
    const day = new Date().toISOString().slice(0, 10);

    const [openPage, recentPage, usagePage] = await Promise.all([
      base44.entities.SystemIssue.filter(
        { status: { $in: ['needs_you', 'open'] } },
        { sort: '-last_seen_at', limit: 40 }
      ),
      base44.entities.SystemIssue.filter({ last_seen_at: { $gte: since } }, { sort: '-last_seen_at', limit: 60 }),
      base44.entities.AiUsage.filter({ day }, { limit: 300 }),
    ]);

    setActive(openPage.items || []);
    setRecent(recentPage.items || []);
    const rows = usagePage.items || [];
    setUsage({
      calls: rows.reduce((total, row) => total + (Number(row.calls) || 0), 0),
      tokens: rows.reduce((total, row) => total + (Number(row.tokens) || 0), 0),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sweep = async () => {
    setSweeping(true);
    try {
      const response = await base44.functions.invoke('systemWatchdog', {});
      const data = response.data || {};
      if (data.error) throw new Error(data.error);
      toast({
        title: 'Sweep finished',
        description: `${data.detected || 0} found · ${data.auto_fixed || 0} repaired · ${data.needs_you || 0} need you.`,
      });
      await load();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'The sweep could not run',
        description: error?.response?.data?.error || error.message,
      });
    } finally {
      setSweeping(false);
    }
  };

  const repaired = recent.filter((item) => item.status === 'auto_fixed').length;
  const needsYou = recent.filter((item) => item.status === 'needs_you').length;
  const health = repaired + needsYou ? Math.round((repaired / (repaired + needsYou)) * 100) : 100;
  const watching = active.filter((item) => item.status === 'open').length;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-space font-bold text-2xl flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> System Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The loop sweeps every fifteen minutes: it repairs what it can, hands due work to the publisher, and shows
            you only what it cannot fix alone.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={sweep} disabled={sweeping} className="gap-2">
            {sweeping ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Run a sweep now
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <HealthSummary repaired={repaired} needsYou={needsYou} watching={watching} health={health} />

          <BudgetMeter usage={usage} />

          <div className="space-y-3">
            <h2 className="font-space font-semibold text-sm">
              Waiting on you ({active.filter((item) => item.status === 'needs_you').length})
            </h2>
            {active.filter((item) => item.status === 'needs_you').length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <ShieldCheck className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-sm">Nothing needs you right now.</p>
              </div>
            ) : (
              active
                .filter((item) => item.status === 'needs_you')
                .map((item) => <IssueRow key={item.id} item={item} />)
            )}
          </div>

          {watching > 0 && (
            <div className="space-y-3">
              <h2 className="font-space font-semibold text-sm">Being watched ({watching})</h2>
              {active
                .filter((item) => item.status === 'open')
                .map((item) => <IssueRow key={item.id} item={item} />)}
            </div>
          )}

          <div className="space-y-3">
            <h2 className="font-space font-semibold text-sm">Repaired in the last 24 hours</h2>
            {repaired === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing needed repairing.</p>
            ) : (
              recent
                .filter((item) => item.status === 'auto_fixed')
                .map((item) => <IssueRow key={item.id} item={item} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}