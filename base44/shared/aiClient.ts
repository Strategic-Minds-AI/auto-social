import { secrets } from "base44:runtime";
import { checkAiBudget } from './access.ts';

// One OpenAI-compatible call serves every provider behind the gateway (Groq,
// Ollama, vLLM, OpenRouter). The caller's own account pays, never Base44 credits.
const DEFAULT_MAX_TOKENS = 4000;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 120000;
const RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
// A busy shared gateway answers 429 with how long to wait, so the pause grows with
// each attempt instead of hammering it.
const RETRY_DELAYS_MS = [1000, 3000, 6000];

function getSecret(name) {
  try {
    return secrets.get(name) || "";
  } catch {
    return "";
  }
}

export function aiConfig() {
  const baseUrl = getSecret("AI_BASE_URL").replace(/\/+$/, "");
  const apiKey = getSecret("AI_API_KEY");
  const model = getSecret("AI_MODEL");
  return { baseUrl, apiKey, model, configured: Boolean(baseUrl && apiKey && model) };
}

// Which engine actually served the request — surfaced on every result so a
// silent fallback to Base44's own credits can never go unnoticed.
export function aiProviderHost() {
  const { baseUrl } = aiConfig();
  if (!baseUrl) return "not configured";
  try {
    return new URL(baseUrl).host;
  } catch {
    return "configured endpoint";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Never let a raw upstream body leak into a UI message.
function sanitize(message, limit = 300) {
  return String(message == null ? "" : message)
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer ***")
    .replace(/(sk|key|token)[-_][A-Za-z0-9]{8,}/gi, "***")
    .slice(0, limit);
}

function parseJsonContent(content) {
  const raw = String(content).trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("AI returned a response that was not valid JSON");
  }
}

async function postChat(config, body) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const retryAfter = Number(response.headers.get('retry-after')) || 0;
  return { ok: response.ok, status: response.status, retryAfter, text: await response.text() };
}

/**
 * Structured generation against the configured gateway.
 * Returns { data, meta } so callers can report the engine, model and token usage.
 */
export async function generateJsonWithMeta(base44, { prompt, schema, maxTokens, system, temperature = 0.8 }) {
  const config = aiConfig();

  // One choke point for the daily AI budget: every call in the app passes through
  // here, so no generator can spend past the cap even if it forgets to check. The
  // ledger is per user; without a user context the guard steps aside.
  const user = await base44.auth.me().catch(() => null);
  if (user) {
    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      const blocked = new Error(budget.message);
      blocked.code = 'ai_budget_reached';
      throw blocked;
    }
  }

  // Fail closed: never silently consume Base44 AI integration credits.
  if (!config.configured) {
    throw new Error(
      "External AI is not fully configured. Set AI_BASE_URL, AI_API_KEY and AI_MODEL in the app secrets. No paid fallback was used."
    );
  }

  const body = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          system ||
          "You reply with one valid JSON object and nothing else. Never wrap it in markdown or add commentary.",
      },
      {
        role: "user",
        content: `${prompt}\n\nReturn JSON that matches this schema exactly:\n${JSON.stringify(schema)}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature,
    // The gateway models reason before they answer, so an explicit ceiling is
    // required — too low and the response comes back with empty content.
    max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
  };

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let waitMs = RETRY_DELAYS_MS[attempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    try {
      const { ok, status, retryAfter, text } = await postChat(config, body);
      if (retryAfter) waitMs = Math.min(retryAfter * 1000, 15000);

      if (!ok) {
        const retryable = RETRY_STATUSES.includes(status);
        const error = new Error(
          retryable
            ? `AI gateway is temporarily unavailable (HTTP ${status})`
            : `AI gateway rejected the request (HTTP ${status}): ${sanitize(text, 200)}`
        );
        if (!retryable) throw error;
        lastError = error;
      } else {
        const payload = JSON.parse(text);
        const content = payload?.choices?.[0]?.message?.content;
        const finish = payload?.choices?.[0]?.finish_reason;

        if (!content || !String(content).trim()) {
          lastError = new Error(
            finish === "length"
              ? "AI ran out of tokens before producing a result. Try fewer items or a shorter brief."
              : "AI returned an empty response"
          );
        } else {
          return {
            data: parseJsonContent(content),
            meta: {
              provider: aiProviderHost(),
              model: config.model,
              attempts: attempt,
              prompt_tokens: payload?.usage?.prompt_tokens ?? null,
              completion_tokens: payload?.usage?.completion_tokens ?? null,
              total_tokens: payload?.usage?.total_tokens ?? null,
            },
          };
        }
      }
    } catch (error) {
      lastError = new Error(sanitize(error?.message || error));
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(waitMs);
    }
  }

  throw lastError || new Error("AI request failed");
}

/** Backwards-compatible shape: the parsed object only. */
export async function generateJson(base44, options) {
  const { data } = await generateJsonWithMeta(base44, options);
  return data;
}

/** Totals provider, model and tokens across every AI call one run made. */
export function sumMeta(list) {
  return (list || []).reduce(
    (acc, meta) => ({
      provider: meta?.provider || acc.provider,
      model: meta?.model || acc.model,
      total_tokens: acc.total_tokens + (Number(meta?.total_tokens) || 0),
    }),
    { provider: '', model: '', total_tokens: 0 }
  );
}