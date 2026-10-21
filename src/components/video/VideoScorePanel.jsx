import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function VideoScorePanel({ job }) {
  const tests = job.tests || [];
  const scores = job.scores || [];

  if (!tests.length && !scores.length) return null;

  return (
    <div className="space-y-4">
      {tests.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Tests</p>
          <ul className="space-y-1.5">
            {tests.map((test) => (
              <li key={test.name} className="flex items-start gap-2 text-xs">
                {test.status === 'pass' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                )}
                <span className="text-muted-foreground">
                  <span className="text-foreground">{test.name}</span> {test.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {scores.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Benchmark {job.benchmark_version} · pass mark {job.benchmark_target}
          </p>
          <ul className="space-y-2">
            {scores.map((score) => (
              <li key={score.key}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{score.label}</span>
                  <span className="font-medium tabular-nums">
                    {score.score}/{score.max}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-secondary mt-1 overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.round((score.score / score.max) * 100)}%` }}
                  />
                </div>
                {score.note && <p className="text-xs text-muted-foreground mt-1">{score.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}