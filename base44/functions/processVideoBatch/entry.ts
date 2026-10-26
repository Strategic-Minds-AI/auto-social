import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { readMediaVideo } from '../../shared/mediaClient.ts';
import { checkAiBudget, recordAiUsage, resolveBusiness } from '../../shared/access.ts';
import {
  BENCHMARK_CRITERIA,
  BENCHMARK_TARGET,
  BENCHMARK_VERSION,
  RUBRIC_SCHEMA,
  buildTests,
  evaluateBenchmark,
  normalizeScores,
} from '../../shared/videoFactory.ts';

// Stage two of the video factory: collect finished clips, run the mechanical
// tests, score the creative against the benchmark, and store the verdict. A job
// that is still rendering is left alone rather than treated as a failure.

const PENDING_STATUSES = ['generating', 'scoring'];
const MAX_COLLECT_PER_RUN = 6;
const MAX_SCORED_PER_RUN = 3;
const DELIVERY_TIMEOUT_MS = 15000;
const UNFINISHED = ['queued', 'in_progress', 'processing', 'running'];

async function checkDelivery(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-2048' },
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    const contentType = response.headers.get('content-type') || '';
    const ok = response.ok && contentType.startsWith('video/');
    return {
      status: ok ? 'pass' : 'fail',
      detail: ok
        ? `Stored and served as ${contentType}.`
        : `The stored file answered HTTP ${response.status}${contentType ? ` as ${contentType}` : ''}.`,
    };
  } catch (error) {
    return { status: 'fail', detail: `The stored video could not be read: ${String(error?.message || error).slice(0, 160)}` };
  }
}

function rubricPrompt({ post, business, job, tests }) {
  const criteria = BENCHMARK_CRITERIA.map(
    (criterion) => `- ${criterion.key} (0 to ${criterion.max}): ${criterion.guide}`
  ).join('\n');

  return `You are the quality gate of an autonomous social video factory. Judge how well this video's creative package matches the brief it was made from.

BUSINESS
Name: ${business?.name || 'not given'}
Industry: ${business?.industry || 'not given'}
Audience: ${business?.target_audience || 'not given'}
Brand tone: ${business?.tone || 'professional'}

PLANNED POST
Platform and format: ${post?.platform || 'unknown'} ${post?.format || ''}
Pillar: ${post?.pillar || 'not set'}
Hook: ${post?.hook || 'none'}
Caption: ${post?.caption || 'none'}
Call to action: ${post?.call_to_action || 'none'}

DELIVERED VIDEO
Length: ${job.seconds} seconds, framed ${job.aspect_ratio}, model ${job.model}

MECHANICAL CHECKS ALREADY RUN
${tests.map((test) => `- ${test.name}: ${test.status} (${test.detail})`).join('\n')}

Score every criterion below, with a one-sentence note explaining the score:
${criteria}

You are reviewing the brief, the copy and the delivery facts. You cannot see the pixels, so never claim to have watched the video. Judge whether this package is ready to publish, and name plainly what would lift it.
Return JSON only.`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const query = { status: { $in: PENDING_STATUSES } };
    if (body?.business_id) {
      const access = await resolveBusiness(base44, body.business_id);
      if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
      query.business_id = body.business_id;
    } else if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const jobPage = await base44.entities.VideoJob.filter(query, { sort: 'submitted_at', limit: MAX_COLLECT_PER_RUN });
    const jobs = jobPage.items || [];
    if (!jobs.length) return Response.json({ considered: 0, stored: 0, still_rendering: 0, passed: 0, flagged: 0, failed: 0 });

    const summary = { considered: jobs.length, stored: 0, still_rendering: 0, passed: 0, flagged: 0, failed: 0, errors: [] };
    let scored = 0;

    for (const job of jobs) {
      let engineVideo = null;
      try {
        engineVideo = await readMediaVideo(job.gateway_video_id);
      } catch (error) {
        summary.errors.push(`retrieve: ${String(error?.message || error).slice(0, 160)}`);
        continue;
      }

      const status = engineVideo?.status;
      if (UNFINISHED.includes(status)) {
        summary.still_rendering += 1;
        continue;
      }

      if (status === 'failed') {
        const attempts = (job.attempts || 0) + 1;
        await base44.entities.VideoJob.update(job.id, {
          status: attempts >= 3 ? 'failed' : 'queued',
          gateway_video_id: '',
          attempts,
          last_error: String(engineVideo?.error?.message || 'The video engine rejected this job.').slice(0, 300),
        });
        summary.failed += 1;
        continue;
      }

      const videoUrl = engineVideo?.url;
      if (!videoUrl) {
        summary.still_rendering += 1;
        continue;
      }

      const post = await base44.entities.ScheduledPost.get(job.post_id).catch(() => null);
      const business = await base44.entities.Business.get(job.business_id).catch(() => null);

      const tests = buildTests({ post: post || {}, prompt: job.prompt || '' });
      const delivery = await checkDelivery(videoUrl);
      tests.push({ name: 'video_delivered', ...delivery });

      // Nothing has been scored yet, so the video is stored now and the verdict
      // is written on a later pass rather than losing the clip.
      await base44.entities.VideoJob.update(job.id, { video_url: videoUrl, completed_at: new Date().toISOString() });

      if (job.status === 'generating') {
        await base44.entities.VideoJob.update(job.id, { status: 'scoring', tests });
      }

      const budget = await checkAiBudget(base44, user);
      if (scored >= MAX_SCORED_PER_RUN || !budget.ok) {
        summary.stored += 1;
        continue;
      }

      try {
        const { data, meta } = await generateJsonWithMeta(base44, {
          prompt: rubricPrompt({ post, business, job, tests }),
          schema: RUBRIC_SCHEMA,
          temperature: 0.2,
        });

        const scores = normalizeScores(data?.scores);
        const verdict = evaluateBenchmark(scores, tests);

        await base44.entities.VideoJob.update(job.id, {
          status: verdict.passed ? 'passed' : 'flagged',
          tests,
          scores,
          score_total: verdict.total,
          benchmark_target: BENCHMARK_TARGET,
          benchmark_version: BENCHMARK_VERSION,
          benchmark_passed: verdict.passed,
          safety_ok: verdict.safety_ok,
          qa_summary: String(data?.summary || '').slice(0, 1200),
          qa_provider: meta?.provider || '',
        });

        await recordAiUsage(base44, user, meta);
        scored += 1;
        summary.stored += 1;
        if (verdict.passed) summary.passed += 1;
        else summary.flagged += 1;
      } catch (error) {
        // The clip is safe on the job record; scoring is retried next run.
        summary.errors.push(`score: ${String(error?.message || error).slice(0, 160)}`);
      }
    }

    return Response.json({ ...summary, errors: summary.errors.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}