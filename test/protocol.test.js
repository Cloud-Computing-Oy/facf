import test from "node:test";
import assert from "node:assert/strict";
import { ProtocolValidationError, validateCapability, validateExecutionRequest, validateMeter, validateOffer, validateResult, validateWorkload } from "../src/protocol/validate.js";
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

test("execution request binds grant, lease, workload, and public data policy", () => {
  const lease = {
    protocolVersion: "v0alpha1", leaseId: "lease-1", workloadId: "workload-1", offerId: "offer-1",
    providerId: "provider-1", state: "running", issuedAt: "2026-08-26T08:00:00.000Z",
    expiresAt: "2026-08-26T08:00:30.000Z", attempt: 1
  };
  const grant = {
    protocolVersion: "v0alpha1", grantId: "grant-1", token: "A".repeat(43), leaseId: "lease-1",
    workloadId: "workload-1", providerId: "provider-1", model: "qwen2.5:7b", scope: "execute:model",
    issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:20.000Z"
  };
  const value = { protocolVersion: "v0alpha1", executionId: "lease-1", grant, lease, workload: workload() };
  assert.doesNotThrow(() => validateExecutionRequest(value));
  assert.throws(() => validateExecutionRequest({ ...value, workload: workload({ dataClass: "internal" }) }), /only public or synthetic/);
  assert.throws(() => validateExecutionRequest({ ...value, grant: { ...grant, workloadId: "other" } }), /same workload/);
  assert.throws(() => validateExecutionRequest({ ...value, lease: { ...lease, state: "accepted" } }), /must be running/);
  assert.throws(() => validateExecutionRequest({ ...value, prompt: "undeclared" }), /unknown field prompt/);
});

test("result validation is closed and requires a code for failures", () => {
  const result = {
    protocolVersion: "v0alpha1", workloadId: "workload-1", leaseId: "lease-1", providerId: "provider-1",
    status: "completed", output: { text: "ok" }, completedAt: "2026-08-26T08:00:01.000Z"
  };
  assert.doesNotThrow(() => validateResult(result));
  assert.throws(() => validateResult({ ...result, status: "failed" }), /requires errorCode/);
  assert.throws(() => validateResult({ ...result, prompt: "leak" }), /unknown field prompt/);
});
