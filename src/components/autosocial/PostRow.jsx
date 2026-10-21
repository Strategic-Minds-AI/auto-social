import { Pencil, Trash2, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORMS = {
  instagram: { label: 'Instagram', dot: 'bg-pink-500' },
  facebook: { label: 'Facebook', dot: 'bg-blue-500' },
  linkedin: { label: 'LinkedIn', dot: 'bg-sky-600' },
  x: { label: 'X', dot: 'bg-neutral-400' },
};

const STATUS = {
  planned: { label: 'Planned', cls: 'bg-secondary text-muted-foreground' },
  scheduled: { label: 'Scheduled', cls: 'bg-primary/15 text-primary' },
  published: { label: 'Published', cls: 'bg-emerald-500/15 text-emerald-400' },
  failed: { label: 'Failed', cls: 'bg-destructive/15 text-destructive' },
};

export default function PostRow({ post, onEdit, onDelete }) {
  const platform = PLATFORMS[post.platform] || { label: post.platform, dot: 'bg-muted' };
  const status = STATUS[post.status] || STATUS.planned;

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex gap-4 hover:border-primary/30 transition-colors">
      <div className="w-16 shrink-0 text-center">
        <p className="font-space font-bold text-primary text-sm">{post.scheduled_time || '—'}</p>
        <p className="text-[11px] text-muted-foreground capitalize mt-1">{post.format?.replace('_', ' ')}</p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <span className={cn('w-2 h-2 rounded-full', platform.dot)} />
            {platform.label}
          </span>
          {post.pillar && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{post.pillar}</span>
          )}
          <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', status.cls)}>{status.label}</span>
          {post.ab_test && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-neon-cyan/15 text-neon-cyan font-medium">
              <FlaskConical className="w-3 h-3" />
              A/B
            </span>
          )}
        </div>

        {post.title && <p className="font-medium text-sm mb-1 truncate">{post.title}</p>}
        <p className="text-sm text-muted-foreground line-clamp-2">{post.caption}</p>
        {post.publish_error && <p className="text-xs text-destructive mt-1">{post.publish_error}</p>}
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={() => onEdit(post)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(post)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}