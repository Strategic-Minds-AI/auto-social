import { ExternalLink, Trophy } from 'lucide-react';

const SOURCE_LABEL = {
  youtube: 'YouTube',
  google_trends: 'Google Trends',
  google_news: 'Google News',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  x: 'X',
  tiktok: 'TikTok',
  own_channel: 'Your own channel',
};

export default function BenchmarkPanel({ rules }) {
  if (!rules?.length) return null;

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div key={rule.id} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Trophy className="w-4 h-4 text-primary shrink-0" />
              <h3 className="font-space text-sm font-semibold truncate">{rule.label}</h3>
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{rule.priority}/100</span>
          </div>

          <p className="text-sm text-muted-foreground mt-2">{rule.technique}</p>

          {rule.hook_pattern && (
            <div className="mt-3 rounded-lg bg-surface p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Hook that wins</p>
              <p className="text-sm mt-0.5">{rule.hook_pattern}</p>
            </div>
          )}

          {rule.format && <p className="text-xs text-muted-foreground mt-2">Shape: {rule.format}</p>}
          {rule.why_it_works && <p className="text-xs text-muted-foreground mt-1">{rule.why_it_works}</p>}

          {rule.evidence?.length > 0 && (
            <div className="mt-3 border-t border-border pt-2.5 space-y-1.5">
              {rule.evidence.map((item, index) => (
                <div key={`${rule.id}-${index}`} className="text-xs text-muted-foreground">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span className="truncate max-w-[220px]">{item.title || item.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span>{item.title}</span>
                  )}
                  <span className="block text-[11px]">
                    {item.metric}
                    {item.platform ? ` · Source: ${SOURCE_LABEL[item.platform] || item.platform}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}