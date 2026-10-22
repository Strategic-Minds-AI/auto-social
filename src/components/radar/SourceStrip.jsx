import React from 'react';
import { ExternalLink } from 'lucide-react';

const SOURCES = {
  youtube_topic_search: { label: 'Top industry videos', home: 'https://www.youtube.com' },
  youtube_most_popular: { label: 'Most-popular video chart', home: 'https://www.youtube.com/feed/trending' },
  google_trends_rising: { label: 'Trending searches', home: 'https://trends.google.com/trending' },
  google_news_latest: { label: 'Live news coverage', home: 'https://news.google.com' },
  own_channel: { label: 'Your own published posts', home: '' },
};

// Every card carries its own link, but the read itself should be attributable at a
// glance: which sources were opened, how much came from each, and when.
export default function SourceStrip({ signals }) {
  const groups = Object.entries(
    signals.reduce((acc, signal) => {
      const key = signal.source || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([key, count]) => ({ key, count, ...(SOURCES[key] || { label: key, home: '' }) }));

  if (!groups.length) return null;

  const region = signals.find((signal) => signal.region)?.region;
  const readAt = signals.find((signal) => signal.captured_at)?.captured_at;

  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-xs text-muted-foreground">Read live from</span>
      {groups.map((group) => {
        const href =
          group.key === 'google_trends_rising' && region ? `${group.home}?geo=${region}` : group.home;
        const body = (
          <span className="inline-flex items-center gap-1 text-xs text-foreground">
            {group.label}
            <span className="text-muted-foreground">· {group.count}</span>
            {href && <ExternalLink className="w-3 h-3 opacity-60" />}
          </span>
        );
        return (
          <React.Fragment key={group.key}>
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className="hover:text-primary">
                {body}
              </a>
            ) : (
              body
            )}
          </React.Fragment>
        );
      })}
      {readAt && (
        <span className="text-xs text-muted-foreground sm:ml-auto">
          Read {new Date(readAt).toLocaleString()}
          {region ? ` · market ${region}` : ''}
        </span>
      )}
    </div>
  );
}