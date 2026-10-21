/**
 * Fail-closed domain policy. Use at the server/worker boundary; never treat
 * client-side checks as authorization. This module makes NO network calls.
 * Each provider adapter must additionally verify real OAuth scopes and platform policy.
 */
export function decideSocialAction(ctx = {}) {
  const deny = (reason) => ({ decision: "deny", reason });
  const handoff = (reason) => ({ decision: "human_required", reason });
  const allow = (reason) => ({ decision: "allow", reason });
  if (!ctx.tenantId || !ctx.businessId) return deny("tenant_and_business_required");
  if (ctx.killSwitch === true) return deny("kill_switch_active");
  if (ctx.rateLimitOk !== true) return deny("rate_limit_not_verified");
  if (ctx.challengePresent === true) return handoff("platform_challenge_requires_human");
  if (ctx.usesEvasion === true || ctx.falseIdentity === true) return deny("evasion_or_false_identity");
  const kind = ctx.kind;
  if (kind === "browser.social.write") return deny("social_browser_mutation_not_permitted");
  if (kind === "account.create") return handoff("user_must_register_authentic_account");
  if (kind === "account.onboard.prepare") {
    if (ctx.channel !== "browser" || ctx.ownsBrand !== true || ctx.sitePolicyAllowed !== true) return deny("onboarding_not_authorized");
    if (ctx.humanPresent !== true) return handoff("account_onboarding_requires_human");
    return allow("assisted_onboarding_preparation_only");
  }
  if (kind === "account.connect") {
    if (ctx.channel !== "oauth" || ctx.ownsBrand !== true || ctx.ownerConsent !== true) return deny("verified_oauth_consent_required");
    return handoff("interactive_oauth_consent");
  }
  if (kind === "research.public") {
    if (!["browser", "api"].includes(ctx.channel) || ctx.sourcePermitted !== true || ctx.respectsSiteRestrictions !== true) return deny("public_research_source_not_authorized");
    return allow("permitted_public_research_only");
  }
  if (kind === "browser.qa.capture") {
    if (ctx.channel !== "browser" || ctx.sitePolicyAllowed !== true) return deny("browser_qa_not_authorized");
    return allow("visual_qa_only");
  }
  if (kind === "content.draft") return allow("draft_only_no_external_action");
  if (kind === "post.publish") {
    if (ctx.channel !== "api" || ctx.ownsBrand !== true || ctx.ownerConsent !== true || ctx.providerCapabilityApproved !== true || ctx.validGrant !== true) return deny("approved_provider_api_and_grant_required");
    if (ctx.publishAuthorized !== true || (ctx.requiresApproval === true && !ctx.approvalReceiptId)) return handoff("scoped_publish_approval_required");
    return allow("publish_to_owned_authorized_account");
  }
  if (kind === "engagement.reply") {
    if (ctx.channel !== "api" || ctx.ownsBrand !== true || ctx.ownerConsent !== true || ctx.providerCapabilityApproved !== true || ctx.validGrant !== true) return deny("approved_provider_api_and_grant_required");
    if (!["owned_post", "inbound_conversation"].includes(ctx.target)) return deny("only_owned_or_inbound_conversations");
    if (ctx.sensitive === true || ctx.autoReplyEnabled !== true || ctx.approvedTemplate !== true) return handoff("reply_needs_human_review");
    return allow("approved_low_risk_inbound_reply");
  }
  if (kind === "engagement.outbound") {
    if (ctx.channel !== "api" || ctx.validGrant !== true || ctx.recipientOptIn !== true) return deny("consent_and_authorized_api_required");
    return handoff("one_to_one_outbound_review_required");
  }
  return deny("unknown_action_fail_closed");
}
