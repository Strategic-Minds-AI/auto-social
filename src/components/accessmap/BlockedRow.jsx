import { Ban, Lightbulb } from 'lucide-react';

export default function BlockedRow({ want, why, workaround }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex gap-2">
        <Ban className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm font-medium">{want}</p>
      </div>
      <p className="text-xs text-muted-foreground pl-6 leading-relaxed">{why}</p>
      <div className="flex gap-2 pl-6">
        <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">{workaround}</p>
      </div>
    </div>
  );
}