import { Link } from 'react-router-dom';
import { usePipeline } from '@/hooks/usePipeline';
import { Button } from '@/components/ui/button';
import { Workflow } from 'lucide-react';
import PipelineStageCard, { STAGE_STATUS } from '@/components/pipeline/PipelineStageCard';
import PipelineSummary from '@/components/pipeline/PipelineSummary';

const LEGEND = ['done', 'active', 'action', 'blocked'];

export default function Pipeline() {
  const { business, ready, loading, stages, summary } = usePipeline();

  if (!ready || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!business?.id) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Workflow className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-space font-semibold text-lg">No business yet</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add a business and this page will show every step from research to published results.
          </p>
          <Button asChild>
            <Link to="/onboarding">Start guided onboarding</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <Workflow className="w-6 h-6 text-primary" /> Content Pipeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every step {business.name} content passes through, and where it currently stands.
        </p>
      </div>

      {summary && <PipelineSummary summary={summary} business={business} />}

      <ol className="space-y-3">
        {stages.map((stage, index) => (
          <PipelineStageCard key={stage.id} stage={stage} step={index + 1} last={index === stages.length - 1} />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>Legend:</span>
        {LEGEND.map((key) => {
          const meta = STAGE_STATUS[key];
          const Icon = meta.icon;
          return (
            <span key={key} className="flex items-center gap-1">
              <Icon className={`w-3 h-3 ${meta.tint}`} />
              {meta.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}