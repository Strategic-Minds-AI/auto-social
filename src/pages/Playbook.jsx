import { Trophy, TrendingUp, Sparkles, ShieldAlert, Target } from 'lucide-react';
import { BENCHMARKS, GROWTH, AVATARS, DISCLOSURE, ACTIONS } from '@/lib/growthPlaybook';
import PageSection from '@/components/common/PageSection';
import BenchmarkCard from '@/components/playbook/BenchmarkCard';
import GrowthStep from '@/components/playbook/GrowthStep';

export default function Playbook() {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-10">
      <div>
        <h1 className="font-space font-bold text-2xl flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" /> Growth Playbook
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How the leading autonomous systems are actually built, and the documented path that grows a
          faceless or avatar account — with the disclosure rules that now come with it.
        </p>
      </div>

      <PageSection
        icon={Trophy}
        title="The systems at the top"
        subtitle="What they do, and the mechanics underneath."
      >
        <div className="space-y-2">
          {BENCHMARKS.map((item) => (
            <BenchmarkCard key={item.name} {...item} />
          ))}
        </div>
      </PageSection>

      <PageSection
        icon={TrendingUp}
        title="The growth playbook"
        subtitle="The documented route from zero to a first real audience, in order."
      >
        <div className="space-y-2">
          {GROWTH.map((item, index) => (
            <GrowthStep key={item.step} index={index + 1} {...item} />
          ))}
        </div>
      </PageSection>

      <PageSection
        icon={Sparkles}
        title="Faceless and avatar accounts"
        subtitle="Where avatars are now, and how to run one without losing the account."
      >
        <ul className="space-y-2">
          {AVATARS.map((line) => (
            <li
              key={line}
              className="text-xs text-muted-foreground bg-surface-2 border border-border rounded-lg p-3 leading-relaxed"
            >
              {line}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        icon={ShieldAlert}
        title="Disclosure rules for AI content"
        subtitle="What each platform requires once the content is synthetic."
      >
        <div className="space-y-2">
          {DISCLOSURE.map((item) => (
            <div key={item.platform} className="bg-card border border-border rounded-xl p-4">
              <p className="text-sm font-medium">{item.platform}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.rule}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection icon={Target} title="What to do with this, in this app">
        <ul className="space-y-2">
          {ACTIONS.map((line) => (
            <li
              key={line}
              className="text-xs text-muted-foreground bg-card border border-border rounded-lg p-3 leading-relaxed"
            >
              {line}
            </li>
          ))}
        </ul>
      </PageSection>
    </div>
  );
}