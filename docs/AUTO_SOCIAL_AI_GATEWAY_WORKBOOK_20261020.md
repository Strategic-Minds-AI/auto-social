# AUTO SOCIAL · Gateway Execution Workbook
Mission: `AS-AI-GATEWAY-20261020` · Executed 2026-10-20 (America/New_York); Railway timestamps 2026-10-21 UTC.

## Summary

**Status:** PARTIAL DEPLOYED / NOT UPSTREAM READY. Gateway code has been committed, isolated Railway function deployed, and Base44 planner protected from silent paid fallback. No production social publishing is authorized or implemented.

## Verified resources
- GitHub: `Strategic-Minds-AI/auto-social` main auto-synced Base44 checkpoint; feature branch `feature/auto-social-ai-gateway-20261020` contains function source, 12-case CI fixture and operations.
- Base44 app ID `6ac4dd914af935b8c986b411`. Checkpoint ID `6ad8341a122b06a4b474d3db`, SHA `ce2d905fcab5462b18b7316bee1db7fc69876045`. GitHub main `base44/shared/aiClient.ts` read-back has no credit-spending fallback.
- Railway authorized workspace: Strategic Minds AI `9a1ff2ac-f808-4f64-931a-093196489bc8`.
- Railway gateway project `8140d8a0-d38a-4c63-a19d-f35631bc2e0e`, production environment `ecd349f0-0b28-4985-ad22-711bd0dc3f9c`, function `fc7898a0-1525-46c9-a90c-2dc23477bd44`.
- Public domain `auto-social-ai-gateway-production.up.railway.app`.
- Railway environment-status: 1 running replica, SUCCESS deployment `94908168-b517-41e7-8d3a-d041ba5fb2da`, 0 service issues. Running Function source is equal to deployed source; length 5,979 bytes.
- Variables confirmed by Railway metadata: `AI_UPSTREAM_BASE_URL`, `ALLOWED_MODELS`, `MAX_OUTPUT_TOKENS`, `UPSTREAM_TIMEOUT_MS`.
- **MISSING VARIABLES:** `AI_UPSTREAM_API_KEY`, `GATEWAY_CLIENT_KEY`. OAuth connector does not provide Base44 secret values; never export/echo them.

## Acceptance / evidence
| Test | Result | Evidence / caveat |
|---|---|---|
| Repository authenticated write | PASS | Function/test/docs/CI commits and GitHub read-back |
| Base44 fail-closed behavior | PASS source check | Checkpoint + GitHub read-back; live inference not executed |
| Local gateway policy tests | PASS 11/11 | Node 22 deterministic mock upstream |
| GitHub CI test | NOT VERIFIED | PR checks must complete |
| Railway Function deployed | PASS | Environment status SUCCESS, source read-back |
| Railway public URL | CREATED, HTTP UNVERIFIED | Domain allocated; direct HTTP checks not reachable from available tools, Remote Desktop Commander request failed/timed out |
| Provider credentials in Railway | BLOCKED | Two required secret names not installed |
| /ready HTTP 200 | BLOCKED | Cannot be true without Railway key configuration |
| Provider inference HTTP 200 | NOT RUN | No upstream keys on Railway |
| Base44 through gateway end-to-end | NOT RUN | Never change Base44 secrets to an unready gateway |
| Four direct Base44 InvokeLLM sites | OPEN | May consume Base44 AI credits |
| Publishing / social OAuth / Cloud Browser | OUT OF GATEWAY SCOPE | Independent projects and permission checks required |

## Railway permissions caveat

The first project create operation used an inaccessible external workspace and returned project `51ea7591-abb1-4ea2-b0bf-43e8a06f9f21`. It had no function created because member access was denied; even viewer read was denied. This is not the active gateway. Cleanup by that workspace's owner if it appears on their canvas; do not confuse it with authorized project `8140d8a0-d38a-4c63-a19d-f35631bc2e0e`.

## Risks
- Live Railway service incurs usage; the user's stated $20 subscription does not imply unlimited inference or model GPU capacity.
- Base44 browser-facing InvokeLLM calls elsewhere still use paid Base44 services.
- Hard output cap is not an aggregate or tenant spend budget.
- A successful Railway deploy is not inference or authentication proof.
- Do not copy Groq keys into GitHub, frontend JS, logs or chat. No key reflection endpoint.

## One-pass resumption

1. Verify this branch's GitHub Actions suite, and review PR.
2. Have authorized owner set **Railway** `AI_UPSTREAM_API_KEY` and `GATEWAY_CLIENT_KEY` in the gateway service (see README). They must be real secrets; no placeholders. This is the only required external handoff before live upstream tests.
3. Check authenticated /ready + /v1/chat/completions positive and negative cases with synthetic prompts; inspect provider errors and spend.
4. Switch Base44 backend-only `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` **only after** the gateway is truly ready; create a new checkpoint.
5. Test small Auto Social plan and read back persisted posts without publishing anything.
6. Migrate four remaining Base44 InvokeLLM sites via secured server functions, separate image/video credits, and add per-tenant quotas.
7. Integrate X1 queue/Cloud Browser for permitted observation, add provider OAuth/publishing separately under approved scope. Guardian QA, security and production review before broad release.

Rollback: Restore Base44 checkpoint only with awareness the older version silently uses Base44 integration credits. Direct Groq backend secrets are the safer bypass until gateway is ready.
