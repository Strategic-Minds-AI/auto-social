import StatusBadge from '@/components/scheduling/StatusBadge';
import PieceStatusBar from './PieceStatusBar';
import { slotLabel } from '@/lib/slot';

const GOALS = {
  brand_awareness: 'Brand awareness',
  lead_generation: 'Lead generation',
  sales_conversion: 'Sales conversion',
  community_engagement: 'Community engagement',
  product_launch: 'Product launch',
  event_promotion: 'Event promotion',
  customer_retention: 'Customer retention',
};

const PIECE_LABEL = {
  post: 'Post',
  story: 'Story',
  reel: 'Reel',
  short_video: 'Short video',
  google_ad: 'Google ad',
};

export default function CampaignBoard({ campaign, posts, pieces }) {
  const counts = (pieces || []).reduce((acc, piece) => {
    acc[piece.status] = (acc[piece.status] || 0) + 1;
    return acc;
  }, {});
  const upcoming = [...(posts || [])].sort((a, b) =>
    String(a.scheduled_at || '').localeCompare(String(b.scheduled_at || ''))
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-space font-semibold">{campaign.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {GOALS[campaign.goal] || 'No goal set'}
            {campaign.duration_weeks ? ` · ${campaign.duration_weeks} weeks` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(campaign.platforms || []).map((platform) => (
            <span key={platform} className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground capitalize">
              {platform}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Posting schedule</p>
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing scheduled for this campaign yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.slice(0, 4).map((post) => (
              <li key={post.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground truncate">{slotLabel(post)}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground capitalize">{post.platform}</span>
                  <StatusBadge status={post.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 4 && (
          <p className="text-[11px] text-muted-foreground mt-2">+{upcoming.length - 4} more in the calendar</p>
        )}
      </div>

      <div className="pt-1">
        <p className="text-xs font-medium text-muted-foreground mb-2">Content pieces</p>
        <PieceStatusBar counts={counts} />
        {pieces?.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {pieces.slice(0, 4).map((piece) => (
              <li key={piece.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground truncate">
                  {piece.title || piece.caption || PIECE_LABEL[piece.type] || 'Content piece'}
                </span>
                <StatusBadge status={piece.status === 'draft' ? 'planned' : piece.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}