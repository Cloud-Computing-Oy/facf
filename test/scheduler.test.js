import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility, rankOffers } from "../src/core/scheduler.js";
import { fixedClock, offer, workload } from "../test-support/helpers.js";

test("mandatory scheduling policies reject incompatible offers", () => {
  const cases = [
    [offer({ models: ["other"] }), "model_not_available"],
    [offer({ region: "US" }), "region_not_allowed"],
    [offer({ trustTier: "community" }), "trust_tier_too_low", workload({ minimumTrustTier: "verified" })],
    [offer({ dataClasses: ["synthetic"] }), "data_class_not_allowed"],
    [offer({ priceEur: 0.06 }), "price_exceeds_budget"],
    [offer({ availableSlots: 0 }), "no_available_slots"],
    [offer({ expiresAt: "2020-01-01T00:00:00.000Z" }), "offer_expired"]
  ];
  for (const [candidate, reason, requested = workload()] of cases) {
    assert.ok(evaluateEligibility(requested, candidate, fixedClock()).reasons.includes(reason), reason);
  }
});

test("EU policy accepts EU regions and rejects non-EU regions", () => {
  const requested = workload({ allowedRegions: ["EU"] });
  assert.equal(evaluateEligibility(requested, offer({ region: "SE" }), fixedClock()).eligible, true);
  assert.equal(evaluateEligibility(requested, offer({ region: "US" }), fixedClock()).eligible, false);
  assert.equal(evaluateEligibility(workload({ allowedRegions: ["EU", "US"] }), offer({ region: "US" }), fixedClock()).eligible, true);
});

test("ranking is deterministic and uses provider identity as final tie-breaker", () => {
  const second = offer({ offerId: "offer-2", providerId: "provider-b" });
  const first = offer({ offerId: "offer-3", providerId: "provider-a" });
  const ranked = rankOffers(workload(), [second, first], fixedClock());
  assert.deepEqual(ranked.eligible.map((item) => item.offer.providerId), ["provider-a", "provider-b"]);
});
