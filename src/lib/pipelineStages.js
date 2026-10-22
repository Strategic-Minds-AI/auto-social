// The end-to-end content pipeline as one ordered list of stages.
// Every stage is derived from live records, so the page reports the real state
// of the business rather than repeating how it is meant to work.

const day = (value) => (value ? new Date(value).toLocaleDateString() : '');

const clip = (value, limit = 48) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

export function buildPipelineStages(business, d) {
  const posts = d.postStatus || {};
  const planned = posts.planned || 0;
  const approved = posts.approved || 0;
  const scheduled = posts.scheduled || 0;
  const publishing = posts.publishing || 0;
  const published = posts.published || 0;
  const failed = posts.failed || 0;
  const onCalendar = planned + approved + scheduled + publishing + published + failed;
  const inFlight = approved + scheduled + publishing;

  const connected = (d.accounts || []).filter((account) => account.status === 'connected');
  const instagramLinked = connected.some((account) => account.platform === 'instagram');
  const cleared = (d.videos || []).filter((job) => ['passed', 'approved'].includes(job.status)).length;

  const topics = d.topicCount || 0;
  const signals = d.signalCount || 0;
  const simulations = d.simulationCount || 0;
  const metrics = d.metricCount || 0;

  return [
    {
      id: 'profile',
      title: 'Business profile',
      summary: 'What the business is, who it serves, and how it should sound.',
      automation: 'Captured in guided onboarding',
      status: business.onboarded_at ? 'done' : 'action',
      evidence: [
        business.industry || 'no industry set',
        business.website ? 'website on file' : 'no website on file',
        business.onboarded_at ? `onboarded ${day(business.onboarded_at)}` : 'onboarding never finished',
      ].join(' · '),
      action: { label: 'Open business profile', to: '/businesses' },
    },
    {
      id: 'research',
      title: 'Market research',
      summary: 'A dossier on the company, its competitors and what buyers compare.',
      automation: 'Refreshed on the first of each month, or on demand',
      status: d.dossier ? 'done' : 'action',
      evidence: d.dossier
        ? `${d.dossier.engine || 'AI'} dossier · written ${day(d.dossier.generated_at)}`
        : 'no dossier yet',
      action: { label: 'Run business discovery', to: '/intelligence' },
    },
    {
      id: 'topics',
      title: 'Topic ranking',
      summary: 'The subjects this market is actually searching for, ranked by demand.',
      automation: 'Rebuilt with each research run, or on demand',
      status: topics > 0 ? 'done' : 'action',
      evidence: topics
        ? `${topics} ranked topics · ${d.topicsUsed || 0} already built into a plan${
            d.topTopic ? ` · top: ${clip(d.topTopic.topic)}` : ''
          }`
        : 'nothing ranked yet',
      action: { label: 'Rank this month\u2019s topics', to: '/intelligence' },
    },
    {
      id: 'signals',
      title: 'Live market signals',
      summary: 'Trending searches, top-performing videos and news in this industry.',
      automation: 'Read on demand from free public sources',
      status: signals > 0 ? 'done' : 'action',
      evidence: signals
        ? `${signals} live signals · last read ${day(d.latestSignal?.captured_at)}`
        : 'no market read yet',
      action: { label: 'Open Demand Radar', to: '/demand-radar' },
    },
    {
      id: 'simulation',
      title: 'Angle testing',
      summary: 'Competing versions of one idea, scored against the signals before you write.',
      automation: 'Run on demand',
      status: simulations > 0 ? 'done' : 'optional',
      evidence: simulations
        ? `${simulations} angles tested · latest winner: ${clip(
            d.latestSimulation?.winner_hook || d.latestSimulation?.topic
          )}`
        : 'nothing tested yet — an optional step',
      action: { label: 'Test content angles', to: '/demand-radar' },
    },
    {
      id: 'accounts',
      title: 'Channels connected',
      summary: 'The accounts this business is allowed to publish to.',
      automation: 'Re-checked whenever you ask',
      status: connected.length ? 'done' : 'action',
      evidence: connected.length
        ? connected.map((account) => account.name || account.platform).join(' · ')
        : 'no account linked — nothing can publish',
      action: { label: 'Manage social accounts', to: '/social-accounts' },
    },
    {
      id: 'plan',
      title: 'Weekly content plan',
      summary: 'A week of posts built from the ranked topics, ready for your review.',
      automation: 'Planned automatically every Monday at 6am',
      status: onCalendar > 0 ? 'done' : 'action',
      evidence: onCalendar
        ? `${onCalendar} posts on the calendar${
            d.nextPlanned
              ? ` · next: ${clip(d.nextPlanned.title || d.nextPlanned.hook, 40)} (${d.nextPlanned.scheduled_date || 'no date'})`
              : ''
          }`
        : 'no content planned yet',
      action: { label: 'Plan content', to: '/auto-social' },
    },
    {
      id: 'review',
      title: 'Review and approval',
      summary: 'Every post waits for your approval before it can go out.',
      automation: 'Approve here, or by text',
      status: planned > 0 ? 'action' : inFlight + published > 0 ? 'done' : 'idle',
      evidence:
        planned > 0
          ? `${planned} post${planned === 1 ? '' : 's'} waiting for you`
          : inFlight > 0
            ? `${inFlight} approved or queued`
            : 'nothing waiting on you',
      action: { label: 'Open approval queue', to: '/approval-queue' },
    },
    {
      id: 'video',
      title: 'Video for Reels',
      summary: 'Instagram only publishes a Reel once its video has been made and cleared.',
      automation: 'Briefed and collected from Video Studio',
      status: cleared > 0 ? 'done' : (d.videos || []).length > 0 ? 'active' : instagramLinked ? 'action' : 'optional',
      evidence: cleared
        ? `${cleared} cleared video${cleared === 1 ? '' : 's'} ready to publish`
        : (d.videos || []).length > 0
          ? `${d.videos.length} video job${d.videos.length === 1 ? '' : 's'} in progress`
          : instagramLinked
            ? 'no cleared video — Reels cannot publish'
            : 'no cleared video — only needed for Instagram Reels',
      action: { label: 'Open Video Studio', to: '/video-studio' },
    },
    {
      id: 'publish',
      title: 'Publishing',
      summary: 'Approved posts are picked up the moment their time arrives and sent to the linked account.',
      automation: 'Checked every 5 minutes · safe to re-run',
      status: failed > 0 ? 'blocked' : published > 0 ? 'done' : scheduled + publishing > 0 ? 'active' : approved > 0 ? 'active' : 'idle',
      evidence: failed
        ? `${failed} post${failed === 1 ? '' : 's'} failed to publish — open the post for the reason`
        : published > 0
          ? `${published} published${d.lastPublished?.published_at ? ` · last live ${day(d.lastPublished.published_at)}` : ''}`
          : scheduled + publishing > 0
            ? `${scheduled + publishing} queued · next up ${
                d.nextScheduled ? `${d.nextScheduled.scheduled_date || ''} ${d.nextScheduled.scheduled_time || ''}`.trim() : ''
              }`
            : approved > 0
              ? `${approved} approved but not scheduled to a time yet`
              : 'nothing has ever been sent',
      action: { label: 'Open calendar', to: '/calendar' },
    },
    {
      id: 'measure',
      title: 'Performance and learning',
      summary: 'Real views and engagement are read back daily, and they feed the next plan.',
      automation: 'Read back every morning',
      status: metrics > 0 ? 'done' : 'idle',
      evidence: metrics
        ? `${metrics} readings · latest ${day(d.latestMetric?.captured_at)}`
        : 'no numbers read back yet',
      action: { label: 'Open analytics', to: '/analytics' },
    },
  ];
}

export function summarizeStages(stages) {
  const required = (stages || []).filter((stage) => stage.status !== 'optional');
  const done = required.filter((stage) => stage.status === 'done').length;
  const blocked = (stages || []).find((stage) => stage.status === 'blocked') || null;
  const bottleneck =
    blocked ||
    (stages || []).find((stage) => stage.status === 'action') ||
    (stages || []).find((stage) => stage.status === 'active') ||
    null;
  return { done, total: required.length, blocked, bottleneck };
}