# Publisher safety review

Base: `e66329e75ae27e080cd08a76096a065d6e4f8cdd`.

This patch hardens the existing scheduled and immediate publishing handlers. It does not add a scheduler, provision provider credentials, migrate tenant identity, deploy a function, or enable publishing in another application.

## Repaired behavior

- Both handlers reject a publishing account whose record ID, business, platform, external account binding, or connection state does not match the post.
- The scheduled worker dispatches the post returned by its claim readback rather than an earlier queue snapshot.
- Both handlers recheck the freshly claimed record for an unknown provider outcome before dispatch. The immediate path also refuses a missing, changed, or already-receipted claim. A newly observed reconciliation marker is preserved without another send.
- A provider exception, missing receipt, or failed receipt persistence is recorded as an unconfirmed outcome. The worker does not automatically reschedule it.
- An abandoned publishing lock with no stored receipt becomes a failed, reconciliation-required item. A stored receipt can restore the published state without sending again.
- The normal manager actions cannot erase an unconfirmed outcome through retry, reopening, approval, or rescheduling. Cancellation remains possible. A saved provider receipt also blocks an immediate republish.
- The scheduled worker's validation-only path does not mutate posts, consume attempts, release locks, or send content. Provider validation reads remain part of that path.
- Claim tokens use random UUIDs; this removes same-millisecond token collisions but does not make claims atomic.

## Remaining release blockers

The Base44 SDK update followed by get is not an atomic compare-and-set. Two processes can still both pass their claim readback before either persists a receipt. The existing manual publishing path is another competing sender. **Do not enable concurrent production dispatch or certify exactly-once delivery from this patch.** An atomic durable claim, a single dispatch boundary, and independent concurrency validation are still required.

The local `idempotency_key` is not sent to a verified provider deduplication API. A timeout may mean a post was accepted. Conservatively quarantining that uncertainty can require operator reconciliation even when a request failed before it reached the provider. Verify the platform's actual post/account/content before recording an `outcome_reconciled` history event and clearing the unconfirmed error. This patch provides no automatic reconciliation or UI override.

The account binding checks are defense in depth. They do not prove that a queued approval is immutable or authorized: the existing entity model permits owner writes to scheduling and approval fields. A migrated runtime needs a server-controlled approval transition and a verified mapping between the application's authenticated user, business, provider account, and least-privilege server credential. A migrated SocialAccount row or a `connected` label alone is insufficient.

Provider implementations remain the existing Facebook Page, Instagram Reel, and LinkedIn member paths. The immediate handler supports Facebook and Instagram. An X connector declaration does not implement an X publishing transport. No provider tokens, refresh grants, or platform compatibility were tested by this patch.

## Validation and rollback

Run `node --test tests/publishingSafety.test.mjs` with Node's built-in test runner. The tests execute the actual handlers with in-memory SDK records and provider stubs. They cover authorization, account mismatches, successful receipt persistence, lost responses before and after a simulated commit, malformed receipts, stale locks, validation-only immutability, and manual retry protection. Network access is forbidden in the harness.

The tests do not certify distributed claim safety, deployment packaging, current provider permissions, or live publishing. Those gates remain unknown or blocked as described above.

Rollback is a revert of this isolated source commit. No schema, schedule, provider credential, or runtime setting changes are part of the patch.
