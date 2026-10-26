# AUTO SOCIAL — X1 Foundation handoff

What this system is, what it can reach, what runs on its own, and the handful of things
no software is allowed to do. Written for whoever (or whatever) picks the system up next.

## The loop

```
demand (Radar)  ->  plan (Autopilot)  ->  write (Studio + Library)
      ^                                         |
      |                                         v
measure (Metrics)  <-  publish (Publisher)  <-  approve (Queue)
                              ^
                              |
                    self-heal (Watchdog)  <- every 15 min
```

The watchdog is the part that closes it: it repairs stalled work, hands due work to the
publisher, and reports only what a person must do.

## What runs by itself

| Workflow | Cadence | What it does |
| --- | --- | --- |
| System Watchdog | every 15 min | Self-heal sweep, then a digest email if anything needs a person |
| Publish Due Posts | every 5 min | Claims and publishes every due post exactly once |
| Auto Social Weekly Plan | weekly | Plans the coming Monday to Sunday from research, saved patterns and ranked topics |
| Demand Radar Scan | scheduled | Free public trend sources into ranked signals |
| Inbox to Leads | scheduled | Gmail enquiries filed as leads |
| Performance Sync | scheduled | Real platform numbers into PostMetric |
| Google Workspace Sync | scheduled | Calendar and Tasks mirrored with the posting schedule |

Paused on purpose: Video Factory and Monthly Content Autopilot. Both spend credits by the
minute, so they run only when deliberately started.

## The self-healing loop

`base44/functions/systemWatchdog/entry.ts` — admin-only, run by the workflow above and on
demand from the System Health page. Every repair is idempotent and bounded.

Detected and repaired without a person:

1. A post left mid-publish by a run that died: the stale lock is released and the post is
   put back in the queue or back to approved.
2. A post with no publishable instant: the UTC instant is rebuilt from its day, time and
   zone, so it can actually go out.
3. An approved post past its slot that was never queued: handed to the publisher (approval
   was already given, so nothing is sent unasked).
4. A publish failure that reads as transient (timeout, rate limit, 5xx, network): re-queued
   with a hard ceiling of two extra attempts, so it can never loop forever.
5. A video job stalled in flight: re-queued, or set aside after three attempts so it stops
   burning credits.
6. Anything due is flushed straight to the publisher at the end of the sweep.

Detected and reported as needs-the-owner (no code can decide these):

- a connection whose token has died (`needs_reauth`)
- a connector the app publishes through being unreachable
- a post that failed for a permanent reason, with the platform's own error text
- a post over a day past its slot that is still unapproved
- the daily AI budget being used up or nearly used up

Every finding is one row in `SystemIssue` keyed by a stable dedupe key, so a recurring
problem accumulates occurrences instead of spamming the board. A problem that is gone next
sweep clears itself. The sweep suspends that clearing pass if any detector itself failed,
so a broken check can never look like a clean system.

**Health figure**: repaired ÷ detected over the last 24 hours, shown against a 90% target on
the System Health page. Anything below 90% means a class of problem is reaching you that the
loop should be handling.

## Cost guardrails

- Every AI call goes through `generateJsonWithMeta` in `base44/shared/aiClient.ts`, which
  enforces the daily budget before the request is made. A caller that forgets to check cannot
  spend past the cap.
- The ledger is per user per UTC day in `AiUsage`: 250 requests and 500,000 tokens
  (`base44/shared/access.ts`). Raise those two constants to go higher.
- The two generators that previously bypassed the ledger — the weekly planner and Content
  Studio — now check the budget and record their usage like every other caller.
- External AI (Groq/Ollama/vLLM behind `AI_BASE_URL`) means generation runs on the owner's own
  keys, never Base44 credits. It fails closed if the secrets are missing rather than silently
  falling back to paid credits.
- The watchdog reports budget state at 80% and pauses generation at 100%.

## Security posture (audited this pass)

- All 23 entities carry row-level security. `User` is the only one without a top-level rule,
  which is correct: the platform governs it.
- Every function that uses the service role resolves the tenant first through
  `base44/shared/access.ts` (`resolveBusiness` / `resolvePost` / `resolveCampaign`), so a
  forged business, campaign or post id in a direct request is rejected even though the caller
  is authenticated. Verified across all 25 functions.
- Admin-only functions (`publishDuePosts`, `generateAutoSocialPlan`, `systemWatchdog`, and the
  scheduled tasks) authenticate with `base44.auth.me()` and reject anyone but an admin.
- The Twilio inbound webhook validates the provider's request signature before trusting a
  message.
- Connector tokens are read server-side only. Nothing in the browser holds one.

## What no app is allowed to do

- Edit profile name, bio, link or picture on Instagram and LinkedIn. Closed to every tool.
  Profile Makeover writes the new copy and renders the avatar and banner; a person pastes them.
- Change a Facebook Page's name, About text or cover image. The connection is for posting and
  reading.
- Create social accounts programmatically. Brand Kits generate the identity instead.
- Post to TikTok directly. A finished video is sent to the creator inbox as a draft for a
  one-tap finish until the app itself is audited by TikTok.
- Run several Instagram accounts at once. One Instagram connection is held at a time;
  Facebook is different and can hold every Page at once.
- Reach the owner's own computer. The app is cloud-only and publishes its own API and MCP
  server instead.

## Where to look

- **System Health** — `/system-health`: self-healing rate, what needs you, AI budget today.
- **Access Map** — `/access-map`: every connection, what it can do, what it cannot.
- **Approval Queue** — `/approval-queue`: review, approve, retry, reschedule.
- **Social Accounts** — `/social-accounts`: reconnect anything that needs it.
- Dashboard Workflows: run history for every workflow above.

## Next

1. Publish one real post end to end through Facebook, then Instagram, LinkedIn and X, and
   confirm the receipt lands in `PostMetric` on the next Performance Sync.
2. Give the in-app assistant (Eden Skye) the watchdog as a tool, so "fix anything broken" can
   be asked for in chat as well as on a schedule.
3. Move usage recording next to the budget check inside `aiClient` so the ledger cannot be
   bypassed by a future caller that forgets to record (today it is per call site).
4. Point the app's own domain at the live URL so deep links in the digest email use it.