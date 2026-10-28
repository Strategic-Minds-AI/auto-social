import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

/* THE BRIDGE GATEWAY — portable copy.

   Your Ollama and Docker machines sit behind a router the cloud cannot dial into.
   So the bridge runs the other way: the machine calls out, picks up its work, and reports
   what came back. No tunnel, no public port, nothing listening between jobs.

   This endpoint is on the public internet, so it is reached with the shared bridge key
   rather than a session: no key, no answer. Everything it reads and writes goes through the
   service role, scoped to the queue and the worker records only. */

const MAX_JOBS_PER_CLAIM = 5;
const LEASE_MINUTES = 10;
const MAX_ATTEMPTS = 3;
const MAX_RESULT_CHARS = 8000;
const KINDS = [
  'ollama_chat',
  'ollama_models',
  'docker_ps',
  'docker_images',
  'docker_logs',
  'docker_run',
  'host_shell',
  'sandbox_run',
];

/* The three kinds that run a command the operator typed rather than reading something.
   Each is written to the action log when it ends, so a change made on a machine is never
   only in the job queue. If this app has no X1ActionLog entity the receipt is skipped. */
const RECEIPTED = {
  docker_run: {
    operation: 'docker_run',
    target: (job) => text(job.command, 300),
    undo: 'The container itself can change data on the machine. That change is not reversible from here.',
    reason: 'An explicit docker command was sent to the local fleet by the operator.',
  },
  host_shell: {
    operation: 'host_shell',
    target: (job) => `${text(job.cwd, 120) ? `${text(job.cwd, 100)} · ` : ''}${text(job.command, 240)}`,
    undo: "A terminal command runs with that machine user's own permissions, so anything it changed is not reversible from here.",
    reason: 'The operator started a terminal run from the console.',
  },
  sandbox_run: {
    operation: 'sandbox_run',
    target: (job) => `${text(job.image, 80) || 'alpine:latest'} · ${text(job.command, 200)}`,
    undo: 'The sandbox container is thrown away when it ends; anything it reached on the network is not.',
    reason: 'The operator ran a command in a throwaway container.',
  },
};

function text(value, max) {
  if (value === null || value === undefined) return '';
  const cleaned = String(value).trim();
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function readBody(req) {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function findWorker(base44, name) {
  if (!name) return null;
  const page = await base44.asServiceRole.entities.X1Worker.filter({ name }, { limit: 1 });
  const items = (page && page.items) || [];
  return items[0] || null;
}

function workerReport(worker) {
  const source = worker && typeof worker === 'object' ? worker : {};
  const models = Array.isArray(source.models) ? source.models.slice(0, 24).map((model) => text(model, 80)).filter(Boolean) : [];
  const containers = Array.isArray(source.containers)
    ? source.containers.slice(0, 24).map((container) => ({
        name: text(container && container.name, 80),
        image: text(container && container.image, 120),
        state: text(container && container.state, 24),
        status: text(container && container.status, 80),
        cpu_percent: number(container && container.cpu_percent, 0),
        mem_percent: number(container && container.mem_percent, 0),
        mem_usage: text(container && container.mem_usage, 60),
        net_io: text(container && container.net_io, 60),
        pids: number(container && container.pids, 0),
      }))
    : [];
  return {
    name: text(source.name, 120),
    kind: ['ollama', 'docker', 'host', 'mixed'].includes(text(source.kind, 20)) ? text(source.kind, 20) : 'mixed',
    status: 'online',
    host: text(source.host, 120),
    platform: text(source.platform, 80),
    bridge_version: text(source.bridge_version, 24),
    ollama_version: text(source.ollama_version, 40),
    docker_version: text(source.docker_version, 40),
    models,
    docker_available: source.docker_available === true,
    shell_enabled: source.shell_enabled === true,
    containers,
    image_count: number(source.image_count, 0),
    capabilities: Array.isArray(source.capabilities) ? source.capabilities.slice(0, 12).map((entry) => text(entry, 40)).filter(Boolean) : [],
    last_seen_at: new Date().toISOString(),
    last_error: text(source.last_error, 300),
    auto_boot: source.auto_boot === true,
    boot_service: text(source.boot_service, 120),
    reconnects: number(source.reconnects, 0),
    uptime_seconds: number(source.uptime_seconds, 0),
    pid: number(source.pid, 0),
    connected_since: text(source.connected_since, 40),
    last_disconnect_at: text(source.last_disconnect_at, 40),
    state_dir: text(source.state_dir, 200),
  };
}

async function heartbeat(base44, body) {
  const report = workerReport(body.worker);
  if (!report.name) return Response.json({ error: 'The worker must send its name.' }, { status: 400 });

  const existing = await findWorker(base44, report.name);
  const saved = existing
    ? await base44.asServiceRole.entities.X1Worker.update(existing.id, report)
    : await base44.asServiceRole.entities.X1Worker.create(report);
  const queued = await base44.asServiceRole.entities.X1BridgeJob.count({ status: 'queued' });

  return Response.json({ ok: true, worker_id: saved.id, queued, server_time: report.last_seen_at });
}

/* A worker that dies mid-job would otherwise hold its work forever. An expired lease puts
   the job back on the queue twice; after that it is failed with the reason, so nothing
   bounces between machines in silence. */
async function releaseExpiredLeases(base44, nowIso) {
  await base44.asServiceRole.entities.X1BridgeJob.updateMany(
    { status: 'claimed', lease_expires_at: { $lt: nowIso }, attempts: { $lt: MAX_ATTEMPTS } },
    {
      $set: { status: 'queued', worker_name: '', worker_id: '', claimed_at: '', lease_expires_at: '' },
      $inc: { attempts: 1 },
    }
  );
  await base44.asServiceRole.entities.X1BridgeJob.updateMany(
    { status: 'claimed', lease_expires_at: { $lt: nowIso }, attempts: { $gte: MAX_ATTEMPTS } },
    { $set: { status: 'failed', error: 'The lease expired three times: no machine finished this work.', finished_at: nowIso } }
  );
}

async function claim(base44, body) {
  const source = body.worker && typeof body.worker === 'object' ? body.worker : {};
  const workerName = text(source.name, 120) || 'unnamed worker';
  const max = Math.min(Math.max(number(body.max, 2), 1), MAX_JOBS_PER_CLAIM);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  await releaseExpiredLeases(base44, nowIso);

  const page = await base44.asServiceRole.entities.X1BridgeJob.filter({ status: 'queued' }, { sort: 'created_date', limit: max });
  const waiting = (page && page.items) || [];
  const lease = new Date(now + LEASE_MINUTES * 60000).toISOString();
  const jobs = [];

  for (const job of waiting) {
    const updated = await base44.asServiceRole.entities.X1BridgeJob.update(job.id, {
      status: 'claimed',
      worker_name: workerName,
      worker_id: text(source.id, 80),
      claimed_at: nowIso,
      lease_expires_at: lease,
      attempts: number(job.attempts, 0) + 1,
    });
    jobs.push({
      id: updated.id,
      kind: updated.kind,
      title: updated.title || updated.kind,
      task_id: updated.task_id || '',
      model: updated.model || '',
      prompt: updated.prompt || '',
      system_prompt: updated.system_prompt || '',
      command: updated.command || '',
      cwd: updated.cwd || '',
      image: updated.image || '',
      network: updated.network || 'none',
      container: updated.container || '',
      tail: number(updated.tail, 200),
    });
  }

  const worker = await findWorker(base44, workerName);
  if (worker) await base44.asServiceRole.entities.X1Worker.update(worker.id, { status: 'online', last_seen_at: nowIso });

  return Response.json({ ok: true, worker: workerName, jobs, lease_seconds: LEASE_MINUTES * 60, server_time: nowIso });
}

async function complete(base44, body) {
  const jobId = text(body.job_id, 80);
  if (!jobId) return Response.json({ error: 'A job id is required.' }, { status: 400 });

  let job = null;
  try {
    job = await base44.asServiceRole.entities.X1BridgeJob.get(jobId);
  } catch {
    job = null;
  }
  if (!job) return Response.json({ error: 'That job is not on the queue.' }, { status: 404 });

  const status = text(body.status, 20) === 'done' ? 'done' : 'failed';
  const workerName = text(body.worker_name, 120) || job.worker_name || 'local worker';
  const now = new Date().toISOString();
  const resultText = text(body.result, MAX_RESULT_CHARS);
  const errorText = text(body.error, 1000);
  const summary = status === 'done' ? text(body.summary, 300) || resultText.slice(0, 300) : errorText.slice(0, 300);

  const saved = await base44.asServiceRole.entities.X1BridgeJob.update(jobId, {
    status,
    worker_name: workerName,
    result: resultText,
    error: errorText,
    duration_ms: number(body.duration_ms, 0),
    finished_at: now,
  });

  /* A board item only exists in apps that have one, so this is tolerant on purpose. */
  if (job.task_id) {
    try {
      await base44.asServiceRole.entities.X1Task.update(
        job.task_id,
        status === 'done'
          ? { status: 'done', dispatch_status: 'complete', dispatch_detail: summary, result: resultText.slice(0, 900) }
          : { status: 'blocked', dispatch_status: 'blocked', dispatch_detail: summary }
      );
    } catch {
      /* no board in this app */
    }
  }

  const receipt = RECEIPTED[job.kind];
  if (receipt && base44.asServiceRole.entities.X1ActionLog) {
    try {
      await base44.asServiceRole.entities.X1ActionLog.create({
        system: 'fleet',
        operation: receipt.operation,
        target: receipt.target(job),
        actor: workerName,
        verdict: 'allowed',
        outcome: status === 'done' ? 'succeeded' : 'failed',
        risk: 'high',
        reversible: false,
        undo: receipt.undo,
        reasons: [receipt.reason],
        summary,
        detail: status === 'done' ? resultText.slice(0, 800) : errorText.slice(0, 800),
      });
    } catch {
      /* no action log in this app */
    }
  }

  const worker = await findWorker(base44, workerName);
  if (worker) {
    await base44.asServiceRole.entities.X1Worker.update(worker.id, {
      status: 'online',
      last_seen_at: now,
      jobs_completed: number(worker.jobs_completed, 0) + (status === 'done' ? 1 : 0),
      jobs_failed: number(worker.jobs_failed, 0) + (status === 'done' ? 0 : 1),
      last_error: status === 'done' ? worker.last_error || '' : errorText.slice(0, 300),
    });
  }

  return Response.json({ ok: true, job_id: saved.id, status });
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await readBody(req);

    const expected = (secrets.get('X1_BRIDGE_KEY') || '').trim();
    if (!expected) {
      return Response.json({ error: 'No bridge key is set on this app, so the gateway stays shut.' }, { status: 503 });
    }
    const provided = (text(body.key, 200) || text(req.headers.get('x-x1-bridge-key'), 200)).trim();
    if (!provided || provided !== expected) {
      return Response.json({ error: 'The bridge key does not match.' }, { status: 401 });
    }

    const action = text(body.action, 20);
    if (action === 'heartbeat') return await heartbeat(base44, body);
    if (action === 'claim') return await claim(base44, body);
    if (action === 'complete') return await complete(base44, body);
    if (action === 'kinds') return Response.json({ ok: true, kinds: KINDS });

    return Response.json(
      { error: `Unknown action "${action}". Use heartbeat, claim or complete.` },
      { status: 400 }
    );
  } catch (error) {
    return Response.json({ error: error.message || 'The gateway could not finish that call.' }, { status: 500 });
  }
}