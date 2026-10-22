import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Reads real performance numbers for the app's connected Facebook Pages, so the
// analytics page — and Eden — can see which topics actually land.
//
// Meta retired the impressions metric family (page_impressions, post_impressions
// and their variants), and a single invalid metric name fails a whole insights
// call, so this reads only current names.

const GRAPH = 'https://graph.facebook.com/v25.0';
const TIMEOUT_MS = 20000;
const POST_LIMIT = 10;
const POSTS_READ = 25;

const PAGE_METRICS = [
  'page_media_view',
  'page_total_media_view_unique',
  'page_post_engagements',
  'page_views_total',
];

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

async function graph(path, token) {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  return body;
}

// Pages owned by a Business Manager are not listed by /me/accounts, so the Page
// token is used when it can be found and the user token otherwise.
async function resolvePageToken(userToken, pageId) {
  try {
    const data = await graph('/me/accounts?fields=id,name,access_token&limit=200', userToken);
    const match = (data.data || []).find((page) => String(page.id) === String(pageId));
    return match?.access_token || userToken;
  } catch {
    return userToken;
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // This reads the app's shared Page connection, so only an app admin may run it.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only an app admin can refresh performance data.' }, { status: 403 });
    }

    let accessToken = '';
    try {
      ({ accessToken } = await base44.asServiceRole.connectors.getConnection('facebook_pages'));
    } catch {
      accessToken = '';
    }
    if (!accessToken) {
      return Response.json({ error: 'Facebook Pages is not connected, so there are no numbers to read yet.' }, { status: 409 });
    }

    const db = base44.asServiceRole.entities;
    const accounts = (await db.SocialAccount.filter({ platform: 'facebook' }, { limit: 20 })).items || [];
    if (!accounts.length) {
      return Response.json({ synced: 0, message: 'No Facebook Page is connected for this app yet.' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const problems = [];
    let postsStored = 0;
    let postsMatched = 0;
    let daysStored = 0;

    for (const account of accounts) {
      const token = await resolvePageToken(accessToken, account.external_id);
      const pageId = account.external_id;
      const ownerId = account.created_by_id || '';
      const capturedAt = new Date().toISOString();

      let followers = null;
      try {
        const info = await graph(`/${pageId}?fields=fan_count,followers_count`, token);
        followers = num(info.followers_count) ?? num(info.fan_count);
      } catch (error) {
        problems.push(`followers: ${error.message}`);
      }

      // Page-level day rows.
      const byDay = {};
      try {
        const data = await graph(
          `/${pageId}/insights?metric=${PAGE_METRICS.join(',')}&period=day&date_preset=last_28_days`,
          token
        );
        for (const entry of data.data || []) {
          for (const value of entry.values || []) {
            const day = String(value.end_time || '').slice(0, 10);
            if (!day || day > today) continue;
            byDay[day] = byDay[day] || {};
            byDay[day][entry.name] = num(value.value);
          }
        }
      } catch (error) {
        problems.push(`page insights: ${error.message}`);
      }

      const days = Object.keys(byDay).sort().slice(-28);
      if (days.length) {
        const existingDays = (
          await db.PostMetric.filter(
            { business_id: account.business_id, scope: 'page_day', metric_date: { $in: days } },
            { limit: 60 }
          )
        ).items || [];
        const existingDay = new Map(existingDays.map((row) => [String(row.metric_date), row]));

        for (const day of days) {
          const dayData = byDay[day];
          const payload = {
            business_id: account.business_id,
            owner_id: ownerId,
            social_account_id: account.id,
            platform: 'facebook',
            scope: 'page_day',
            metric_date: day,
            views: dayData.page_media_view ?? null,
            views_unique: dayData.page_total_media_view_unique ?? null,
            engagements: dayData.page_post_engagements ?? null,
            page_views: dayData.page_views_total ?? null,
            followers,
            captured_at: capturedAt,
            source: 'facebook_graph',
          };
          const prior = existingDay.get(day);
          if (prior) await db.PostMetric.update(prior.id, payload);
          else await db.PostMetric.create(payload);
          daysStored += 1;
        }
      }

      // The Page's own recent posts, with reactions and shares where Meta allows them.
      let posts = [];
      try {
        const data = await graph(
          `/${pageId}/posts?fields=id,message,created_time,permalink_url,shares,reactions.summary(true)&limit=${POSTS_READ}`,
          token
        );
        posts = data.data || [];
      } catch {
        try {
          const data = await graph(`/${pageId}/posts?fields=id,message,created_time,permalink_url&limit=${POSTS_READ}`, token);
          posts = data.data || [];
        } catch (error) {
          problems.push(`page posts: ${error.message}`);
        }
      }

      const externalIds = posts.map((post) => String(post.id));
      const linked = externalIds.length
        ? (
            await db.ScheduledPost.filter(
              { business_id: account.business_id, external_post_id: { $in: externalIds } },
              { limit: 100 }
            )
          ).items || []
        : [];
      const linkByExternal = new Map(linked.map((post) => [String(post.external_post_id), post]));

      const existingPosts = externalIds.length
        ? (
            await db.PostMetric.filter(
              { business_id: account.business_id, scope: 'post', external_post_id: { $in: externalIds } },
              { limit: 100 }
            )
          ).items || []
        : [];
      const existingPost = new Map(existingPosts.map((row) => [String(row.external_post_id), row]));

      for (const post of posts.slice(0, POST_LIMIT)) {
        // Post-level media views are not returned for every post, so a failure
        // here leaves the row without a view count rather than losing it.
        let views = null;
        try {
          const insight = await graph(`/${post.id}/insights?metric=post_media_view`, token);
          const entry = (insight.data || []).find((row) => row.name === 'post_media_view');
          const latest = entry?.values?.[entry.values.length - 1];
          if (latest) views = num(latest.value);
        } catch {
          views = null;
        }

        const link = linkByExternal.get(String(post.id));
        const reactions = num(post.reactions?.summary?.total_count);
        const shares = num(post.shares?.count);

        const payload = {
          business_id: account.business_id,
          owner_id: ownerId,
          social_account_id: account.id,
          platform: 'facebook',
          scope: 'post',
          post_id: link?.id || '',
          external_post_id: String(post.id),
          permalink_url: post.permalink_url || '',
          posted_at: post.created_time || '',
          metric_date: String(post.created_time || '').slice(0, 10),
          topic: link?.trend_topic || '',
          pillar: link?.pillar || '',
          caption_excerpt: String(post.message || link?.caption || '').slice(0, 220),
          views,
          reactions,
          shares,
          engagements: reactions === null && shares === null ? null : (reactions || 0) + (shares || 0),
          captured_at: capturedAt,
          source: 'facebook_graph',
        };

        const prior = existingPost.get(String(post.id));
        if (prior) await db.PostMetric.update(prior.id, payload);
        else await db.PostMetric.create(payload);
        postsStored += 1;
        if (link) postsMatched += 1;
      }
    }

    return Response.json({
      synced_pages: accounts.length,
      posts_stored: postsStored,
      posts_matched: postsMatched,
      days_stored: daysStored,
      problems,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}