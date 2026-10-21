# AUTO SOCIAL / X1 Cloud Browser — Living Execution Workbook
Mission `AS-CB-ARCH-20261020` · Updated 2026-10-20 · status: **architecture packaged; production unmodified**

## Source truth
- AUTO SOCIAL: https://github.com/Strategic-Minds-AI/auto-social — default branch `main` — inspected SHA `0f3147b1c839cbbff887e58461a2044d0c7e5796`
- Browser: https://github.com/XTREME-SYSTEMS/cloudbrowser-control — inspected tree SHA `f45e86a651a877bbd9c340e3ebefd65a8167ae5b`
- Railway project `cloudbrowser-control` ID `b68545a5-c9f8-482d-8e1b-4c1574f7af3b`, environment `production` ID `f2a884f8-924b-431c-a181-b7287e8b2137`. **Inspection only**.
- Existing portable API contract: Cloud Browser `api/openapi.json` / `api/lib/jobs.js`, only two accepted job types `engine.health` and `artifact.prune`.
- Current AUTO SOCIAL `base44/functions/generateAutoSocialPlan/entry.ts` still calls Base44 InvokeLLM.
- Write scope: branch `feature/auto-social-cloud-browser-architecture-20261020`. No deployment or external social actions.

## Goals and success definitions

| Item | Measure | Status | Evidence / blocker |
|---|---|---|---|
| Repo and Railway source truth | Exact repo, branch, SHA, environment, types known | VERIFIED | GitHub and Railway reads 2026-10-20 |
| Architecture stored | Design document read-back | PENDING READ-BACK | `docs/AUTO_SOCIAL_CLOUD_BROWSER_ARCHITECTURE_20261020.md` |
| Action policy | Explicit fail-closed decisions | IMPLEMENTED, NOT INTEGRATED | `src/lib/socialActionPolicy.mjs` |
| Policy test fixtures | 20 selected positive/negative decisions | INLINE FIXTURES PASS; CI NOT VERIFIED | `tests/socialActionPolicy.test.mjs` |
| Independent CI | GitHub workflow evaluates Node test file | NOT RUN | `.github/workflows/auto-social-policy.yml` |
| Cloud Browser execute | Real authenticated session execution with capture receipt | BLOCKED | Portable API doesn't expose execute; verify alternate authorized engine surface in sandbox |
| SaaS login+OAuth | Actual customer OAuth, encrypted storage, tenant RLS | NOT STARTED | Meta/TikTok/Google/LinkedIn app scope permissions missing/unverified |
| One published test post | Provider acknowledges + status reconciled | NOT RUN | No verified provider grants or staging publisher |
| One inbound reply | Webhook verified + approval + provider receipt | NOT RUN | No webhook/approval implementation |
| Account signup flow | Human setup, no automated platform verification bypass | DESIGN ONLY | Need approved provider onboarding |
| Production acceptance | Independent Guardian, security review, app review | NOT READY | No end-to-end evidence |

## Decision register

| ID | Decision | Rationale | Revisit trigger |
|---|---|---|---|
| D-001 | Reuse current Cloud Browser workers | Already deployed; no new browser engine cost | Existing engine fails smoke or lacks needed legally authorized API |
| D-002 | Browser read/QA only, no automatic social mutations | Reliability and platform anti-spam constraints | Formal provider permission permits a specific browser operation |
| D-003 | Create/connect accounts through human onboarding and OAuth | Identity and owner consent | Verified official provider provisioning API |
| D-004 | Social outbound writes through provider APIs | Auditable permissions and idempotency | Official provider offers alternative supported method |
| D-005 | Reuse canonical X1 queue/lease/scheduler | Prevent concurrent duplicate publish | Existing queue demonstrably unavailable, reviewed exception |
| D-006 | Defer plugin release until backend API proven | Plugin metadata alone cannot grant capability | Successful staging OAuth/AI/browser contract tests |
| D-007 | Keep current Base44 weekly job until cutover | Avoid dropped campaigns | New durable scheduler proven; disable old in same controlled cutover |

## Prioritized work queue

| ID | Scope | Dependencies | Exit criteria | Owner | State |
|---|---|---|---|---|---|
| AS-001 | Source truth + fail-closed policy + doc | GitHub write | Branch, read-back, tests, PR | Architecture | IN PROGRESS |
| AS-002 | X1 queue adapter, tenant/resource leases | Queue job registry and receipts | Idempotent dry-run + no double runs | Backend | NOT STARTED |
| AS-003 | Provider OAuth & account registry | Credentials, app review | Two tenants segregated; grant revoke tested | Auth/API | NOT STARTED |
| AS-004 | First social publishing adapter | AS-002, AS-003 | Post → provider ID → confirmed status + rollback | Publishing | NOT STARTED |
| AS-005 | Incoming-comment agent | AS-003 | Signature, dedup, classify, approval, API reply | Inbox | NOT STARTED |
| AS-006 | Browser public research adapter | Engine execute proof, source license | Browser capture + evidence with policy logs | Cloud Browser | BLOCKED |
| AS-007 | Media production & A/B experiments | Model API/media providers | Provenanced content, experiment guardrails | Creative | NOT STARTED |
| AS-008 | Multi-tenant SaaS + MCP | All core APIs | 2-tenant isolation + bill/limit tests + independent QA | X1 | NOT STARTED |

## Exact operator acceptance checklist

- [x] Identify GitHub repository and current main SHA.
- [x] Identify Railway Cloud Browser project, services, jobs API, stage/prod concerns.
- [x] Design official API lane and browser-assisted lane.
- [x] Write default-deny policy and 20 local inline policy fixtures.
- [ ] Verify read-back of documents and code from GitHub.
- [ ] GitHub Actions independent tests show green status on PR.
- [ ] Review existing X1 singleton queue lease/scheduler before adding any social task job type.
- [ ] Verify live Cloud Browser execute route + scoped permissions in isolated sandbox.
- [ ] Verify legitimate social developer OAuth & platform app approvals.
- [ ] Execute one dry-run plan without network mutations.
- [ ] Execute one authorized sandbox post with verified provider ID/status.
- [ ] Execute one approved inbound reply with signature/receipt/opt-out.
- [ ] Audit social account creation requiring human verification and no evasion.
- [ ] Guardian QA, cost/reliability/security gate and user-scoped production approval.

## Risk ledger

| Risk | Severity | Mitigation |
|---|---|---|
| Public repository credential exposure | CRITICAL | No secrets in source; vault references only |
| Tenant leakage | CRITICAL | Server RLS + tenant-scoped key + deny-cross-tenant tests |
| Account bans / spam | HIGH | Official APIs; no fake identity or browser engagement |
| Duplicate outbound posts | HIGH | Stable idempotency key + reconciling provider ID |
| Existing Railway pending work | HIGH | Inspect both status and staged change readouts before deploy; don't apply automatically |
| Source copyright/privacy | HIGH | Use metadata/provenance, licensed images, retention controls |
| AI hallucinated brand claims | MEDIUM | Brand fact library + QA + approval |
| Unexpected model spend | MEDIUM | Per-tenant token caps, per-campaign spend and kill switch |
| Scheduler overlap Base44/X1 | HIGH | One scheduler authority, controlled cutover |

## Canonical handoff (rehydrate/dehydrate)

On resume, read this workbook, architecture, policy source, test results, Cloud Browser `api/openapi.json` / `api/lib/jobs.js` and latest GitHub main SHA; compare branch to main before edits. Refresh Railway environment & staged state and source of provider permissions. Continue the first unverified AS-001 item, then AS-002 in sandbox. Never mark unexecuted provider tests PASS, and never merge or deploy without evidence and approved scope.

**Changes in this mission:** design documents, Node pure policy module, test fixtures and CI workflow only. No OAuth token, personal data, deployed service, provider account or social interaction modified.
