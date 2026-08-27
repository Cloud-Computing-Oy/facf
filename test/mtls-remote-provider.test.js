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
