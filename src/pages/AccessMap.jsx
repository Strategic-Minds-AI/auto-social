import { Link } from 'react-router-dom';
import { CheckCircle2, Plug, ShieldCheck, KeyRound } from 'lucide-react';
import { CONNECTED, AVAILABLE, BLOCKED, RULES } from '@/lib/accessMap';
import StatusRow from '@/components/accessmap/StatusRow';
import BlockedRow from '@/components/accessmap/BlockedRow';
import { Button } from '@/components/ui/button';

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-space font-semibold text-lg flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" /> {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function AccessMap() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-primary" /> Access Map
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Everything this app can reach, everything that needs one approval, and everything no app is
          allowed to do — with what to do instead. Ask for any of the middle list and it gets connected.
        </p>
      </div>

      <Section
        icon={CheckCircle2}
        title="Connected now"
        subtitle="Live on your account today."
      >
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
      </Section>

      <Section
        icon={Plug}
        title="One approval away"
        subtitle="Not connected yet — each one shows a consent prompt when you ask for it."
      >
        <div className="space-y-2">
          {AVAILABLE.map((item) => (
            <StatusRow key={item.name} {...item} state="available" />
          ))}
        </div>
      </Section>

      <Section
        icon={ShieldCheck}
        title="Not possible — and what to do instead"
        subtitle="These are the walls worth knowing before you plan around them."
      >
        <div className="space-y-2">
          {BLOCKED.map((item) => (
            <BlockedRow key={item.want} {...item} />
          ))}
        </div>
      </Section>

      <Section icon={ShieldCheck} title="The three rules behind all of it">
        <ul className="space-y-2">
          {RULES.map((rule) => (
            <li key={rule} className="text-sm text-muted-foreground bg-surface-2 border border-border rounded-lg p-3 leading-relaxed">
              {rule}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}