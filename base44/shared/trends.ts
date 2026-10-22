// Google's public trending-searches feed. It is free, needs no key, and is the
// only Trends surface Google exposes without an approved alpha account. Shared
// so the topic researcher and the demand radar read the same source the same way.

import { htmlToText } from './website.ts';

const TRENDS_FEED = 'https://trends.google.com/trending/rss?geo=';

export async function fetchTrendingSearches(geo) {
  try {
    const response = await fetch(`${TRENDS_FEED}${encodeURIComponent(geo)}`, {
      headers: { 'User-Agent': 'AutoSocialBot/1.0 (+marketing research)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { ok: false, reason: `Google Trends returned HTTP ${response.status}.` };

    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
    const entries = items
      .map((block) => {
        const title = block.match(/<title>([\s\S]*?)<\/title>/i);
        const traffic = block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i);
        if (!title) return null;
        return {
          title: htmlToText(title[1]).slice(0, 120),
          traffic: traffic ? htmlToText(traffic[1]) : '',
        };
      })
      .filter((entry) => entry && entry.title);

    if (!entries.length) return { ok: false, reason: 'The Google Trends feed had no entries for that region.' };
    return { ok: true, entries: entries.slice(0, 25) };
  } catch (error) {
    return { ok: false, reason: `Google Trends could not be reached (${error.message}).` };
  }
}