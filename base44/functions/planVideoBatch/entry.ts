import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import OpenAI from 'npm:openai@6.45.0';
import { resolveBusiness } from '../../shared/access.ts';
import {
  RESOLUTION,
  aspectRatioFor,
  secondsFor,
  modelFor,
  buildVideoPrompt,
  sourceHash,
} from '../../shared/videoFactory.ts';

// Stage one of the video factory: read the content plan a week ahead, turn each
// post into a video brief, and hand those briefs to the video engine. Nothing is
// charged for a post that already has a job.

const WINDOW_DAYS = 7;
const MAX_NEW_PER_RUN = 6;
const MAX_SUBMIT_PER_RUN = 4;
const PLAN_LIMIT = 100;
const ACTIVE_POST_STATUSES = ['planned', 'approved', 'scheduled'];
const LIVE_JOB_STATUSES = ['queued', 'generating', 'scoring', 'passed', 'flagged', 'approved'];
const OPEN_JOB_STATUSES = ['queued', 'generating', 'scoring'];

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

function videoRequest(job, extra = {}) {
  const request = {
    model: job.model || modelFor(job.aspect_ratio),
    prompt: job.prompt,
    seconds: job.seconds || 6,
    aspect_ratio: job.aspect_ratio || '9:16',
    resolution: RESOLUTION,
    generate_audio: true,
    ...extra,
  };
  // The post's own image opens the clip, so the video continues the plan rather
  // than starting from a blank prompt.
  if (job.source_image_url) {
    request.frame_images = [
      { type: 'image_url', image_url: { url: job.source_image_url }, frame_type: 'first_frame' },
    ];
  }
  return request;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    let businesses = [];
    if (body?.business_id) {
      const access = await resolveBusiness(base44, body.business_id);
      if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
      businesses = [access.business];
    } else {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const page = await base44.entities.Business.list({ sort: '-created_date', limit: 10 });
      businesses = page.items || [];
    }

    if (!businesses.length) {
      return Response.json({ error: 'Add a business profile first, then build its video plan.' }, { status: 400 });
    }

    const today = toDateString(new Date());
    const horizon = addDays(today, WINDOW_DAYS);

    const { baseURL, token, headers } = base44.asServiceRole.aiGateway.connection();
    const videos = new OpenAI({ baseURL, apiKey: token, defaultHeaders: headers }).videos;

    const summary = { planned: 0, submitted: 0, already_queued: 0, credits_estimated: 0, businesses: [], errors: [] };

    for (const business of businesses) {
      const planPage = await base44.entities.ScheduledPost.filter(
        { business_id: business.id, status: { $in: ACTIVE_POST_STATUSES } },
        { sort: 'scheduled_date', limit: PLAN_LIMIT }
      );
      const dueThisWeek = (planPage.items || []).filter(
        (post) => post.scheduled_date && post.scheduled_date >= today && post.scheduled_date <= horizon
      );
      if (!dueThisWeek.length) continue;
      summary.businesses.push(business.name);

      const jobPage = await base44.entities.VideoJob.filter(
        { business_id: business.id, post_id: { $in: dueThisWeek.map((post) => post.id) } },
        { limit: PLAN_LIMIT }
      );
      const existingJobs = jobPage.items || [];
      const covered = new Set(existingJobs.filter((job) => LIVE_JOB_STATUSES.includes(job.status)).map((job) => job.post_id));

      let createdThisRun = 0;
      for (const post of dueThisWeek) {
        if (covered.has(post.id) || createdThisRun >= MAX_NEW_PER_RUN) continue;

        const aspectRatio = aspectRatioFor(post.platform, post.format);
        const seconds = secondsFor(post.format);
        const model = modelFor(aspectRatio);
        const prompt = buildVideoPrompt(post, business);

        await base44.entities.VideoJob.create({
          business_id: business.id,
          post_id: post.id,
          post_title: post.title || post.hook || `${post.platform} ${post.format || 'post'}`,
          scheduled_date: post.scheduled_date,
          platform: post.platform,
          format: post.format || 'post',
          aspect_ratio: aspectRatio,
          seconds,
          model,
          prompt,
          source_image_url: post.image_url || '',
          source_hash: sourceHash(post),
          status: 'queued',
        });
        createdThisRun += 1;
        summary.planned += 1;
      }

      // Submit anything still waiting, including jobs a reviewer asked to redo.
      const queuedPage = await base44.entities.VideoJob.filter(
        { business_id: business.id, status: { $in: OPEN_JOB_STATUSES } },
        { sort: 'scheduled_date', limit: PLAN_LIMIT }
      );
      const queued = (queuedPage.items || []).filter((job) => job.status === 'queued').slice(0, MAX_SUBMIT_PER_RUN);
      summary.already_queued += (queuedPage.items || []).filter((job) => job.status !== 'queued').length;

      for (const job of queued) {
        try {
          const estimate = await videos
            .create(videoRequest(job, { dry_run: true }), { maxRetries: 0 })
            .catch(() => null);
          const estimatedCredits = Number(estimate?.usage?.base44_credits);
          const created = await videos.create(videoRequest(job), { maxRetries: 0 });

          if (!created?.id) throw new Error('The video engine did not return a job id.');

          if (Number.isFinite(estimatedCredits)) summary.credits_estimated += estimatedCredits;

          await base44.entities.VideoJob.update(job.id, {
            status: 'generating',
            gateway_video_id: created.id,
            submitted_at: new Date().toISOString(),
            attempts: (job.attempts || 0) + 1,
            last_error: '',
            ...(Number.isFinite(estimatedCredits) ? { estimated_credits: estimatedCredits } : {}),
          });
          summary.submitted += 1;
        } catch (error) {
          await base44.entities.VideoJob.update(job.id, {
            status: 'failed',
            last_error: String(error?.message || error).slice(0, 300),
            attempts: (job.attempts || 0) + 1,
          });
          summary.errors.push(`${business.name}: ${String(error?.message || error).slice(0, 160)}`);
        }
      }
    }

    return Response.json({ ...summary, errors: summary.errors.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}