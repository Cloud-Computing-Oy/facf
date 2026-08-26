import test from "node:test";
import assert from "node:assert/strict";
import { ProtocolValidationError, validateCapability, validateMeter, validateOffer, validateWorkload } from "../src/protocol/validate.js";
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

test("meter rejects content fields placed outside metadata", () => {
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
    outcome: "completed",
    metadata: { runtime: "simulator" }
  };
  assert.doesNotThrow(() => validateMeter(base));
  assert.throws(() => validateMeter({ ...base, prompt: "leaked workload input" }), /unknown field prompt/);
});

test("capability rejects undeclared top-level fields", () => {
  const base = {
    protocolVersion: "v0alpha1",
    providerId: "provider-1",
    capabilityId: "cap-1",
    models: ["qwen2.5:7b"],
    runtime: "simulator",
    region: "FI",
    trustTier: "community",
    slots: 1,
    expiresAt: "2099-01-01T00:00:00.000Z"
  };
  assert.doesNotThrow(() => validateCapability(base));
  assert.throws(() => validateCapability({ ...base, output: "leaked model output" }), /unknown field output/);
});
