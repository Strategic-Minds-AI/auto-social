import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookmarkPlus, Check, ExternalLink, Play, Search, UserX } from 'lucide-react';

const SOURCE_LABELS = {
  youtube_topic_search: 'Top video for this industry',
  youtube_most_popular: 'Most-popular video chart',
  google_trends_rising: 'Trending searches',
  google_news_latest: 'Live news coverage',
  own_channel: 'Your own published post',
};

const PLATFORM_LABELS = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
  tiktok: 'TikTok',
  google_trends: 'Google Trends',
  google_news: 'News',
};

function compact(value) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
  return String(number);
}

function clock(seconds) {
  const total = Number(seconds) || 0;
  if (!total) return null;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function day(value) {
  if (!value) return '';
  const stamp = new Date(value);
  return Number.isNaN(stamp.getTime()) ? '' : stamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function freshness(value) {
  if (!value) return '';
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return '';
  const days = Math.max(0, Math.round((Date.now() - stamp.getTime()) / 86400000));
  return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
}

export default function SignalCard({ signal, onSave, saved }) {
  const isSearch = signal.kind === 'search';
  const isArticle = signal.kind === 'article';
  const length = clock(signal.duration_seconds);
  const stats = isSearch
    ? [
        ['Searches', compact(signal.approx_searches)],
        ['Momentum', signal.momentum || 'rising'],
        ['Source', 'Google Trends'],
        ['Kind', 'Rising search'],
      ]
    : isArticle
      ? [
          ['Outlet', signal.creator || 'unnamed'],
          ['Published', day(signal.published_at) || '—'],
          ['Freshness', freshness(signal.published_at) || '—'],
          ['Kind', 'Live coverage'],
        ]
      : [
          ['Views', compact(signal.views)],
          ['Likes', compact(signal.likes)],
          ['Comments', compact(signal.comments)],
          ['Engagement', `${signal.engagement_rate || 0}%`],
        ];

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            {isSearch ? <Search className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {PLATFORM_LABELS[signal.platform] || signal.platform}
          </Badge>
          {SOURCE_LABELS[signal.source] && (
            <span className="text-xs text-muted-foreground">{SOURCE_LABELS[signal.source]}</span>
          )}
          {signal.faceless_friendly && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <UserX className="w-3 h-3" /> Faceless friendly
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs font-space font-semibold text-primary">{Math.round(signal.score || 0)}/100</span>
      </div>

      <div>
        <a
          href={signal.url || '#'}
          target="_blank"
          rel="noreferrer"
          className="font-medium leading-snug hover:text-primary inline-flex items-start gap-1.5"
        >
          {signal.title}
          {signal.url && <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0 opacity-60" />}
        </a>
        <p className="text-xs text-muted-foreground mt-1">
          {[
            signal.creator,
            signal.category && signal.category !== 'news' ? signal.category : '',
            length,
            isArticle ? day(signal.published_at) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-surface rounded-lg px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-sm font-space font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {(signal.hook_type || signal.why_it_works || signal.hook_text) && (
        <div className="border-t border-border pt-3 space-y-2">
          {signal.hook_type && (
            <p className="text-xs">
              <span className="text-muted-foreground">Hook:</span> <span className="text-primary">{signal.hook_type}</span>
            </p>
          )}
          {signal.hook_text && <p className="text-sm italic text-foreground/90">“{signal.hook_text}”</p>}
          {signal.why_it_works && <p className="text-xs text-muted-foreground">{signal.why_it_works}</p>}
          {Array.isArray(signal.takeaways) && signal.takeaways.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1">
              {signal.takeaways.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          )}
          {Array.isArray(signal.tags) && signal.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {signal.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2 mt-auto">
        <p className="text-[11px] text-muted-foreground">
          Source: {SOURCE_LABELS[signal.source] || signal.platform}
          {signal.captured_at ? ` · read ${day(signal.captured_at)}` : ''}
        </p>
        {onSave && (
          <Button
            size="sm"
            variant={saved ? 'secondary' : 'outline'}
            className="gap-1.5 text-xs shrink-0"
            disabled={saved}
            onClick={() => onSave(signal)}
          >
            {saved ? <Check className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
            {saved ? 'In library' : 'Keep templates'}
          </Button>
        )}
      </div>
    </div>
  );
}