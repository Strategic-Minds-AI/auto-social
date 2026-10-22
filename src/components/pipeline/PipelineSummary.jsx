import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

const TONE = {
  blocked: {
    icon: XCircle,
    wrap: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400',
  },
  waiting: {
    icon: AlertCircle,
    wrap: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-400',
  },
  clear: {
    icon: CheckCircle2,
    wrap: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-400',
  },
};

export default function PipelineSummary({ summary, business }) {
  const percent = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
  const tone = summary.blocked ? TONE.blocked : summary.bottleneck ? TONE.waiting : TONE.clear;
  const Icon = tone.icon;

  const headline = summary.blocked
    ? `Publishing is blocked at "${summary.blocked.title}"`
    : summary.bottleneck
      ? `Your pipeline is waiting at "${summary.bottleneck.title}"`
      : 'Every stage has run end to end';

  const detail = summary.blocked
    ? summary.blocked.evidence
    : summary.bottleneck
      ? summary.bottleneck.evidence
      : 'Posts are publishing and their results are feeding the next plan.';

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-space font-semibold text-lg">
            {summary.done} of {summary.total} stages complete
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {business.name} · research through to published results
          </p>
        </div>
        <span className="font-space font-bold text-2xl text-primary">{percent}%</span>
      </div>

      <div className="h-2 rounded-full bg-surface-2 mt-3 overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
      </div>

      <div className={`mt-4 border rounded-lg p-3 flex items-start gap-2 ${tone.wrap}`}>
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone.text}`} />
        <div className="min-w-0">
          <p className={`text-sm font-medium ${tone.text}`}>{headline}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
        </div>
      </div>

      {summary.bottleneck && (
        <Link
          to={summary.bottleneck.action.to}
          className="text-xs text-primary hover:underline flex items-center gap-1 mt-3"
        >
          {summary.bottleneck.action.label}
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </section>
  );
}