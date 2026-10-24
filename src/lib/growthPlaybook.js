// Benchmarks and growth strategy behind the Playbook page. Every line comes from
// published sources on how the leading autonomous systems are built and what
// measurably grows accounts — not theory.

export const BENCHMARKS = [
  {
    name: 'Artisan (Ava)',
    what:
      'An autonomous outbound rep: it sources prospects, writes and sends multichannel sequences, handles the replies and books the meetings.',
    how:
      'One agent owns the whole job instead of stitched tools. There is an explicit autonomy dial — review and approve, objections only, or full autonomy — with plain-language escalation rules and a full audit trail, and over 90% of their customers run it fully autonomous. Deliverability is treated as a product feature: mailbox provisioning, sending ramp-up, SPF/DKIM/DMARC checks, placement testing and automatic pausing of mailboxes that start bouncing. Dozens of message variants run at once and volume shifts to whichever performs at component level.',
    takeaway:
      'The autonomy dial plus an audit trail is what lets an owner leave it running. Quality gates before sending beat raw volume.',
  },
  {
    name: '11x (Alice and Julian)',
    what:
      'Digital workers: Alice runs multichannel outbound, Julian is an AI phone agent.',
    how:
      'Sequences span email, social and voice, sold on enterprise terms with guided onboarding. The phone agent is the headline feature, which is what separates it from cheaper email-only tools.',
    takeaway:
      'A channel nobody else automates is a positioning moat, not just another feature.',
  },
  {
    name: 'HeyGen and Synthesia',
    what:
      'Avatar video at industrial scale: a presenter that speaks any script, plus one personalised video per prospect.',
    how:
      'Custom avatars are built from a person or a single photo, then the API generates thousands of unique videos in which each prospect hears their own name and company spoken by a realistic presenter. Blind studies put acceptance at roughly 85 to 95% for product demos, training and explainer content, and the newest avatars hold live conversations instead of reading a script.',
    takeaway:
      'Personalised video at scale is the current noise-breaker — and both vendors expect you to disclose that it is AI.',
  },
  {
    name: 'The pattern behind all of them',
    what: 'What the leaders share, in one line each.',
    how:
      'One loop that owns the entire job rather than ten tools talking to each other; an autonomy dial with escalation; hard quality gates before anything ships; variant testing at component level; a complete audit trail; and pricing by outcome rather than by seat.',
    takeaway:
      'This app already has the loop, the approval gate, the variant testing and the audit trail. That is the shape of the winners.',
  },
];

export const GROWTH = [
  {
    step: 'Pick one narrow promise',
    detail:
      'A faceless account wins on one subject, never five. Brand Kits write that promise, the handle, the bio and the first nine posts, so the profile reads as a single clear offer from the first visit.',
  },
  {
    step: 'Prime the account before you post',
    detail:
      'The documented sprint that took a brand-new faceless account from zero to 15,000 followers in 30 days began with two to three days of doing nothing but engaging niche content — an hour a day, 10 to 20 posts each hour. Instagram reads that as relevance before it decides who sees your first post. This step needs your hands, not the app.',
  },
  {
    step: 'Post short, and keep the cadence',
    detail:
      'Ten to fifty second videos held the best watch time in that same case study. A cadence you can actually keep beats chasing volume — which is exactly what the scheduling pipeline is for.',
  },
  {
    step: 'Win the first three seconds',
    detail:
      'The same sprint targeted 75% of viewers still watching at three seconds. Hooks in the Content Library exist so proven lines get reused instead of new ones being invented under time pressure.',
  },
  {
    step: 'Judge content by watch time, not likes',
    detail:
      'Watch time above 50% and one new follower per 100 views was the aggressive target, with one per 1,000 as the wider benchmark. Likes flatter; those two numbers decide whether an account actually grows.',
  },
  {
    step: 'Double down on what wins',
    detail:
      'Compare topics and formats on measured numbers rather than memory — that is what the analytics views and the simulation are for. Winners then go back into generation through the Library so the account compounds.',
  },
];

export const AVATARS = [
  'Avatars now pass casual inspection for demos, training and explainer content, and they accept a script in any language.',
  'The winning outreach use is personalisation at scale: one presenter saying 10,000 different names beats one generic video.',
  'Personal and custom avatars are built from your own face or a single photo, which is also how you keep a face consistent across accounts.',
  'The rule that comes with the technology: disclose it. The vendors expect disclosure and the platforms now require it.',
];

export const DISCLOSURE = [
  {
    platform: 'Meta',
    rule:
      'Photorealistic AI-generated or AI-manipulated creative must be disclosed through the Ads Manager control. Detected but undisclosed content gets labelled, and video judged deceptive — especially with synthetic voice or music — has been reported losing up to roughly 80% of its reach.',
  },
  {
    platform: 'TikTok',
    rule:
      'AI-generated or significantly edited content showing realistic people or scenes must be labelled. There is no published list of cosmetic edits that are exempt, so the realistic-looking test is the whole rule.',
  },
  {
    platform: 'YouTube',
    rule:
      'Realistic altered or synthetic media must be disclosed. The label sits in the description for most videos and becomes prominent on health, news, elections and finance topics.',
  },
  {
    platform: 'EU AI Act',
    rule:
      'Article 50 duties for deepfake-style content and synthetic media apply from 2 August 2026, with machine-readable marking required at the provider level.',
  },
];

export const ACTIONS = [
  'One Brand Kit per account, one promise each — the identity work is already done for you, the registration takes minutes.',
  'Feed generation from the Content Library so proven hooks compound instead of being reinvented every week.',
  'Keep the makeover checklist to hand: five minutes per account applies the new name, bio, link and images by hand.',
  'Disclose AI wherever an avatar or a synthetic scene ships. It is platform policy now and law soon.',
  'Skip the shortcuts that end accounts: mass following, mass commenting, unsolicited DMs and group posting.',
];