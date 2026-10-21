import { cn } from '@/lib/utils';

export default function StatTiles({ tiles }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map(({ label, value, tone, icon: Icon }) => (
        <div key={label} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            {Icon && <Icon className="w-4 h-4" />}
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className={cn('text-2xl font-space font-bold mt-2', tone)}>{value}</p>
        </div>
      ))}
    </div>
  );
}