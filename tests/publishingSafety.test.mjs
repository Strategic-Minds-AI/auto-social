import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = {
  worker: read('base44/functions/publishDuePosts/entry.ts'),
  manager: read('base44/functions/manageScheduledPost/entry.ts'),
  access: read('base44/shared/access.ts'),
  time: read('base44/shared/time.ts'),
  safety: read('base44/shared/publish-safety.ts'),
};
const clone = value => structuredClone(value);
const old = '2020-01-01T10:00:00.000Z';

// Execute the actual handlers with SDK/provider imports replaced by bounded stubs.
// No provider or database network call is permitted; writes affect only these maps.
function harness(kind = 'worker', options = {}) {
  const post = { id: 'post-1', business_id: 'business-a', social_account_id: 'account-a', platform: 'facebook',
    status: 'scheduled', scheduled_at: old, scheduled_date: '2020-01-01', scheduled_time: '10:00', timezone: 'UTC',
    caption: 'Reviewed fixture copy', approved_by: 'owner@example.test', approved_at: old,
    publish_attempts: 0, max_attempts: 3, publish_history: [], ...options.post };
  const account = { id: 'account-a', business_id: 'business-a', platform: 'facebook', external_id: 'page-a',
    status: 'connected', name: 'Fixture page', ...options.account };
  const posts = new Map([[post.id, clone(post)]]), writes = [], providerCalls = [], validations = [];
  let receiptFailures = 0, claimCallbacks = 0;
  const entities = {
    ScheduledPost: {
      async filter(query, config = {}) {
        return { items: [...posts.values()].filter(row => row.status === query.status &&
          (!query.scheduled_at || Date.parse(row.scheduled_at) <= Date.parse(query.scheduled_at.$lte))).slice(0, config.limit || 10).map(clone) };
      },
      async get(id) { return clone(posts.get(id) || null); },
      async update(id, patch) {
        if (!posts.has(id)) throw new Error('Fixture record missing');
        writes.push({ entity: 'post', id, patch: clone(patch) });
        if (patch.status === 'published' && options.receiptFailure && receiptFailures++ === 0) {
          if (options.receiptFailure === 'after_commit') posts.set(id, { ...posts.get(id), ...clone(patch) });
          throw new Error('Receipt storage response lost');
        }
        posts.set(id, { ...posts.get(id), ...clone(patch) });
        if (patch.status === 'publishing' && options.afterClaim && claimCallbacks++ === 0) options.afterClaim(posts.get(id));
        return clone(posts.get(id));
      },
    },
    SocialAccount: {
      async get(id) { return id === post.social_account_id && !options.accountMissing ? clone(account) : null; },
      async update(id, patch) { writes.push({ entity: 'account', id, patch: clone(patch) }); return { ...account, ...patch }; },
    },
    Business: { async get(id) { return id === post.business_id ? { id, created_by_id: 'owner' } : null; } },
  };
  const base44 = { auth: { async me() { return options.user === undefined ? { id: 'owner', role: 'admin', email: 'owner@example.test' } : options.user; } }, entities,
    asServiceRole: { entities, connectors: { async getConnection(name) {
      if (options.connectionMissing) throw new Error('Fixture connector missing');
      return { accessToken: 'fixture-token' };
    } } } };
  const publish = async (platform, args) => {
    providerCalls.push({ platform, args: clone(args) });
    if (options.providerError) throw new Error(options.providerError);
    if (options.missingReceipt) return {};
    return platform === 'facebook' ? { postId: 'provider-post-1' } : { external_post_id: 'provider-post-1', published_url: 'https://provider.example/post-1' };
  };
  const validate = async platform => { validations.push(platform); if (options.validationError) throw new Error(options.validationError); return 'fixture-token'; };
  const context = vm.createContext({
    Response, Request, Date, Intl, crypto: webcrypto, structuredClone,
    createClientFromRequest: () => base44,
    publishToPage: args => publish('facebook', args),
    pageTokenFor: () => validate('facebook'),
    postUrl: () => 'https://provider.example/post-1',
    publishReelToInstagram: ({ post, account }) => publish('instagram', { post, account }),
    validateReelForInstagram: () => validate('instagram'),
    linkedinProfile: () => validate('linkedin'),
    publishToLinkedIn: args => publish('linkedin', args),
    fetch: () => { throw new Error('Network access forbidden in publishing safety tests'); },
  });
  for (const module of ['access', 'time', 'safety']) vm.runInContext(source[module].replace(/^export /gm, ''), context, { filename: module + '.ts' });
  const handler = source[kind].replace(/^import .*;\r?\n/gm, '').replace('export default async function', 'globalThis.handler = async function');
  vm.runInContext(handler, context, { filename: kind + '.ts' });
  const invoke = async (body = {}) => {
    const response = await context.handler(new Request('https://local.test/function', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  };
  return { invoke, posts, writes, providerCalls, validations };
}

test('worker requires an authenticated administrator before accessing the queue', async () => {
  for (const [user, status] of [[null, 401], [{ id: 'member', role: 'user' }, 403]]) {
    const h = harness('worker', { user }); assert.equal((await h.invoke()).status, status);
    assert.equal(h.writes.length, 0); assert.equal(h.providerCalls.length, 0);
  }
});

test('worker rejects mismatched business, platform, id, missing binding, and disconnected accounts before send', async () => {
  for (const account of [{ business_id: 'business-b' }, { platform: 'linkedin' }, { id: 'other-account' }, { external_id: '' }, { status: 'needs_reauth' }]) {
    const h = harness('worker', { account }); const result = await h.invoke();
    assert.equal(h.providerCalls.length, 0); assert.equal(h.validations.length, 0);
    assert.equal(result.body.published, 0); assert.equal(result.body.failed, 1);
    assert.match(result.body.results[0].message, /business|platform|account|binding|verified/);
  }
});

test('a successful worker send persists the provider receipt and is not picked up again', async () => {
  const h = harness(); const first = await h.invoke();
  assert.equal(first.body.published, 1); assert.equal(h.providerCalls.length, 1);
  assert.equal(h.posts.get('post-1').status, 'published'); assert.equal(h.posts.get('post-1').external_post_id, 'provider-post-1');
  const second = await h.invoke(); assert.equal(second.body.processed, 0); assert.equal(h.providerCalls.length, 1);
});

test('worker dispatches the reread claimed post and rejects a changed account binding', async () => {
  const h = harness('worker', { afterClaim: row => { row.caption = 'Updated approved copy'; } });
  await h.invoke(); assert.equal(h.providerCalls[0].args.message, 'Updated approved copy');
  const changed = harness('worker', { afterClaim: row => { row.business_id = 'business-b'; } });
  await changed.invoke(); assert.equal(changed.providerCalls.length, 0);
});

test('a provider timeout is quarantined instead of scheduled for automatic retry', async () => {
  const h = harness('worker', { providerError: 'Connection lost after request' }); const first = await h.invoke();
  assert.equal(first.body.results[0].outcome, 'reconciliation_required');
  assert.equal(h.posts.get('post-1').status, 'failed'); assert.match(h.posts.get('post-1').publish_error, /^PUBLISH_OUTCOME_UNCONFIRMED:/);
  assert.equal(h.posts.get('post-1').publish_history.at(-1).event, 'outcome_unknown');
  await h.invoke(); assert.equal(h.providerCalls.length, 1);
});

test('a successful provider response followed by uncertain receipt persistence never requeues the post', async () => {
  for (const receiptFailure of ['before_commit', 'after_commit']) {
    const h = harness('worker', { receiptFailure }); const first = await h.invoke();
    assert.equal(h.providerCalls.length, 1); assert.equal(first.body.published, 0);
    assert.equal(first.body.results[0].outcome, 'reconciliation_required');
    assert.equal(h.posts.get('post-1').status, 'failed');
    await h.invoke(); assert.equal(h.providerCalls.length, 1);
    if (receiptFailure === 'after_commit') assert.equal(h.posts.get('post-1').external_post_id, 'provider-post-1');
  }
});

test('a malformed provider success without a receipt is not reported published or auto-retried', async () => {
  const h = harness('worker', { missingReceipt: true }); const result = await h.invoke();
  assert.equal(result.body.published, 0); assert.equal(result.body.results[0].outcome, 'reconciliation_required');
  assert.equal(h.posts.get('post-1').status, 'failed'); await h.invoke(); assert.equal(h.providerCalls.length, 1);
});

test('stale publishing locks require reconciliation unless a provider receipt is already saved', async () => {
  for (const receipt of ['', 'provider-existing']) {
    const h = harness('worker', { post: { status: 'publishing', locked_at: old, external_post_id: receipt } });
    const result = await h.invoke(); assert.equal(h.providerCalls.length, 0);
    assert.equal(h.posts.get('post-1').status, receipt ? 'published' : 'failed');
    assert.equal(result.body.results[0].outcome, receipt ? 'receipt_recovered' : 'reconciliation_required');
    await h.invoke(); assert.equal(h.providerCalls.length, 0);
  }
});

test('worker validation-only requests never claim, mutate, recover, or publish queue records', async () => {
  for (const options of [{}, { validationError: 'Read validation failed' }, { account: { business_id: 'business-b' } }, { post: { status: 'publishing', locked_at: old } }]) {
    const h = harness('worker', options), before = clone([...h.posts]);
    const result = await h.invoke({ dry_run: true }); assert.equal(result.status, 200);
    assert.deepEqual([...h.posts], before); assert.equal(h.writes.length, 0); assert.equal(h.providerCalls.length, 0);
  }
});

test('a missing connector blocks without consuming publishing attempts', async () => {
  const h = harness('worker', { connectionMissing: true }); const result = await h.invoke();
  assert.equal(result.body.blocked, 1); assert.equal(h.writes.length, 0); assert.equal(h.providerCalls.length, 0);
});

test('changing an uncertain post status back to scheduled does not bypass reconciliation', async () => {
  for (const marker of [{ publish_error: 'PUBLISH_OUTCOME_UNCONFIRMED: fixture' }, { publish_history: [{ event: 'outcome_unknown' }] }]) {
    const h = harness('worker', { post: marker }); const result = await h.invoke();
    assert.equal(result.body.results[0].outcome, 'reconciliation_required');
    assert.equal(h.writes.length, 0); assert.equal(h.providerCalls.length, 0);
  }
});

test('immediate publishing rejects a different business or platform before any provider send', async () => {
  for (const account of [{ business_id: 'business-b' }, { platform: 'instagram' }, { external_id: '' }, { status: 'unavailable' }]) {
    const h = harness('manager', { account }); const result = await h.invoke({ action: 'publish_now', post_id: 'post-1' });
    assert.equal(result.status, 502); assert.equal(h.providerCalls.length, 0);
    assert.equal(h.posts.get('post-1').status, 'failed');
  }
});

test('manual retry, reopen, approval, reschedule, and immediate publish cannot erase an unknown provider outcome', async () => {
  for (const action of ['retry', 'reopen', 'approve', 'schedule', 'reschedule', 'publish_now']) {
    const h = harness('manager', { post: { status: 'failed', publish_error: 'PUBLISH_OUTCOME_UNCONFIRMED: fixture' } });
    const result = await h.invoke({ action, post_id: 'post-1' });
    assert.equal(result.status, 409); assert.equal(result.body.code, 'publish_reconciliation_required');
    assert.equal(h.writes.length, 0); assert.equal(h.providerCalls.length, 0);
  }
});

test('clearing the error text alone cannot hide an unresolved receipt history, while cancellation remains possible', async () => {
  const h = harness('manager', { post: { status: 'failed', publish_history: [{ event: 'outcome_unknown' }], publish_error: '' } });
  assert.equal((await h.invoke({ action: 'retry', post_id: 'post-1' })).status, 409);
  assert.equal((await h.invoke({ action: 'cancel', post_id: 'post-1' })).status, 200);
  assert.equal(h.posts.get('post-1').status, 'cancelled'); assert.equal(h.providerCalls.length, 0);
  assert.equal((await h.invoke({ action: 'approve', post_id: 'post-1' })).status, 409);
});

test('immediate publishing with a saved provider receipt is refused even if local state says failed', async () => {
  const h = harness('manager', { post: { status: 'failed', external_post_id: 'provider-existing' } });
  const result = await h.invoke({ action: 'publish_now', post_id: 'post-1' });
  assert.equal(result.status, 409); assert.equal(result.body.code, 'provider_receipt_exists');
  assert.equal(h.writes.length, 0); assert.equal(h.providerCalls.length, 0);
});

test('immediate publication with a lost receipt response preserves uncertainty and blocks manual retry', async () => {
  const h = harness('manager', { receiptFailure: 'before_commit' });
  assert.equal((await h.invoke({ action: 'publish_now', post_id: 'post-1' })).status, 502);
  assert.match(h.posts.get('post-1').publish_error, /^PUBLISH_OUTCOME_UNCONFIRMED:/);
  assert.equal((await h.invoke({ action: 'retry', post_id: 'post-1' })).status, 409);
  assert.equal(h.providerCalls.length, 1);
});

// Independent Guardian regressions: the new recovery guard must apply to a
// freshly claimed record, not only the earlier queue/request snapshot.
for (const kind of ['worker', 'manager']) {
  test(`Guardian: ${kind} refuses dispatch when claim readback exposes a new unknown outcome`, async () => {
    const h = harness(kind, { afterClaim: row => {
      row.publish_error = 'PUBLISH_OUTCOME_UNCONFIRMED: prior response was lost';
      row.publish_history = [{ event: 'outcome_unknown', message: 'Prior response was lost' }];
    } });
    await h.invoke(kind === 'manager' ? { action: 'publish_now', post_id: 'post-1' } : {});
    assert.equal(h.providerCalls.length, 0, 'A newly visible unknown provider outcome must prevent another send.');
    assert.notEqual(h.posts.get('post-1').status, 'published');
    assert.match(h.posts.get('post-1').publish_error, /^PUBLISH_OUTCOME_UNCONFIRMED:/);
  });
}
