import { Link } from 'react-router-dom';
import { CheckCircle2, Plug, ShieldCheck, KeyRound, Layers } from 'lucide-react';
import { CONNECTED, AVAILABLE, BLOCKED, CEILING, RULES } from '@/lib/accessMap';
import StatusRow from '@/components/accessmap/StatusRow';
import BlockedRow from '@/components/accessmap/BlockedRow';
import PageSection from '@/components/common/PageSection';
import { Button } from '@/components/ui/button';

export default function AccessMap() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-primary" /> Access Map
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything this app can reach now, everything one approval away, everything no app is allowed
          to do — and the ceiling it can be built out to.
        </p>
      </div>

      <PageSection icon={CheckCircle2} title="Connected now" subtitle="Live on your account today.">
        <div className="space-y-2">
          {CONNECTED.map((item) => (
            <StatusRow key={item.name} {...item} state="connected" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/social-accounts">
            <Button variant="outline" size="sm">Manage accounts</Button>
          </Link>
          <Link to="/profile-makeover">
            <Button variant="outline" size="sm">Open Profile Makeover</Button>
          </Link>
        </div>
      </PageSection>

      <PageSection
        icon={Plug}
        title="One approval away"
        subtitle="Not connected yet — each one shows a consent prompt when you ask for it."
      >
        <div className="space-y-2">
          {AVAILABLE.map((item) => (
            <StatusRow key={item.name} {...item} state="available" />
          ))}
        </div>
      </PageSection>

      <PageSection
        icon={Layers}
        title="The ceiling"
        subtitle="Everything this app can be built out to, using the connections above."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {CEILING.map((group) => (
            <div key={group.group} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-medium mb-2">{group.group}</p>
              <ul className="space-y-1.5">
                {group.items.map((line) => (
                  <li key={line} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection
        icon={ShieldCheck}
        title="Not possible — and what to do instead"
        subtitle="The walls worth knowing before you plan around them."
      >
        <div className="space-y-2">
          {BLOCKED.map((item) => (
            <BlockedRow key={item.want} {...item} />
          ))}
        </div>
      </PageSection>

      <PageSection icon={ShieldCheck} title="The three rules behind all of it">
        <ul className="space-y-2">
          {RULES.map((rule) => (
            <li
              key={rule}
              className="text-sm text-muted-foreground bg-surface-2 border border-border rounded-lg p-3 leading-relaxed"
            >
              {rule}
            </li>
          ))}
        </ul>
      </PageSection>
    </div>
  );
}