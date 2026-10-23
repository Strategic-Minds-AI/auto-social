import { Button } from '@/components/ui/button';
import { Copy, Pencil, Star, Trash2 } from 'lucide-react';
import { KIND_LABEL, SOURCE_LABEL } from '@/lib/libraryItems';
import { cn } from '@/lib/utils';

// One saved pattern: a hook, a script, a look or an editing method.
export default function LibraryCard({ item, onCopy, onEdit, onDelete, onToggleFavorite }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] uppercase tracking-wide text-primary">{KIND_LABEL[item.kind] || item.kind}</span>
          <h3 className="font-space font-semibold text-sm mt-0.5">{item.title}</h3>
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(item)}
          title={item.favorite ? 'Remove from favourites' : 'Mark as a favourite'}
          className={cn('shrink-0', item.favorite ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
        >
          <Star className={cn('w-4 h-4', item.favorite && 'fill-current')} />
        </button>
      </div>

      <p className="text-sm whitespace-pre-line text-foreground/90">{item.body}</p>

      {item.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}

      <div className="mt-auto pt-2 border-t border-border flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground truncate">
          {SOURCE_LABEL[item.source] || item.source}
          {item.score ? ` · scored ${item.score}` : ''}
          {item.times_used ? ` · used ${item.times_used}×` : ''}
        </p>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => onCopy(item)}>
            <Copy className="w-3 h-3" /> Copy
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(item)}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}