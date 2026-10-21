import { Loader2, RefreshCw, TrendingUp, Users, MessageCircleQuestion, Lightbulb, Swords, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Section({ icon: Icon, title, body }) {
  if (!body) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function ChipList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-muted-foreground flex gap-2">
            <span className="text-primary flex-shrink-0">•</span>
            <span>{typeof item === 'string' ? item : item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DiscoveryPanel({ discovery, running, onRun }) {
  if (!discovery) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
        <Globe className="w-7 h-7 text-muted-foreground mx-auto" />
        <div>
          <h2 className="font-space font-semibold">No dossier yet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            The skip trace reads your live website, then writes up the company, its industry, its services and what
            customers ask before they buy.
          </p>
        </div>
        <Button onClick={onRun} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {running ? 'Researching...' : 'Run skip trace'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Globe className="w-3 h-3" /> {discovery.website_note || 'Research completed'}
          {discovery.generated_at && ` · ${new Date(discovery.generated_at).toLocaleDateString()}`}
        </p>
        <Button onClick={onRun} disabled={running} variant="outline" size="sm" className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Re-run
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <Section icon={TrendingUp} title="Company profile" body={discovery.company_profile} />
          <Section icon={Users} title="Audience insights" body={discovery.audience_insights} />
          <Section icon={Lightbulb} title="Positioning" body={discovery.positioning} />
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <Section icon={Globe} title="Industry overview" body={discovery.industry_overview} />
          {discovery.services?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Services found</h3>
              <ul className="space-y-2">
                {discovery.services.map((service, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{service.name}</span>
                    {service.description && (
                      <span className="text-muted-foreground"> — {service.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ChipList title="Competing options" items={discovery.competitors} />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <Section icon={MessageCircleQuestion} title="What customers ask" body={null} />
          <ChipList title="" items={discovery.questions_people_ask} />
          {!discovery.questions_people_ask?.length && (
            <p className="text-sm text-muted-foreground">No questions were captured in this run.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <Section icon={Swords} title="Worth talking about" body={null} />
          <ChipList title="" items={discovery.talking_points} />
          {!discovery.talking_points?.length && (
            <p className="text-sm text-muted-foreground">No talking points were captured in this run.</p>
          )}
        </div>
      </div>
    </div>
  );
}