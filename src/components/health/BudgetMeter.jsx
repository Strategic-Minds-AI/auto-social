import { Coins } from 'lucide-react';
import { DAILY_CALL_LIMIT, DAILY_TOKEN_BUDGET } from '@/lib/aiBudget';

function Bar({ used, cap, label }) {
  const share = cap ? Math.min(Math.round((used / cap) * 100), 100) : 0;
  const hot = share >= 80;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{used} / {cap}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={hot ? 'h-full bg-amber-400' : 'h-full bg-primary'}
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}

/** Today's AI spend against the cap the whole system is bound by. */
export default function BudgetMeter({ usage }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">AI budget today</span>
      </div>
      <Bar used={usage.calls} cap={DAILY_CALL_LIMIT} label="Requests" />
      <Bar used={usage.tokens} cap={DAILY_TOKEN_BUDGET} label="Tokens" />
      <p className="text-xs text-muted-foreground">
        Every AI call in the app passes through this cap, so a runaway run stops itself. It resets at midnight UTC.
      </p>
    </div>
  );
}