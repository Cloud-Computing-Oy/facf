import assert from "node:assert/strict";
import test from "node:test";
import { MtlsRemoteProvider } from "../src/provider/mtls-remote-provider.js";
import { offer, workload } from "../test-support/helpers.js";

test("remote provider negotiates a bound grant before dispatch", async () => {
  const calls = [];
  const grant = { protocolVersion: "v0alpha1", grantId: "grant-1", token: "A".repeat(43), leaseId: "lease-1", workloadId: "workload-1", providerId: "provider-1", model: "qwen2.5:7b", scope: "execute:model", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:20.000Z" };
  const response = { result: { status: "completed" }, meter: { meterId: "meter-1" } };
  const controlServer = {
    async requestLease(providerId, request) { calls.push({ kind: "lease", providerId, request }); return grant; },
    async requestExecution(providerId, request) { calls.push({ kind: "execution", providerId, request }); return response; }
  };
  const provider = new MtlsRemoteProvider({ offer: offer(), controlServer, clock: () => new Date("2026-08-26T08:00:00.000Z") });
  const lease = { protocolVersion: "v0alpha1", leaseId: "lease-1", workloadId: "workload-1", offerId: "offer-1", providerId: "provider-1", state: "running", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:30.000Z", attempt: 1 };
  assert.equal(await provider.execute({ workload: workload(), lease }), response);
  assert.equal(provider.executionTimeoutManaged, true);
  assert.equal(calls[0].kind, "lease");
  assert.equal(calls[1].request.grant.token, grant.token);
  assert.equal(calls[1].request.executionId, lease.leaseId);
});

test("remote provider applies one workload deadline across negotiation and execution", async () => {
  let nowMs = Date.parse("2026-08-26T08:00:00.000Z");
  const timeouts = [];
  const grant = { protocolVersion: "v0alpha1", grantId: "grant-1", token: "A".repeat(43), leaseId: "lease-1", workloadId: "workload-1", providerId: "provider-1", model: "qwen2.5:7b", scope: "execute:model", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:20.000Z" };
  const controlServer = {
    async requestLease(_providerId, _request, options) { timeouts.push(options.timeoutMs); nowMs += 75; return grant; },
    async requestExecution(_providerId, _request, options) { timeouts.push(options.timeoutMs); return { result: {}, meter: {} }; }
  };
  const provider = new MtlsRemoteProvider({ offer: offer(), controlServer, clock: () => new Date(nowMs), leaseTimeoutMs: 5000 });
  const lease = { protocolVersion: "v0alpha1", leaseId: "lease-1", workloadId: "workload-1", offerId: "offer-1", providerId: "provider-1", state: "running", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:30.000Z", attempt: 1 };
  await provider.execute({ workload: { ...workload(), timeoutMs: 100 }, lease });
  assert.deepEqual(timeouts, [100, 25]);
});

test("remote provider does not dispatch after negotiation consumes the workload deadline", async () => {
  let nowMs = Date.parse("2026-08-26T08:00:00.000Z");
  let dispatched = false;
  const grant = { protocolVersion: "v0alpha1", grantId: "grant-1", token: "A".repeat(43), leaseId: "lease-1", workloadId: "workload-1", providerId: "provider-1", model: "qwen2.5:7b", scope: "execute:model", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:20.000Z" };
  const controlServer = {
    async requestLease() { nowMs += 100; return grant; },
    async requestExecution() { dispatched = true; }
  };
  const provider = new MtlsRemoteProvider({ offer: offer(), controlServer, clock: () => new Date(nowMs) });
  const lease = { protocolVersion: "v0alpha1", leaseId: "lease-1", workloadId: "workload-1", offerId: "offer-1", providerId: "provider-1", state: "running", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:30.000Z", attempt: 1 };
  await assert.rejects(provider.execute({ workload: { ...workload(), timeoutMs: 100 }, lease }), (error) => error.code === "execution_timeout");
  assert.equal(dispatched, false);
});
