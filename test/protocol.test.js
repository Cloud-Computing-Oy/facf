import test from "node:test";
import assert from "node:assert/strict";
import { ProtocolValidationError, validateMeter, validateOffer, validateWorkload } from "../src/protocol/validate.js";
import { offer, workload } from "../test-support/helpers.js";

test("valid workload and offer fixtures pass semantic validation", () => {
  assert.equal(validateWorkload(workload()).workloadId, "workload-1");
  assert.equal(validateOffer(offer()).offerId, "offer-1");
});

test("workload fails closed when tenant identity is missing", () => {
  assert.throws(() => validateWorkload(workload({ tenantId: "" })), ProtocolValidationError);
});

test("negative provider price is rejected", () => {
  assert.throws(() => validateOffer(offer({ priceEur: -1 })), /priceEur/);
});

test("meter metadata cannot contain prompt or output content", () => {
  const base = {
    protocolVersion: "v0alpha1",
    meterId: "meter-1",
    workloadId: "workload-1",
    leaseId: "lease-1",
    providerId: "provider-1",
    startedAt: "2026-08-26T08:00:00.000Z",
    completedAt: "2026-08-26T08:00:01.000Z",
    durationMs: 1000,
    inputTokens: 2,
    outputTokens: 3,
    priceEur: 0.01,
    outcome: "completed"
  };
  assert.doesNotThrow(() => validateMeter({ ...base, metadata: { runtime: "simulator", model: "test" } }));
  assert.throws(() => validateMeter({ ...base, metadata: { nested: { prompt: "secret" } } }), /workload content/);
});
