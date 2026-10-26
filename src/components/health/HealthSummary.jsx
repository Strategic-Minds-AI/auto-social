import { Wrench, UserRound, Eye, Gauge } from 'lucide-react';

const TARGET = 90;

const TILE = 'bg-card border border-border rounded-xl p-4';

function Tile({ icon: Icon, value, label }) {
  return (
    <div className={TILE}>
      <Icon className="w-4 h-4 text-primary mb-2" />
      <p className="font-space font-bold text-2xl leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/** The last 24 hours: what the loop repaired by itself versus what it had to ask for. */
export default function HealthSummary({ repaired, needsYou, watching, health }) {
  const onTarget = health >= TARGET;
  return (
    <div className="space-y-4">
      <div className={TILE}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Self-healing rate, last 24 hours</span>
          </div>
          <span className={onTarget ? 'text-sm font-bold text-primary' : 'text-sm font-bold text-amber-400'}>
            {health}%
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={onTarget ? 'h-full bg-primary' : 'h-full bg-amber-400'}
            style={{ width: `${Math.min(Math.max(health, 0), 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Target is {TARGET}% or better: of everything the loop found, {TARGET}% or more should be handled without you.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile icon={Wrench} value={repaired} label="Repaired automatically" />
        <Tile icon={UserRound} value={needsYou} label="Needs a person" />
        <Tile icon={Eye} value={watching} label="Watched, no action yet" />
      </div>
    </div>
  );
}