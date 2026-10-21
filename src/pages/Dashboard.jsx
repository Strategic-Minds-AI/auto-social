import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Button } from '@/components/ui/button';
import { Megaphone, CalendarClock, CheckCircle2, AlertCircle } from 'lucide-react';
import EdenAvatar from '@/components/assistant/EdenAvatar';
import StatTiles from '@/components/dashboard/StatTiles';
import CampaignBoard from '@/components/dashboard/CampaignBoard';
import UpcomingSchedule from '@/components/dashboard/UpcomingSchedule';
import ContentCalendar from '@/components/dashboard/ContentCalendar';

const QUEUED = ['approved', 'scheduled', 'publishing'];

const toCounts = (rows = []) =>
  (rows || []).reduce((acc, row) => {
    const key = row.status ?? row._id ?? row.group ?? row.key;
    if (key != null) acc[key] = row.count ?? 0;
    return acc;
  }, {});

export default function Dashboard() {
  const { business, ready } = useActiveBusiness();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [postStats, setPostStats] = useState({});
  const [pieceStats, setPieceStats] = useState({});

  const requestRef = useRef(0);

  // Reloadable so the calendar can refresh the board after a post is changed from
  // inside it. Responses from a previous business must not overwrite the current one.
  const load = useCallback(async () => {
    const request = ++requestRef.current;
    if (!business?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [campaignPage, postPage, piecePage, accountPage, postAgg, pieceAgg] = await Promise.all([
        base44.entities.Campaign.filter(
          { business_id: business.id, status: 'active' },
          { sort: '-created_date', limit: 50 }
        ),
        base44.entities.ScheduledPost.filter(
          { business_id: business.id },
          { sort: '-scheduled_at', limit: 200 }
        ),
        base44.entities.ContentPiece.filter({ business_id: business.id }, { limit: 200 }),
        base44.entities.SocialAccount.filter({ business_id: business.id }, { limit: 50 }),
        base44.entities.ScheduledPost.aggregate({ query: { business_id: business.id }, groupBy: 'status' }),
        base44.entities.ContentPiece.aggregate({ query: { business_id: business.id }, groupBy: 'status' }),
      ]);
      if (request !== requestRef.current) return;
      setCampaigns(campaignPage.items || []);
      setPosts(postPage.items || []);
      setPieces(piecePage.items || []);
      setAccounts(accountPage.items || []);
      setPostStats(toCounts(postAgg?.rows));
      setPieceStats(toCounts(pieceAgg?.rows));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [business?.id]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  const upcoming = posts
    .filter((post) => QUEUED.includes(post.status))
    .sort((a, b) => String(a.scheduled_at || '').localeCompare(String(b.scheduled_at || '')))
    .slice(0, 6);

  const campaignNames = campaigns.reduce((acc, campaign) => {
    acc[campaign.id] = campaign.name;
    return acc;
  }, {});

  const tiles = [
    { label: 'Active campaigns', value: campaigns.length, tone: 'text-primary', icon: Megaphone },
    { label: 'Queued to post', value: (postStats.approved || 0) + (postStats.scheduled || 0), tone: 'text-sky-400', icon: CalendarClock },
    { label: 'Published', value: postStats.published || 0, tone: 'text-emerald-400', icon: CheckCircle2 },
    { label: 'Needs review', value: postStats.planned || 0, tone: 'text-amber-400', icon: AlertCircle },
  ];

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!business?.id) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-space font-semibold text-lg">No business yet</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add a business and the dashboard will fill in with its campaigns and schedule.
          </p>
          <Button asChild>
            <Link to="/onboarding">Start guided onboarding</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-space font-bold text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{business.name}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/assistant">
            <EdenAvatar className="w-5 h-5 mr-2" />
            Ask Eden Skye
          </Link>
        </Button>
      </div>

      <StatTiles tiles={tiles} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-space font-semibold text-sm text-muted-foreground">Content flow</h2>
          <Link to="/calendar" className="text-xs text-primary hover:underline">
            Open full calendar
          </Link>
        </div>
        <ContentCalendar posts={posts} accounts={accounts} onChanged={load} />
      </section>

      <section>
        <h2 className="font-space font-semibold text-sm text-muted-foreground mb-3">Coming up next</h2>
        <UpcomingSchedule posts={upcoming} campaignNames={campaignNames} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-space font-semibold text-sm text-muted-foreground">Active campaigns</h2>
          <Link to="/campaigns" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No active campaigns right now. Start one and it will appear here with its schedule.
            </p>
            <Button asChild>
              <Link to="/campaigns/new">Start a campaign</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignBoard
                key={campaign.id}
                campaign={campaign}
                posts={posts.filter((post) => post.campaign_id === campaign.id)}
                pieces={pieces.filter((piece) => piece.campaign_id === campaign.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}