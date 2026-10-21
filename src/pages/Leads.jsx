import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Building2, Inbox, Loader2, Mail, Phone, RefreshCw, Trash2 } from 'lucide-react';

const STATUSES = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'closed', label: 'Closed' },
];

const FILTERS = [{ key: 'all', label: 'All' }].concat(STATUSES);

const STATUS_BADGES = {
  new: 'bg-primary/15 text-primary border-primary/30',
  contacted: 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30',
  qualified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

const PAGE_SIZE = 25;

function formatReceived(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function Leads() {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(null);
  const [filter, setFilter] = useState('new');
  const [leads, setLeads] = useState([]);
  const [counts, setCounts] = useState({});
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const fetchPage = useCallback(async (nextFilter, nextCursor) => {
    const options = { sort: '-received_at', limit: PAGE_SIZE };
    if (nextCursor) options.cursor = nextCursor;
    return nextFilter === 'all'
      ? base44.entities.Lead.list(options)
      : base44.entities.Lead.filter({ status: nextFilter }, options);
  }, []);

  const loadCounts = useCallback(async () => {
    const result = await base44.entities.Lead.aggregate({ groupBy: 'status' });
    const next = {};
    (result?.rows || []).forEach((row) => {
      next[row.status] = row.count;
    });
    setCounts(next);
  }, []);

  const loadList = useCallback(
    async (nextFilter) => {
      setLoading(true);
      try {
        const page = await fetchPage(nextFilter);
        setLeads(page.items || []);
        setCursor(page.next_cursor || null);
        setHasMore(Boolean(page.has_more));
      } finally {
        setLoading(false);
      }
    },
    [fetchPage]
  );

  const refresh = useCallback(
    async (nextFilter) => {
      await Promise.all([loadCounts(), loadList(nextFilter)]);
    },
    [loadCounts, loadList]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled) return;
        const admin = me?.role === 'admin';
        setIsAdmin(admin);
        if (admin) await refresh('new');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleLoadMore = async () => {
    setMoreLoading(true);
    try {
      const page = await fetchPage(filter, cursor);
      setLeads((prev) => prev.concat(page.items || []));
      setCursor(page.next_cursor || null);
      setHasMore(Boolean(page.has_more));
    } finally {
      setMoreLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke('scanInboxForLeads', {});
      const data = res.data || {};
      if (data.error) throw new Error(data.error);
      toast({
        title: data.created
          ? `${data.created} new lead${data.created === 1 ? '' : 's'} filed`
          : 'No new enquiries',
        description: data.message || `Read ${data.scanned} recent message${data.scanned === 1 ? '' : 's'}.`,
      });
      await refresh(filter);
    } catch (error) {
      toast({
        title: 'The inbox scan did not finish',
        description: error?.response?.data?.error || error?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleStatus = async (lead, status) => {
    await base44.entities.Lead.update(lead.id, { status });
    setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, status } : item)));
    loadCounts();
  };

  const handleDelete = async (lead) => {
    await base44.entities.Lead.delete(lead.id);
    setLeads((prev) => prev.filter((item) => item.id !== lead.id));
    loadCounts();
  };

  const selectFilter = (key) => {
    setFilter(key);
    loadList(key);
  };

  if (isAdmin === false) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-space font-semibold mb-1">Leads are admin-only</p>
          <p className="text-sm text-muted-foreground">
            Eden reads the app's shared Google inbox, so the enquiries she files are visible to app admins only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-space text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enquiries Eden found in your inbox and filed for you.
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? 'Reading inbox' : 'Scan inbox now'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const count = item.key === 'all' ? undefined : counts[item.key] || 0;
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => selectFilter(item.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                active
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground'
              )}
            >
              {item.label}
              {count !== undefined && <span className="ml-1.5 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-space font-semibold mb-1">
            {filter === 'all' ? 'No leads yet' : 'Nothing in this stage'}
          </p>
          <p className="text-sm text-muted-foreground">
            Eden sweeps your inbox every morning. Scan now to go looking straight away.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-space font-semibold truncate">{lead.name || lead.email}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> {lead.email}
                    </span>
                    {lead.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </span>
                    )}
                    {lead.company && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> {lead.company}
                      </span>
                    )}
                    {lead.received_at && <span>{formatReceived(lead.received_at)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-medium border capitalize',
                      STATUS_BADGES[lead.status] || STATUS_BADGES.new
                    )}
                  >
                    {lead.status}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(lead)}
                    aria-label="Delete lead"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {lead.service && (
                <p className="text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                  {lead.service}
                </p>
              )}

              {lead.message && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.message}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {STATUSES.filter((item) => item.key !== lead.status).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleStatus(lead, item.key)}
                    className="px-2.5 py-1 rounded-md text-xs border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    Mark {item.label.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleLoadMore} disabled={moreLoading}>
                {moreLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}