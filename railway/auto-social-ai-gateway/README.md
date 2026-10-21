# AUTO SOCIAL — Railway AI Gateway (v0.2.0)

**GitHub:** Strategic-Minds-AI/auto-social · branch `feature/auto-social-ai-gateway-20261020`
**Service:** auto-social-ai-gateway · Railway project `8140d8a0-d38a-4c63-a19d-f35631bc2e0e`, env `ecd349f0-0b28-4985-ad22-711bd0dc3f9c`, function `fc7898a0-1525-46c9-a90c-2dc23477bd44`
**Service URL:** https://auto-social-ai-gateway-production.up.railway.app
**Implementation:** Railway Bun Function (single `index.ts`). Do not create another long-lived Docker queue/model server.

## Current truth

- Railway's current status reports the function online and deploy SUCCESS; GitHub and running Railway Function sources were read back and matched by length.
- `GET /health` reports liveness and `GET /ready` reports whether **both secret keys are installed**. The provider is **not ready** until the secret configuration is completed.
- Verified deterministic local gateway tests: 11/11 passed in an isolated Node 22 environment. GitHub CI adds a 12-case independent fixture; do not mark it PASS until the Actions run completes.
- Base44 app `6ac4dd914af935b8c986b411` now uses configured external AI for **Auto Social's planner**, and the shared backend client will not silently use Base44 `InvokeLLM` when external inference fails. Restore checkpoint `6ad8341a122b06a4b474d3db`, Git SHA `ce2d905fcab5462b18b7316bee1db7fc69876045`.
- **Secrets installed in Base44 are not automatically installed in Railway.** Do not confuse an online container with a functioning AI provider connection.

## Final credential handoff (requires owner action, no credentials in Git or chat)

1. Open [Railway project](https://railway.com/project/8140d8a0-d38a-4c63-a19d-f35631bc2e0e), service `auto-social-ai-gateway` → Variables.
2. Add `AI_UPSTREAM_API_KEY` with the same Groq API key already securely stored in Base44, or a new scoped Groq key created specifically for AUTO SOCIAL.
3. Add `GATEWAY_CLIENT_KEY` with a new random token (32–64 characters; **must be at least 24**). Use a password manager generator; do not reuse the Groq provider key for client auth.
4. Existing **non-secret** Railway variables are set: `AI_UPSTREAM_BASE_URL=https://api.groq.com/openai/v1`, `ALLOWED_MODELS=openai/gpt-oss-20b,openai/gpt-oss-120b`, `MAX_OUTPUT_TOKENS=12000`, `UPSTREAM_TIMEOUT_MS=90000`. Variable changes may redeploy.
5. Check `GET https://auto-social-ai-gateway-production.up.railway.app/ready`: HTTP 200 and `ready:true`. `/health` alone is insufficient.
6. Probe with a single short, **authenticated** request:
   ```bash
   curl -fsS https://auto-social-ai-gateway-production.up.railway.app/v1/chat/completions \
     -H "Authorization: Bearer $GATEWAY_CLIENT_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"openai/gpt-oss-20b","messages":[{"role":"user","content":"Write one short caption for a flooring contractor."}],"max_tokens":150}'
   ```
   A `choices[0].message.content` response confirms real provider forwarding; non-200 responses require investigation, not a fallback.
7. After step 6 passes, update **Base44 backend Secrets** (not frontend environment variables):
   - `AI_BASE_URL=https://auto-social-ai-gateway-production.up.railway.app/v1`
   - `AI_API_KEY=<the same new GATEWAY_CLIENT_KEY>`
   - `AI_MODEL=openai/gpt-oss-20b`
8. Run a real, owner-authorized small Auto Social plan, verify `provider` in function response points to Railway, records were actually persisted, and the provider's logs report HTTP 200. Use a small plan first to avoid expensive repeated calls.
9. Until steps 2–8 are completed, leave Base44 pointing directly to Groq. **Do not change Base44 to the new gateway URL while `ready:false`.**

## Contract and controls

`GET /health` → liveness with boolean ready. `GET /ready` → HTTP 200 only when config appears present, 503 otherwise. Neither proves Groq token validity.

`POST /v1/chat/completions`:
- Requires `Authorization: Bearer <GATEWAY_CLIENT_KEY>`, compared using SHA-256 digest equality.
- Requires 1–64 plain-text chat messages; model in `ALLOWED_MODELS`.
- Maximum request body 128 KiB, capped output to `MAX_OUTPUT_TOKENS` (hard ceiling 16,384), explicit provider timeout, non-streaming, no tool calls, no image input.
- Forwards only to HTTPS upstream; 429 and Retry-After are preserved.
- Logs metadata only, never raw prompts or credentials. Upstream billing is at the provider; Railway hosting is separate.
- **No durable per-tenant quota, metering, OAuth platform publisher, image or video generator, agent worker, or guaranteed fallback.** Add these before multi-client commercialization.

## Known paid-Base44 AI calls outside planner

These remain in Base44 and may still consume Base44 credits until a separate secure server-side migration: `src/pages/CampaignWizard.jsx`, `src/pages/BusinessForm.jsx`, `src/pages/CampaignDetail.jsx`, `src/components/content/ContentPieceCard.jsx`. Media calls `GenerateImage` and `GenerateVideo` are separate and **not** replaced by a text LLM gateway.

## Budget/reliability/independent QA

Keep hosted Groq model output modest when possible; 12k token cap allows a large planning response but is a ceiling, **not** an actual spend limit. Implement service-level daily budget and tenant usage ledger before many client accounts. Official platform OAuth APIs must be used for publishing/inbound engagement; never use the Cloud Browser to mass-create fake accounts or bypass challenges.

A successful Railway deploy does not establish end-to-end functional readiness. Required last-mile acceptance: true /ready, 401 wrong key, 400 wrong model, 200 authenticated provider response, Base44 plan persistence, spend receipt, current GitHub CI green, and independent QA.

## Rollback

Base44 app restore checkpoint: `6ad8341a122b06a4b474d3db` (the previous version will silently fall back to paid credits; treat as cost-risk if restored). To bypass Railway gateway but keep external AI: put `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_API_KEY=<Groq key>`, `AI_MODEL=openai/gpt-oss-20b` in Base44 secrets; backend remains fail-closed.
