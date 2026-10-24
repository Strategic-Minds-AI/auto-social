// The reference behind the Access Map page: what this app can reach today, what
// is one approval away, and what no app is allowed to do. Every line is a plain
// record of this app's real connections and their real limits.

export const CONNECTED = [
  {
    name: 'Facebook Pages',
    detail:
      'Publishes to and reads any Page you link, and all of your Pages can stay linked side by side. Page settings such as the name, About text or cover image cannot be changed — this connection is authorized for posting and reading only.',
  },
  {
    name: 'Instagram',
    detail:
      'Publishes Reels through the linked account and can read and answer messages. The profile name, bio, link and picture cannot be changed by any app, this one included.',
  },
  {
    name: 'LinkedIn',
    detail:
      'Publishes posts to the linked member feed, with the post image attached. LinkedIn does not let apps edit a member profile.',
  },
  {
    name: 'Google Workspace',
    detail:
      'Gmail is read so enquiries can be filed as leads, Calendar is mirrored with your posting schedule, Drive supplies assets, Tasks holds review reminders, and YouTube performance can be read.',
  },
  {
    name: 'Supabase',
    detail:
      'Projects, database, storage, edge functions and secrets can be read and written — this is what the database and automation work runs on.',
  },
];

export const AVAILABLE = [
  {
    name: 'Google Analytics',
    detail:
      'Traffic, behaviour and campaign performance, so reporting is grounded in real numbers instead of guesses.',
  },
  {
    name: 'Google Search Console',
    detail:
      'Search performance, sitemaps and indexing status for your sites, which sharpens the SEO and Discovery work.',
  },
  {
    name: 'X',
    detail:
      'Posting and search. Metered: every single call spends integration credits, so it is used deliberately rather than in loops, and no bulk or repeated automated posting is allowed.',
  },
];

export const BLOCKED = [
  {
    want: 'Changing the profile name, bio, link or picture on Instagram and LinkedIn',
    why:
      'Neither platform offers profile editing to apps at all. This is closed to every tool, not just this one.',
    workaround:
      'Profile Makeover already writes the new name, bio, link and highlight order and renders the avatar and banner images. You paste and upload them — about five minutes per account.',
  },
  {
    want: 'Changing a Facebook Page name, About text or cover image',
    why:
      'The Facebook connection here is authorized for posting and reading only, not for managing Page settings.',
    workaround:
      "The same makeover output applies by hand, and a Page name change goes through Meta's own request flow.",
  },
  {
    want: 'Creating new social accounts from the app',
    why:
      'Every platform forbids programmatic signup. That door is shut because it is how fake-account farms are built.',
    workaround:
      'Brand Kits generate a complete new identity — name, handle, bio, palette, avatar, banner and the first nine posts — ready to register in minutes.',
  },
  {
    want: 'Running several Instagram accounts at the same time',
    why:
      'One Instagram connection is held at a time, and it publishes to whichever account is currently connected.',
    workaround:
      'Switch the connected account when you move to the next brand. Facebook is different: all of your Pages can stay linked at once.',
  },
  {
    want: 'Reaching into your local computer',
    why:
      'A cloud app cannot touch your machine, and this app cannot be exported to run there.',
    workaround:
      'The app publishes its own API and an MCP server, so scripts on your computer can pull and push through it.',
  },
  {
    want: 'Driving ChatGPT from inside the app',
    why:
      'That direction does not exist — one service cannot command ChatGPT on your behalf.',
    workaround:
      'Connect ChatGPT to this app through its MCP server instead, so ChatGPT can read your data and act on it.',
  },
  {
    want: 'Syncing content straight to your websites',
    why:
      'A site can only receive content from here if it has an API or a connector.',
    workaround:
      "WordPress sites connect directly. Anything else is pushed with that site's own API key stored as a secret, or taken out as an export.",
  },
  {
    want: 'Controlling Railway and Vercel from here',
    why:
      'Neither is in this app\'s connection catalog, so there is nothing to click.',
    workaround:
      'Both have REST APIs: a personal token stored as a secret lets the app trigger deploys and read project status.',
  },
  {
    want: 'Publishing to TikTok, and mass following, commenting or group posting',
    why:
      'TikTok posting is not available through this connection, and bulk engagement is banned on every platform — it is the fastest way to lose the accounts.',
    workaround:
      'Keep TikTok and similar networks for research, and let the automations work your own feed, your own Pages and your own messages.',
  },
];

export const RULES = [
  'Your connections act as you. Everything the app publishes goes out through your own accounts, so only give app users access you would trust with them.',
  'Publishing is a pipeline. Nothing leaves the Approval Queue without your approval, and every attempt is logged.',
  'Metered services and AI generations spend integration credits. AI generation already runs through your own keys.',
];

export const CEILING = [
  {
    group: 'Content engine',
    items: [
      'Plan a month of posts from live demand and your own measured winners',
      'Write, illustrate and film from your own AI keys instead of platform credits',
      'Distil any winning format into a reusable template and a timed edit sheet',
    ],
  },
  {
    group: 'Publishing',
    items: [
      'Facebook Pages (all of them), Instagram Reels, LinkedIn and X',
      'TikTok drafts sent to the creator inbox for a one-tap finish',
      'Scheduled, approved, logged and retried, with duplicate protection',
    ],
  },
  {
    group: 'Intelligence',
    items: [
      'Demand Radar reading free public sources, so it costs nothing to run',
      'SEO, keyword and hashtag profiles read from your own website',
      'Benchmark playbooks distilled from measured winners, plus variant simulation before you commit',
    ],
  },
  {
    group: 'Sales and clients',
    items: [
      'Enquiries from Gmail filed as leads, with SMS alerts and approval by reply',
      'HubSpot, Google Contacts and Sheets kept in step',
      'Payments for client work, so the agency side bills inside the same system',
    ],
  },
  {
    group: 'Infrastructure',
    items: [
      'Supabase database, storage, edge functions and secrets',
      'GitHub repositories, and Railway or Vercel deploys through personal tokens',
      'This app has its own API and MCP server, so ChatGPT or Claude can drive it',
    ],
  },
  {
    group: 'The agency ceiling',
    items: [
      'Every client connects their own accounts, so one app serves all of them',
      'Unlimited faceless identities from Brand Kits',
      'Reporting per client built from real platform numbers, not estimates',
    ],
  },
];