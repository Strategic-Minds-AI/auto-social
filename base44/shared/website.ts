// Server-side retrieval of a business website. The AI engines have no internet
// access of their own, so every claim about a live page is grounded in text
// fetched here and handed to the model as supplied context.

const MAX_SITE_BYTES = 400000;
const SITE_TIMEOUT_MS = 12000;

export function isFetchableUrl(raw) {
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTitle(html) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToText(match[1]).slice(0, 200) : '';
}

export async function researchWebsite(rawUrl) {
  const url = isFetchableUrl(rawUrl);
  if (!url) return { ok: false, reason: 'That website address could not be reached.' };

  try {
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'AutoSocialBot/1.0 (+marketing research)' },
      signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!response.ok) return { ok: false, reason: `The website returned HTTP ${response.status}.` };

    const html = (await response.text()).slice(0, MAX_SITE_BYTES);
    const text = htmlToText(html).slice(0, 6000);
    if (text.length < 60) return { ok: false, reason: 'The website had no readable text to analyse.' };

    return { ok: true, url: url.toString(), title: extractTitle(html), text };
  } catch (error) {
    return { ok: false, reason: `The website could not be read (${error.message}).` };
  }
}