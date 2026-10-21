import test from "node:test";
import assert from "node:assert/strict";
import { decideSocialAction } from "../src/lib/socialActionPolicy.mjs";
const base = { tenantId: "tenant-1", businessId: "business-1", rateLimitOk: true };
const cases = [
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "content.draft"
    },
    "allow",
    "draft"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "browser.social.write",
      "channel": "browser"
    },
    "deny",
    "browser social mutation"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "account.create"
    },
    "human_required",
    "account registration"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "account.onboard.prepare",
      "channel": "browser",
      "ownsBrand": true,
      "sitePolicyAllowed": true
    },
    "human_required",
    "onboarding without human"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "account.onboard.prepare",
      "channel": "browser",
      "ownsBrand": true,
      "sitePolicyAllowed": true,
      "humanPresent": true
    },
    "allow",
    "assisted preparation"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "research.public",
      "channel": "browser",
      "sourcePermitted": true,
      "respectsSiteRestrictions": true
    },
    "allow",
    "permitted research"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "research.public",
      "channel": "browser",
      "sourcePermitted": false,
      "respectsSiteRestrictions": true
    },
    "deny",
    "unlicensed research"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "post.publish",
      "channel": "api",
      "ownsBrand": true,
      "ownerConsent": true,
      "providerCapabilityApproved": true,
      "validGrant": true
    },
    "human_required",
    "publish approval missing"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "post.publish",
      "channel": "api",
      "ownsBrand": true,
      "ownerConsent": true,
      "providerCapabilityApproved": true,
      "validGrant": true,
      "publishAuthorized": true
    },
    "allow",
    "approved publishing"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "engagement.reply",
      "channel": "api",
      "ownsBrand": true,
      "ownerConsent": true,
      "providerCapabilityApproved": true,
      "validGrant": true,
      "target": "inbound_conversation",
      "autoReplyEnabled": true,
      "approvedTemplate": true
    },
    "allow",
    "approved inbound reply"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "engagement.reply",
      "channel": "api",
      "ownsBrand": true,
      "ownerConsent": true,
      "providerCapabilityApproved": true,
      "validGrant": true,
      "target": "stranger_post",
      "autoReplyEnabled": true,
      "approvedTemplate": true
    },
    "deny",
    "third-party engagement"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "engagement.reply",
      "channel": "api",
      "ownsBrand": true,
      "ownerConsent": true,
      "providerCapabilityApproved": true,
      "validGrant": true,
      "target": "owned_post",
      "autoReplyEnabled": true,
      "approvedTemplate": true,
      "sensitive": true
    },
    "human_required",
    "sensitive reply"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "engagement.outbound",
      "channel": "api",
      "validGrant": true,
      "recipientOptIn": true
    },
    "human_required",
    "opt-in outbound still reviewed"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "engagement.outbound",
      "channel": "api",
      "validGrant": true,
      "recipientOptIn": false
    },
    "deny",
    "unsolicited outreach"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "content.draft",
      "usesEvasion": true
    },
    "deny",
    "evasion flag"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "post.publish",
      "channel": "browser",
      "validGrant": true,
      "ownsBrand": true,
      "ownerConsent": true,
      "providerCapabilityApproved": true,
      "publishAuthorized": true
    },
    "deny",
    "no browser publishing"
  ],
  [
    {
      "kind": "content.draft",
      "rateLimitOk": true
    },
    "deny",
    "tenant isolation"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "content.draft",
      "killSwitch": true
    },
    "deny",
    "kill switch"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "content.draft",
      "challengePresent": true
    },
    "human_required",
    "challenge stops automation"
  ],
  [
    {
      "tenantId": "tenant-1",
      "businessId": "business-1",
      "rateLimitOk": true,
      "kind": "unexpected.action"
    },
    "deny",
    "fail closed"
  ]
];
for (const [input, expected, label] of cases) {
  test(label, () => {
    assert.equal(decideSocialAction(input).decision, expected);
  });
}
