import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Building2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useBusinessStore } from '@/lib/businessStore';

export default function BusinessSwitcher() {
  const [businesses, setBusinesses] = useState([]);
  const [open, setOpen] = useState(false);
  const { activeBusiness, setActiveBusiness } = useBusinessStore();
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.Business.list().then(setBusinesses);
  }, []);

  const select = (b) => {
    setActiveBusiness(b);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
      >
        <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-3.5 h-3.5 text-primary" />
        </div>
        <span className="flex-1 text-left font-medium truncate text-foreground">
          {activeBusiness ? activeBusiness.name : 'Select Business'}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {businesses.map((b) => (
            <button
              key={b.id}
              onClick={() => select(b)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left",
                activeBusiness?.id === b.id && "bg-primary/10 text-primary"
              )}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{b.name}</span>
            </button>
          ))}
          <button
            onClick={() => { navigate('/businesses/new'); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors border-t border-border"
          >
            <Plus className="w-4 h-4" />
            Add Business
          </button>
        </div>
      )}
    </div>
  );
}