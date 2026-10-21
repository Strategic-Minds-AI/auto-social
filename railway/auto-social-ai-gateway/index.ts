/**
 * AUTO SOCIAL — Railway Function AI Gateway 0.2.0
 * OpenAI-compatible, authenticated, allowlisted text-only gateway.
 * Missing secrets fail closed. Runtime has no durable quota ledger.
 */
const readEnv = () => (typeof Bun !== 'undefined' ? Bun.env : process.env);
const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
async function constantTimeTokenMatch(provided, expected) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
export async function handleRequest(req, deps = {}) {
  const env = deps.env ?? readEnv();
  const fetcher = deps.fetch ?? fetch;
  const pathname = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
  const requestId = crypto.randomUUID();
  const headers = { 'X-Request-ID': requestId };
  if (pathname === '/' || pathname === '/health' || pathname === '/ready') {
    const ready = Boolean(env.GATEWAY_CLIENT_KEY && env.GATEWAY_CLIENT_KEY.length >= 24 && env.AI_UPSTREAM_API_KEY);
    return json({ service: 'auto-social-ai-gateway', version: '0.2.0', ready }, pathname === '/ready' && !ready ? 503 : 200, headers);
  }
  if (pathname !== '/v1/chat/completions') return json({ error: 'Not found' }, 404, headers);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { ...headers, Allow: 'POST' });
  const publicKey = env.GATEWAY_CLIENT_KEY || '';
  const upstreamKey = env.AI_UPSTREAM_API_KEY || '';
  const endpoint = (env.AI_UPSTREAM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  if (!publicKey || !upstreamKey || publicKey.length < 24) {
    return json({ error: 'Gateway secrets are not configured' }, 503, headers);
  }
  if (!endpoint.startsWith('https://') && !((env.ALLOW_PRIVATE_HTTP || '') === 'true' && endpoint.startsWith('http://'))) {
    return json({ error: 'Upstream HTTPS required' }, 503, headers);
  }
  const bearer = req.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ') || !(await constantTimeTokenMatch(bearer.slice(7), publicKey))) {
    return json({ error: 'Unauthorized' }, 401, headers);
  }
  const maxBytes = 128 * 1024;
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > maxBytes) return json({ error: 'Payload too large' }, 413, headers);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return json({ error: 'Payload too large' }, 413, headers);
  let payload;
  try { payload = JSON.parse(raw); }
  catch { return json({ error: 'Invalid JSON' }, 400, headers); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ error: 'JSON object required' }, 400, headers);
  if (payload.stream === true) return json({ error: 'Streaming is not enabled by this gateway' }, 400, headers);
  if (!Array.isArray(payload.messages) || !payload.messages.length || payload.messages.length > 64) {
    return json({ error: 'messages must be a nonempty array of at most 64 items' }, 400, headers);
  }
  if (payload.messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) {
    return json({ error: 'Only text chat messages with allowed roles are supported' }, 400, headers);
  }
  const allowedFields = new Set(['model', 'messages', 'temperature', 'max_tokens', 'max_completion_tokens', 'stream', 'response_format', 'seed', 'top_p']);
  if (Object.keys(payload).some(k => !allowedFields.has(k))) {
    return json({ error: 'Unsupported parameter' }, 400, headers);
  }
  if (payload.response_format && payload.response_format.type !== 'json_object') {
    return json({ error: 'Only json_object response_format is supported' }, 400, headers);
  }
  const allowedModels = (env.ALLOWED_MODELS || 'openai/gpt-oss-20b,openai/gpt-oss-120b')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!allowedModels.includes(payload.model)) return json({ error: 'Model not allowed' }, 400, headers);
  const cap = Math.min(Math.max(Number(env.MAX_OUTPUT_TOKENS) || 12000, 100), 16384);
  payload.max_tokens = Math.min(Math.max(Number(payload.max_tokens ?? payload.max_completion_tokens) || cap, 1), cap);
  delete payload.max_completion_tokens;
  if (typeof payload.temperature === 'number') payload.temperature = Math.max(0, Math.min(payload.temperature, 2));
  const abort = new AbortController();
  const timeoutMs = Math.min(Math.max(Number(env.UPSTREAM_TIMEOUT_MS) || 45000, 2000), 120000);
  const timeout = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const started = Date.now();
    const response = await fetcher(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${upstreamKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    console.info(JSON.stringify({ event: 'ai_upstream', requestId, status: response.status, elapsedMs: Date.now() - started }));
    const outgoing = new Headers({ 'Cache-Control': 'no-store', 'X-Request-ID': requestId });
    outgoing.set('Content-Type', response.headers.get('content-type') || 'application/json');
    if (response.headers.get('retry-after')) outgoing.set('Retry-After', response.headers.get('retry-after'));
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch (err) {
    return json({ error: err?.name === 'AbortError' ? 'Upstream timeout' : 'AI provider unavailable' }, 502, headers);
  } finally { clearTimeout(timeout); }
}
if (typeof Bun !== 'undefined') {
  Bun.serve({ port: Number(Bun.env.PORT || 3000), fetch: (req) => handleRequest(req) });
}