import { STATUS_DOT } from '@/components/scheduling/StatusBadge';
import { cn } from '@/lib/utils';

const PLATFORM_LABEL = { facebook: 'FB', instagram: 'IG', linkedin: 'LI', x: 'X' };

export default function PostPill({ post, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-md px-2 py-1.5 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[post.status] || 'bg-muted-foreground')} />
        <span className="text-[10px] text-muted-foreground shrink-0">
          {post.scheduled_time || '--:--'}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
          {PLATFORM_LABEL[post.platform] || post.platform}
        </span>
      </div>
      <p className="text-xs text-foreground truncate mt-0.5">{post.title || post.caption || 'Untitled post'}</p>
    </button>
  );
}