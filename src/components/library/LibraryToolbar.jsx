import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { KINDS } from '@/lib/libraryItems';
import { cn } from '@/lib/utils';

const TABS = [{ value: 'all', label: 'Everything' }, ...KINDS];

export default function LibraryToolbar({ kind, onKindChange, search, onSearchChange, onAdd }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onKindChange(tab.value)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border transition-colors',
              kind === tab.value
                ? 'border-primary text-primary bg-primary/10'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}

        <Button className="gap-1.5 ml-auto" onClick={onAdd}>
          <Plus className="w-4 h-4" /> Add a pattern
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search your hooks, scripts and methods"
          className="w-full bg-surface-2 border border-border rounded-lg text-sm pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}