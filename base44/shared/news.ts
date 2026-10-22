// Google News' public RSS search. Free, needs no key, and works for any industry
// in any language, so it is the one source that gives the radar live, citable
// coverage of what a market is actually talking about this week.

import { htmlToText } from './website.ts';

const NEWS_FEED = 'https://news.google.com/rss/search';
const FEED_TIMEOUT_MS = 10000;

function parseDate(value) {
  const text = htmlToText(String(value || ''));
  if (!text) return '';
  const stamp = new Date(text);
  return Number.isNaN(stamp.getTime()) ? '' : stamp.toISOString();
}

// Google News appends " - Publisher" to every headline; the publisher is also in
// its own tag, so the headline is shown clean and the outlet named separately.
function cleanTitle(title, publisher) {
  const text = htmlToText(title).slice(0, 200);
  if (!publisher) return text;
  const suffix = ` - ${publisher}`;
  return text.endsWith(suffix) ? text.slice(0, text.length - suffix.length).trim() : text;
}

/**
 * Latest coverage for one topic phrase, restricted to the last week so a scan
 * reads what is live rather than what is archived.
 */
export async function fetchIndustryNews({ query, region = 'US', limit = 10 }) {
  const phrase = String(query || '').trim().slice(0, 120);
  if (!phrase) return { ok: false, reason: 'No industry phrase was given to search news for.' };

  const params = new URLSearchParams({
    q: `${phrase} when:7d`,
    hl: 'en-US',
    gl: region,
    ceid: `${region}:en`,
  });

  try {
    const response = await fetch(`${NEWS_FEED}?${params.toString()}`, {
      headers: { 'User-Agent': 'AutoSocialBot/1.0 (+marketing research)' },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: `The news feed returned HTTP ${response.status}.` };

    const xml = await response.text();
    const entries = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map((match) => {
        const block = match[1];
        const title = block.match(/<title>([\s\S]*?)<\/title>/i);
        if (!title) return null;
        const link = block.match(/<link>([\s\S]*?)<\/link>/i);
        const published = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const publisher = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
        const outlet = publisher ? htmlToText(publisher[1]).slice(0, 80) : '';
        return {
          title: cleanTitle(title[1], outlet),
          url: link ? htmlToText(link[1]).slice(0, 300) : '',
          publisher: outlet,
          published_at: parseDate(published ? published[1] : ''),
        };
      })
      .filter((entry) => entry && entry.title && entry.url);

    if (!entries.length) {
      return { ok: false, reason: `The news feed had no coverage for "${phrase}" in the last week.` };
    }
    return { ok: true, entries: entries.slice(0, limit) };
  } catch (error) {
    return { ok: false, reason: `The news feed could not be reached (${error.message}).` };
  }
}