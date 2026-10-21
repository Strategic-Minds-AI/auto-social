# AUTO SOCIAL — Implementation Workbook

Living handoff document. Single source of truth — do not create another.

- Phase 1 baseline commit: `3a947ec87134d7b9a76d29f71fff41e07ae1a2ab`
- Phase 2 starting commit: `3a947ec87134d7b9a76d29f71fff41e07ae1a2ab`
- Phase 2 ending commit: `PENDING_COMMIT_SHA`
- Last updated: 2026-10-21 (Phase 2)

---

## 1. Status at a glance

| Area | State |
|---|---|
| Text AI on own gateway | **Complete** — zero direct Base44 text-AI calls remain |
| Image / video AI | On existing Base44 integrations, unchanged (as instructed) |
| Approval + scheduling engine | **Complete and tested** |
| Facebook publishing pipeline | **Complete and validated end to end, never fired at a live Page** |
| Tenant isolation | **Enforced + tested** |
| Media library | Not started |
| Analytics | Not started |
| Remaining UI pages (Dashboard, Settings) | Not started |

---

## 2. Architecture and integration inventory

| Layer | Component | Status |
|---|---|---|
| AI (text) | Railway AI Gateway | Live, all text generation routed here |
| AI (image/video) | Base44 `GenerateImage` / `GenerateVideo` | Unchanged |
| Social publishing | Facebook Pages connector | Authorized, **12+ Pages discoverable, publishing verified to the token level** |
| Social publishing | Instagram / LinkedIn / X / TikTok | Not authorized — publishing refuses with a clear message |
| Scheduling | `Auto Social Weekly Plan` (Mon 06:00) | Active, unchanged, not duplicated |
| Scheduling | `Publish Due Posts` (every 5 min) | Active, new |

### Backend functions

| Function | Purpose |
|---|---|
| `generateAutoSocialPlan` | Weekly calendar planning. Unchanged. |
| `generateStudioContent` | Content Studio drafts. Unchanged. |
| `generateText` | **New.** All four migrated text tasks (`business_analysis`, `campaign_strategies`, `campaign_content`, `video_prompt`) on the gateway, with real website retrieval and per-user budget. |
| `manageScheduledPost` | **New.** The approval/scheduling state machine and single-post publishing. |
| `publishDuePosts` | **New.** The durable publishing job: claims due posts, publishes once, records receipts. |
| `facebookAccounts` | **New.** Page discovery (incl. Business Manager merge), linking, verification. |

### Shared modules (single source of truth, never duplicated into functions)

| Module | Responsibility |
|---|---|
| `base44/shared/aiClient.ts` | Gateway calls: retries, timeout, token ceiling, JSON recovery, provider reporting. |
| `base44/shared/access.ts` | Tenant resolution, per-user daily AI budget, receipt helper. |
| `base44/shared/time.ts` | Local-time → UTC conversion with DST handling. |
| `base44/shared/facebook.ts` | Graph API: page listing, token derivation, publishing, follower counts. |

### Entities

`Business`, `Campaign`, `ContentPiece`, `ContentDraft`, `ScheduledPost` (extended), **`SocialAccount`** (new), **`AiUsage`** (new).

`ScheduledPost` gained: `timezone`, `scheduled_at`, `social_account_id`, `campaign_id`, `content_draft_id`, `approved_by/at`, `approval_note`, `cancelled_reason`, `idempotency_key`, `lock_token`, `locked_at`, `publish_attempts`, `max_attempts`, `last_attempt_at`, `published_at`, `published_url`, `publish_history`, and the statuses `approved`, `publishing`, `cancelled`.

### Pages

`/calendar`, `/approval-queue`, `/social-accounts` are new and in the sidebar. Existing pages unchanged except the AI migration.

---

## 3. Environment variables (names only — never values)

`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` — all set and verified.
No new secrets were required for this phase.

---

## 4. Priority 1 — Base44 text AI eliminated

All four call sites now route through `generateText`:

| File | Was | Now |
|---|---|---|
| `src/pages/CampaignDetail.jsx` | `Core.InvokeLLM` | `generateText` → `campaign_content` |
| `src/pages/CampaignWizard.jsx` | `Core.InvokeLLM` | `generateText` → `campaign_strategies` |
| `src/components/content/ContentPieceCard.jsx` | `Core.InvokeLLM` | `generateText` → `video_prompt` |
| `src/pages/BusinessForm.jsx` | `Core.InvokeLLM` with `add_context_from_internet` | `generateText` → `business_analysis` |

Verified: `grep -rn "InvokeLLM" src/` returns **none**.

**Website research is genuine, not implied.** The Business Form previously passed `add_context_from_internet: true`, which the gateway model cannot honour. The function now fetches the page server-side, strips it to text, and hands the real content to the model. The model is explicitly told to say when nothing was retrieved, and the UI shows "Read the live page at <url>" or the exact reason it could not. Private and internal hosts are refused.

**Cost controls:** per-user daily budget of 250 calls and 500,000 tokens (`AiUsage` entity), enforced *before* any request, returning HTTP 429 with the reset time. Every response reports provider host, model, attempt count and token usage. Retries: 3 attempts with exponential backoff, 120s timeout, retry only on 408/425/429/5xx.

---

## 5. Priorities 2 & 3 — Scheduling, approval and publishing

**State machine:** `planned` → `approved` → `scheduled` → `publishing` → `published` / `failed`, plus `cancelled` and a step back to review. Illegal transitions are refused with HTTP 409.

**Timezone:** a post stores a local date, local time and an IANA zone. The UTC due instant is derived, and DST is handled by a two-pass offset resolution.

**Safety design — a post is never published by accident:**
- Only `scheduled` posts are ever picked up. Planned and approved posts are untouched.
- A run claims a post by writing a lock token then re-reading to confirm it holds the claim, so two overlapping runs cannot both send the same post.
- A post that already carries a Facebook post id is skipped, never re-sent.
- `idempotency_key` is re-minted whenever the slot changes.
- Attempts are bounded (default 3) and spaced by a 5-minute backoff, so a broken connection fails visibly instead of retrying forever.
- Locks abandoned by an interrupted run are released automatically after 10 minutes.
- Every transition appends a dated receipt to `publish_history`.
- "Publish now" in the UI requires an explicit confirmation naming the Page and the text.

**Page access tokens are never stored or sent to the browser.** They are derived on demand inside the function, used, and discarded. The discovery endpoint exposes page identity only.

**Facebook Business Manager Pages are included**, by querying both `client_pages` and `owned_pages` per business and merging by id, with the Business Manager label never overwritten by a null.

---

## 6. Test results — all executed, none assumed

| Test | Expected | Observed | Verdict |
|---|---|---|---|
| `grep InvokeLLM src/` | no matches | none | **PASS** |
| Business analysis via gateway + live site fetch | real analysis, research flag | 200, real analysis, `website_researched: true`, 2492 tokens | **PASS** |
| Facebook `discover` | real Pages | 200, 12+ real Pages, all `has_token: true`, Business Manager merge populated | **PASS** |
| Approve transition | `approved`, approver recorded | `approved`, `j.xpsxpress@gmail.com` | **PASS** |
| Illegal transition (approve twice) | 409 | 409 "A approved post cannot be approved." | **PASS** |
| Schedule → UTC, EDT | `2026-10-22T13:00:00.000Z` | exact match | **PASS** |
| DST boundary, EST side | `2026-03-07T14:00:00.000Z` | exact match | **PASS** |
| DST boundary, EDT side | `2026-03-09T13:00:00.000Z` | exact match | **PASS** |
| Page association persists | `social_account_id` saved | saved; `idempotency_key` minted from the slot | **PASS** |
| Dry-run publish, single post | validates, sends nothing | `dry: true`, account named, status released, no post id | **PASS** |
| Dry-run via the scheduled job | full job path, sends nothing | `outcome: dry_run`, "Ready to publish to Epoxy Floors Now." | **PASS** |
| Double-post prevention | skip already-published | "Already published." — no network call | **PASS** |
| Retry backoff | due-but-just-attempted skipped | filtered out of candidates, then picked up once cleared | **PASS** |
| Lock release | no stuck lock | `lock_token` empty after the run | **PASS** |
| Premature firing | far-future post untouched | job processed 0 | **PASS** |
| Forged business id | 403 | 403 "That post belongs to a business you cannot access." | **PASS** |
| Unknown post id | 404 | 404 | **PASS** |
| Forged account id (other business's Page) | 403 | 403 "That account belongs to a different business." | **PASS** |
| Platform with no connection | refused clearly | 502 "Publishing to instagram is not connected." | **PASS** |
| Production build | clean | `vite build` exit 0 | **PASS** |
| **Real publish to a live Page** | — | **deliberately not performed** | **NOT RUN** |

### The one thing that was never done

**No content was ever published to a live Page.** Every publishing test ran through dry-run, which exercises page discovery, account lookup, token derivation and payload validation but stops before the network call that creates a post. `external_post_id` and `published_at` remained empty in every test. Real publishing requires the explicit approval that the brief asks for.

---

## 7. Security posture

- **RLS on every entity**: owner-or-admin on read/update/delete, creator-only on create. `Business`, `Campaign` and `ContentPiece` were fixed in Phase 1; `SocialAccount` and `AiUsage` were created with rules from the start.
- **Second gate in code**: every function resolves the business/campaign/post through `base44/shared/access.ts`, so an authenticated caller cannot reach another tenant's records by forging an id — proven by the 403 tests above.
- **The publishing job is admin-only** (`401` without a user, `403` without the admin role), as required for a function a schedule calls.
- **Page tokens are never persisted or returned to the client.**

### Honest limitation

Team permissions are enforced as **owner-or-admin**. A true per-business membership table is not enforceable here, because row-level rules can only inspect the record and the current user — they cannot follow a membership join, and adding a new value to the User `role` field is not supported. Until a platform-level membership primitive exists, **multi-client team access should stay invite-only, with one owner account per client**, and staff needing full access should be admins (who can see and change all data).

---

## 8. Cost impact

- All four remaining text workflows moved off Base44 integration credits onto the app's own Railway gateway. Text generation no longer consumes Base44 AI credits anywhere in the app.
- Image and video generation still consume Base44 integration credits by design.
- A hard ceiling now exists where none did: 250 calls and 500,000 tokens per user per day.
- Observed gateway cost per call: ~2,400 tokens for a business analysis, ~2,900 for two social posts, ~2.9–3.1s latency.

---

## 9. Known limitations and blockers

| Item | Impact | Owner |
|---|---|---|
| No live publish has been performed | The final network call is unproven against Meta | User approval needed |
| Instagram / LinkedIn / X not authorized | Those platforms cannot publish; the job reports it clearly | User action |
| TikTok connector is read-only | Publishing impossible by design | Platform limitation |
| Meta tokens are not long-lived-exchanged | Publishing can expire and require reconnect; surfaced as `needs_reauth` | Meta/connector behaviour |
| Meta retired the impressions/fans insight family | Reach and impressions are not available from the API as commonly documented | Analytics phase must use `page_media_view`, `page_total_media_view_unique`, `page_follows`, `page_post_engagements` only |
| Facebook comment/DM automation unavailable | `pages_read_user_content` and `pages_manage_engagement` are not approved | Platform limitation |
| Media library not built | No reusable asset management yet | Next phase |
| Analytics not built | No performance dashboard yet | Next phase |
| No Dashboard or Settings page | Sidebar has 8 entries, not the full 10 requested | Next phase |

---

## 10. Exact next actions

1. **Approve one live test publish** to a chosen Page, then confirm the returned post id and URL appear on the calendar.
2. Build the **Media Library** on the existing upload path.
3. Build **Analytics** using only the metrics Meta still serves, marking unavailable metrics as unavailable.
4. Add **Dashboard** and **Settings** pages to complete the requested navigation.
5. Add retry/idempotency receipts for image and video generation, which still have no equivalent guard.

---

## 11. Reproduce the validation

The test harness used inline scripts against the live app: create a temporary business, link a real Page to it, drive the state machine, run `publishDuePosts` with `{ dry_run: true }`, assert the post is unchanged, then assert cross-tenant and forged-account requests return 403. All temporary records were deleted afterwards — 0 posts, 0 accounts and 0 businesses remained.