# AUTO SOCIAL — Implementation Workbook

Living handoff document. Last updated: 2026-10-21 (batch 1: AI gateway verified + AI Content Studio).

---

## 1. Architecture and integration inventory

| Layer | Component | Status |
|---|---|---|
| AI (text) | Railway AI Gateway (own infra) | **Connected and verified** |
| AI (image/video) | Base44 `GenerateImage` / `GenerateVideo` | Connected, consumes Base44 integration credits |
| Social publishing | Facebook Pages connector | **Authorized, not yet wired to a publish pipeline** |
| Social publishing | Instagram Business / LinkedIn / X / TikTok | **Not authorized — publishing impossible** |
| Scheduling | Base44 workflow `Auto Social Weekly Plan` | Active (Mondays 06:00 UTC) |
| Data | Business, Campaign, ContentPiece, ScheduledPost, ContentDraft | Active, RLS enforced |

### Backend functions
- `generateAutoSocialPlan` — plans a calendar of `ScheduledPost` rows via the Railway gateway. Admin-only.
- `generateStudioContent` — **new.** Writes content drafts (create / rewrite / variation) via the Railway gateway and persists them as `ContentDraft` records.

### Shared modules
- `base44/shared/aiClient.ts` — the single AI entry point (`generateJson`, `generateJsonWithMeta`, `aiConfig`, `aiProviderHost`). All AI text generation must go through this file; never duplicate gateway logic into a function.

### Frontend pages
`/businesses`, `/businesses/new`, `/businesses/edit/:id`, `/campaigns`, `/campaigns/new`, `/campaigns/:id`, `/content`, `/studio` (**new**), `/auto-social`.

---

## 2. Source repository

- Repository: `https://github.com/Strategic-Minds-AI/auto-social`
- Branch: `main`
- Commit at start of batch 1: `ce2d905`
- Remotes configured: `origin`, `github`

## 3. Environment variables (names only — never values)

| Name | Purpose | State |
|---|---|---|
| `AI_BASE_URL` | Railway gateway OpenAI-compatible endpoint | Set |
| `AI_API_KEY` | Must equal the Railway `GATEWAY_CLIENT_KEY` | Set |
| `AI_MODEL` | `openai/gpt-oss-20b` | Set |
| `AI_UPSTREAM_API_KEY` | Railway-side upstream provider key | Railway only |
| `GATEWAY_CLIENT_KEY` | Railway-side client key | Railway only |
| `BROWSER_ENGINE_URL` / `BROWSER_ENGINE_API_KEY` | Browser-automation engine | **Not set — user skipped** |

---

## 4. Completed in batch 1

1. **Verified the Railway gateway for real** (not assumed) — see test records below.
2. **Hardened `base44/shared/aiClient.ts`**: explicit token ceiling, 3 attempts with exponential backoff, 120s timeout, retry only on transient statuses, sanitized error text, JSON fence stripping and brace-recovery, and `meta` reporting (provider host, model, attempts, token usage) on every call.
3. **New entity `ContentDraft`** with owner-or-admin row-level security.
4. **New function `generateStudioContent`** — three modes (create, rewrite, variation), server-side validation, RLS-scoped business lookup, persists drafts with the engine that produced them.
5. **New AI Content Studio page** (`/studio`) with draft list, edit, delete, copy, and the connected engine shown on screen.
6. **Tenant isolation repaired** — `Business`, `Campaign` and `ContentPiece` previously had **no access rules at all**; all three now use owner-or-admin on read/update/delete and creator-only on create.
7. **Sidebar branding corrected** to "Auto Social" and a Content Studio nav entry added.

## 5. Incomplete / not yet started

- Publishing engine (Facebook only path available today).
- Instagram / LinkedIn / X / TikTok account connection flows.
- Content calendar with day/week/month views and drag-and-drop.
- Media library.
- Analytics dashboard on real provider metrics.
- Approval queues and status workflow beyond draft/approved/archived.
- Client workspace isolation beyond RLS (no workspace/team membership model yet).
- Remaining Base44-credit text generation in the frontend (see section 7).

---

## 6. Test records

All results below are from real executions.

| Test | Expected | Observed | Verdict |
|---|---|---|---|
| Gateway `/ready` | 200 | `200` | **PASS** |
| Authenticated completion | 200 + real text | `200`, returned `GATEWAY OK` | **PASS** |
| Unauthenticated completion | rejected | `401` | **PASS** |
| Structured JSON output | valid JSON | `{"ok":true,"word":"banana"}` | **PASS** |
| Studio `create`, 2 posts, Instagram | 200 + 2 drafts saved | `200`, 2 drafts, provider + model recorded | **PASS** |
| Studio `variation`, 2 posts, LinkedIn | 200 + 2 saved | `200`, 2 variants saved | **PASS** |
| Validation: no brief | 400 | `400 "Describe what you want the posts to be about."` | **PASS** |
| Validation: business not visible to caller | 403 | `403 "That business is not available to you."` | **PASS** |
| Production build | no errors | clean (`vite build`) | **PASS** |
| Draft persistence + retrieval | saved record readable | `ContentDraft` rows returned with ids and timestamps | **PASS** |
| Publishing to a live platform | — | no authorized account yet | **BLOCKED** |
| Analytics from providers | — | no authorized account yet | **BLOCKED** |

Latency: gateway round trip ≈ 2.8–3.1s for a 2-post generation on `openai/gpt-oss-20b`.

## 7. Known defects, fixes and risks

**Fixed**
1. **Empty AI responses.** `openai/gpt-oss-20b` is a reasoning model: it spends tokens on hidden reasoning before emitting content. With a low or absent token ceiling the response comes back with empty content and no error. Fixed with an explicit `max_tokens` ceiling (4000) plus a `finish_reason: "length"` specific error message.
2. **No resilience on gateway calls.** A single transient 429/5xx or a hung socket failed the whole generation. Fixed with bounded retry, exponential backoff and a hard timeout.
3. **Upstream error bodies surfaced to the UI.** Now sanitized before display.
4. **Open tenant data.** `Business`, `Campaign`, `ContentPiece` had no RLS — any signed-in user could read, modify or delete every record in the app. Now owner-or-admin.

**Outstanding**
5. **Frontend still spends Base44 AI credits.** `src/pages/CampaignDetail.jsx`, `src/pages/CampaignWizard.jsx` and `src/components/content/ContentPieceCard.jsx` call `base44.integrations.Core.InvokeLLM` directly. Text generation should move to the gateway; image/video generation must stay on Base44 integrations.
6. **No idempotency keys** on generation or (future) publishing.
7. **No AI spend ceiling** — no per-user rate limit or budget cap on gateway calls.
8. **Publishing is unproven.** Nothing has been posted to a live platform.

## 8. Agent and automation workflows

- `Auto Social Weekly Plan` — weekly Monday 06:00 UTC, calls `generateAutoSocialPlan` to top up each business's calendar.
- No agent infrastructure yet. Recommended shape: one shared job record plus reusable prompt stages (strategy → writing → brand check → hashtags → QA), **not** separate schedulers per stage.

## 9. Deployment and validation receipts

- Batch 1 validation: gateway probe, 4 function invocations (2 positive, 2 negative), production build, entity read-back.
- Temporary QA business and its 4 drafts were created for testing and **deleted afterwards** (0 test records remain).

## 10. External dependencies and blockers

| Blocker | Impact | Owner |
|---|---|---|
| Instagram Business not authorized | No Instagram publishing or metrics | User action |
| LinkedIn not authorized | No LinkedIn publishing | User action |
| X not authorized (shared-only connector) | No X publishing | User action |
| TikTok connector read-only | Publishing impossible by design | Platform limitation |
| No live social account on any platform | Publishing and analytics untestable | User action |
| Browser engine secrets not set | No browser-automation features | User action |

## 11. Exact next actions

1. Connect one real Facebook Page and build the publish pipeline end to end (create → validate → approve → publish → confirm platform post id → record error on failure).
2. Move the remaining frontend text generation off Base44 credits onto the gateway.
3. Add per-user rate limiting and a spend cap on gateway calls.
4. Build the calendar view over `ScheduledPost` with statuses and approval.
5. Add analytics using real Facebook Page insights only, and label every metric that is unavailable.
6. Authorize Instagram Business and LinkedIn, then extend publishing to them.