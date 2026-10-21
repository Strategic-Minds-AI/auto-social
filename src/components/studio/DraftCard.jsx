import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Copy, Check, Pencil, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORM_STYLES = {
  instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  facebook: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  linkedin: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  x: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  tiktok: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
  youtube: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_STYLES = {
  draft: 'bg-secondary text-muted-foreground',
  approved: 'bg-emerald-500/15 text-emerald-400',
  archived: 'bg-secondary text-muted-foreground',
};

export default function DraftCard({ draft, onEdit, onDelete }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(`${draft.caption || ''}\n\n${draft.hashtags || ''}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className={cn('text-xs px-2 py-0.5 rounded-full border capitalize font-medium', PLATFORM_STYLES[draft.platform])}>
            {draft.platform}
          </span>
          <span className="text-xs text-muted-foreground capitalize">{draft.format?.replace('_', ' ')}</span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[draft.status])}>
            {draft.status}
          </span>
          {draft.source !== 'create' && (
            <span className="text-xs text-primary capitalize">{draft.source}</span>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={copy} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => onEdit(draft)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(draft)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {draft.title && <p className="text-sm font-medium text-foreground mb-2">{draft.title}</p>}

      {draft.hook && (
        <div className="mb-2 px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg">
          <p className="text-xs text-primary font-medium flex items-center gap-1">
            <Target className="w-3 h-3" /> Hook
          </p>
          <p className="text-xs text-foreground mt-0.5">{draft.hook}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{draft.caption}</p>

      {draft.hashtags && <p className="text-xs text-primary mt-3 break-words">{draft.hashtags}</p>}

      {draft.call_to_action && (
        <p className="text-xs text-foreground mt-2"><span className="text-muted-foreground">CTA:</span> {draft.call_to_action}</p>
      )}

      {draft.ai_provider && (
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          Written by {draft.ai_provider}{draft.ai_model ? ` · ${draft.ai_model}` : ''}
        </p>
      )}
    </div>
  );
}