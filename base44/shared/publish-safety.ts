// Shared server-side checks for the existing Auto Social publishing paths.
// These checks do not make Base44 update/get claims atomic or verify OAuth grants.

const UNCONFIRMED_PREFIX = 'PUBLISH_OUTCOME_UNCONFIRMED: ';

export function publishingAccountError(post, account) {
  if (!account || !post?.social_account_id || account.id !== post.social_account_id) {
    return 'The linked publishing account is no longer available.';
  }
  if (!post.business_id || account.business_id !== post.business_id) {
    return 'The publishing account belongs to a different business.';
  }
  if (!post.platform || account.platform !== post.platform) {
    return 'The publishing account belongs to a different platform.';
  }
  if (typeof account.external_id !== 'string' || !account.external_id.trim()) {
    return 'The publishing account has no provider account binding.';
  }
  if (account.status !== 'connected') {
    return 'The publishing account needs to be connected and verified again.';
  }
  return '';
}

export function unconfirmedPublishMessage(message) {
  return UNCONFIRMED_PREFIX + 'Check the provider for an existing post before retrying. ' + String(message || 'The provider outcome could not be confirmed.');
}

export function needsPublishReconciliation(post) {
  if (String(post?.publish_error || '').startsWith(UNCONFIRMED_PREFIX)) return true;
  const history = Array.isArray(post?.publish_history) ? post.publish_history : [];
  const last = [...history].reverse().find(item => ['outcome_unknown', 'outcome_reconciled'].includes(item?.event));
  return last?.event === 'outcome_unknown';
}
