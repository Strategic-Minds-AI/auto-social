import { secrets } from "base44:runtime";

function getSecret(name) {
  try {
    return secrets.get(name) || "";
  } catch {
    return "";
  }
}

// One OpenAI-compatible call serves every provider: Groq, Ollama on Railway,
// OpenRouter, vLLM. The caller's own account pays, not Base44 integration credits.
async function callProvider(baseUrl, apiKey, model, prompt, schema) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey || "none"}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You reply with one valid JSON object and nothing else. Never wrap it in markdown or add commentary.",
        },
        {
          role: "user",
          content: `${prompt}\n\nReturn JSON that matches this schema exactly:\n${JSON.stringify(schema)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`AI provider returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned an empty response");
  return JSON.parse(content);
}

// Which engine the last run actually used — surfaced so a silent fallback to
// Base44's credits can never go unnoticed.
export function aiProviderHost() {
  const baseUrl = getSecret("AI_BASE_URL");
  return baseUrl ? baseUrl.replace(/^https?:\/\//, "").split("/")[0] : "Base44 AI";
}

export async function generateJson(_base44, { prompt, schema }) {
  const baseUrl = getSecret("AI_BASE_URL");
  const apiKey = getSecret("AI_API_KEY");
  const model = getSecret("AI_MODEL");

  if (!baseUrl || !apiKey || !model) {
    throw new Error("External AI is not fully configured. Set AI_BASE_URL, AI_API_KEY and AI_MODEL in Base44 secrets. No paid fallback was used.");
  }

  // Fail closed: never silently consume Base44 AI integration credits.
  return callProvider(baseUrl, apiKey, model, prompt, schema);
}