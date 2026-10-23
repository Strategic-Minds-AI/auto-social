import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Hash, Globe, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_LABEL = {
  broad: 'Broad',
  niche: 'Niche',
  local: 'Local',
  brand: 'Your brand',
  partner: 'Partners',
};

const TIER_CLASS = {
  broad: 'bg-primary/10 text-primary border-primary/30',
  niche: 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30',
  local: 'bg-secondary text-secondary-foreground border-border',
  brand: 'bg-neon-pink/10 text-neon-pink border-neon-pink/30',
  partner: 'bg-surface-2 text-muted-foreground border-border',
};

const INTENT_LABEL = {
  informational: 'learning',
  commercial: 'buying',
  local: 'nearby',
  navigational: 'looking for you',
};

export default function SeoPanel({ profile }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState('');

  if (!profile) return null;

  const keywords = [...(profile.keywords || [])].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const tiers = ['broad', 'niche', 'local', 'brand', 'partner'].filter((tier) =>
    (profile.hashtags || []).some((tag) => tag.tier === tier)
  );

  const copy = async (text, label) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast({ title: 'Copied', description: `${label} is on your clipboard.` });
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Globe className={cn('w-4 h-4 mt-0.5', profile.website_read ? 'text-primary' : 'text-muted-foreground')} />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {profile.website_read ? profile.site_title || profile.website_url : 'Website not read'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{profile.website_note}</p>
            {profile.site_summary && <p className="text-xs text-muted-foreground mt-2">{profile.site_summary}</p>}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-space text-sm font-semibold flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> Searches worth owning
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => copy(keywords.map((k) => k.term).join(', '), 'Keywords')}
          >
            <Copy className="w-3 h-3" /> Copy all
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {keywords.map((keyword) => (
            <div key={keyword.term} className="flex items-start gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <span className="text-xs tabular-nums text-primary w-8 shrink-0 pt-0.5">{keyword.priority}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{keyword.term}</p>
                {keyword.why && <p className="text-xs text-muted-foreground">{keyword.why}</p>}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 pt-0.5">
                {INTENT_LABEL[keyword.intent] || keyword.intent}
              </span>
            </div>
          ))}
        </div>
        {profile.search_notes && <p className="text-xs text-muted-foreground mt-3">{profile.search_notes}</p>}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-space text-sm font-semibold flex items-center gap-2">
            <Hash className="w-4 h-4 text-primary" /> Your tag ladder
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => copy((profile.hashtags || []).map((t) => t.tag).join(' '), 'All tags')}
          >
            <Copy className="w-3 h-3" /> Copy all
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          {tiers.map((tier) => (
            <div key={tier}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{TIER_LABEL[tier]}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(profile.hashtags || [])
                  .filter((tag) => tag.tier === tier)
                  .map((tag) => (
                    <button
                      key={tag.tag}
                      type="button"
                      title={tag.why || tag.tag}
                      onClick={() => copy(tag.tag, tag.tag)}
                      className={cn('text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80', TIER_CLASS[tier])}
                    >
                      {tag.tag}
                      {tag.platform ? ` · ${tag.platform}` : ''}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {copied && <p className="text-xs text-primary mt-3">{copied} copied.</p>}
      </div>

      {profile.tag_plan?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-space text-sm font-semibold">How to tag</h3>
          <ul className="mt-3 space-y-2">
            {profile.tag_plan.map((item) => (
              <li key={item.label} className="text-xs">
                <span className="text-foreground font-medium">{item.label}</span>
                <span className="text-muted-foreground"> — {item.guidance}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.meta_suggestions?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-space text-sm font-semibold">For your website itself</h3>
          <div className="mt-3 space-y-2">
            {profile.meta_suggestions.map((line) => (
              <p key={line} className="text-xs text-muted-foreground">{line}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}