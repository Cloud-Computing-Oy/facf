import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";
import test from "node:test";
import { connectControlAgent, createMtlsControlServer } from "../src/control/mtls-control.js";
import { ProviderRegistry } from "../src/control/provider-registry.js";
import { AgentLeaseAuthority } from "../src/control/agent-lease-authority.js";
import { Broker } from "../src/core/broker.js";
import { LeaseStore } from "../src/core/lease-store.js";
import { MtlsRemoteProvider } from "../src/provider/mtls-remote-provider.js";
import { offer as makeOffer, workload as makeWorkload } from "../test-support/helpers.js";

test("outbound mTLS agent heartbeat is authenticated and enrolled", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const address = server.address();
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const socket = connectControlAgent({ host: "127.0.0.1", port: address.port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, heartbeatMs: 10000, idFactory: () => "message-1" });
  t.after(() => socket.destroy());
  const reply = await nextLine(socket);
  assert.deepEqual(reply, { protocolVersion: "v0alpha1", type: "ack", messageId: "message-1" });
  assert.equal(registry.getActive()[0].capability.providerId, "provider-1");
});

test("CA-valid agent still fails closed when it is not enrolled", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-2", capabilityId: "cap-2", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const socket = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-2", capability, heartbeatMs: 10000 });
  t.after(() => socket.destroy());
  const reply = await nextLine(socket);
  assert.equal(reply.type, "error");
  assert.equal(reply.code, "agent_not_enrolled");
  assert.deepEqual(registry.getActive(), []);
});

test("broker negotiates a bound grant over the enrolled mTLS connection", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const leaseAuthority = new AgentLeaseAuthority({ providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"] });
  const socket = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, leaseAuthority, heartbeatMs: 10000 });
  t.after(() => socket.destroy());
  await nextLine(socket);
  const issuedAt = new Date();
  const leaseRequest = { protocolVersion: "v0alpha1", leaseId: "lease-remote-1", workloadId: "work-public-1", providerId: "provider-1", capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + 20000).toISOString() };
  const grant = await server.requestLease("provider-1", leaseRequest, { timeoutMs: 2000, idFactory: () => "lease-message-1" });
  assert.equal(grant.leaseId, "lease-remote-1");
  assert.equal(grant.scope, "execute:model");
  assert.equal(leaseAuthority.authorize({ leaseId: grant.leaseId, token: grant.token, model: grant.model }), true);
  await assert.rejects(server.requestLease("provider-1", { ...leaseRequest, leaseId: "lease-remote-2", workloadId: "work-public-2" }, { timeoutMs: 2000 }), (error) => error.code === "capacity_unavailable");
});

test("broker dispatches one idempotent lease-bound execution over mTLS", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const leaseAuthority = new AgentLeaseAuthority({ providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"] });
  let executions = 0;
  const executor = { async execute({ workload, lease }) {
    executions += 1;
    if (workload.input.messages[0].content === "runtime-timeout") throw Object.assign(new Error("runtime outcome unknown"), { code: "runtime_timeout" });
    const completedAt = new Date().toISOString();
    const text = workload.input.messages[0].content === "large-output" ? "x".repeat(4096) : "remote ok";
    const output = workload.input.messages[0].content === "invalid-terminal" ? null : { text };
    return {
      result: { protocolVersion: "v0alpha1", workloadId: workload.workloadId, leaseId: lease.leaseId, providerId: lease.providerId, status: "completed", output, completedAt },
      meter: { protocolVersion: "v0alpha1", meterId: "meter-remote-1", workloadId: workload.workloadId, leaseId: lease.leaseId, providerId: lease.providerId, startedAt: completedAt, completedAt, durationMs: 0, inputTokens: 2, outputTokens: 2, priceEur: 0, outcome: "completed", metadata: { runtime: "ollama" } }
    };
  } };
  const socket = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, leaseAuthority, executor, heartbeatMs: 10000, maxMessageBytes: 2048 });
  t.after(() => socket.destroy());
  await nextLine(socket);
  const issuedAt = new Date();
  const lease = { protocolVersion: "v0alpha1", leaseId: "lease-remote-1", workloadId: "work-remote-1", offerId: "offer-1", providerId: "provider-1", state: "running", issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + 20000).toISOString(), attempt: 1 };
  const grant = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: lease.leaseId, workloadId: lease.workloadId, providerId: lease.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: lease.issuedAt, expiresAt: lease.expiresAt });
  const workload = { protocolVersion: "v0alpha1", workloadId: lease.workloadId, tenantId: "tenant-1", model: "qwen2.5:7b", dataClass: "synthetic", minimumTrustTier: "community", allowedRegions: ["FI"], maximumPriceEur: 0, timeoutMs: 2000, input: { messages: [{ role: "user", content: "synthetic" }] } };
  const request = { protocolVersion: "v0alpha1", executionId: lease.leaseId, grant, lease, workload };
  const first = await server.requestExecution("provider-1", request, { timeoutMs: 2000 });
  const second = await server.requestExecution("provider-1", request, { timeoutMs: 2000 });
  const reordered = await server.requestExecution("provider-1", reverseObjectOrder(request), { timeoutMs: 2000 });
  assert.equal(first.result.output.text, "remote ok");
  assert.equal(second.result.output.text, "remote ok");
  assert.equal(reordered.result.output.text, "remote ok");
  assert.equal(first.meter.leaseId, lease.leaseId);
  assert.equal(executions, 1);
  await assert.rejects(server.requestExecution("provider-1", { ...request, workload: { ...workload, input: { messages: [{ role: "user", content: "changed" }] } } }, { timeoutMs: 2000 }), (error) => error.code === "idempotency_conflict");
  await assert.rejects(server.requestExecution("provider-1", { ...request, workload: { ...workload, input: { messages: [{ role: "user", content: "x".repeat(300000) }] } } }, { timeoutMs: 2000 }), (error) => error.code === "control_message_too_large");
  const lease2 = { ...lease, leaseId: "lease-remote-2", workloadId: "work-remote-2" };
  const grant2 = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: lease2.leaseId, workloadId: lease2.workloadId, providerId: lease2.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: lease2.issuedAt, expiresAt: lease2.expiresAt });
  const workload2 = { ...workload, workloadId: lease2.workloadId, input: { messages: [{ role: "user", content: "large-output" }] } };
  await assert.rejects(server.requestExecution("provider-1", { protocolVersion: "v0alpha1", executionId: lease2.leaseId, grant: grant2, lease: lease2, workload: workload2 }, { timeoutMs: 2000 }), (error) => error.code === "execution_result_too_large" && error.noFallback === true);
  const lease3 = { ...lease, leaseId: "lease-remote-3", workloadId: "work-remote-3" };
  const grant3 = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: lease3.leaseId, workloadId: lease3.workloadId, providerId: lease3.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: lease3.issuedAt, expiresAt: lease3.expiresAt });
  const workload3 = { ...workload, workloadId: lease3.workloadId, input: { messages: [{ role: "user", content: "runtime-timeout" }] } };
  await assert.rejects(server.requestExecution("provider-1", { protocolVersion: "v0alpha1", executionId: lease3.leaseId, grant: grant3, lease: lease3, workload: workload3 }, { timeoutMs: 2000 }), (error) => error.code === "runtime_timeout" && error.noFallback === true);
  const invalidLease = { ...lease, leaseId: "lease-invalid-terminal", workloadId: "work-invalid-terminal" };
  const invalidGrant = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: invalidLease.leaseId, workloadId: invalidLease.workloadId, providerId: invalidLease.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: invalidLease.issuedAt, expiresAt: invalidLease.expiresAt });
  const invalidWorkload = { ...workload, workloadId: invalidLease.workloadId, input: { messages: [{ role: "user", content: "invalid-terminal" }] } };
  await assert.rejects(server.requestExecution("provider-1", { protocolVersion: "v0alpha1", executionId: invalidLease.leaseId, grant: invalidGrant, lease: invalidLease, workload: invalidWorkload }, { timeoutMs: 2000 }), (error) => error.code === "invalid_terminal_evidence" && error.noFallback === true);
  const lease4 = { ...lease, leaseId: "lease-remote-4", workloadId: "work-remote-4" };
  const grant4 = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: lease4.leaseId, workloadId: lease4.workloadId, providerId: lease4.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: lease4.issuedAt, expiresAt: lease4.expiresAt });
  const changedWorkloadId = "work-not-authorized";
  const forgedRequest = {
    protocolVersion: "v0alpha1",
    executionId: lease4.leaseId,
    grant: { ...grant4, workloadId: changedWorkloadId },
    lease: { ...lease4, workloadId: changedWorkloadId },
    workload: { ...workload, workloadId: changedWorkloadId }
  };
  await assert.rejects(server.requestExecution("provider-1", forgedRequest, { timeoutMs: 2000 }), (error) => error.code === "grant_unauthorized" && error.noFallback === false);
});

test("execution timeout after dispatch is an unknown no-fallback outcome", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry, maxPendingRequests: 1 });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const leaseAuthority = new AgentLeaseAuthority({ providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"] });
  const executor = { execute: ({ workload, lease }) => new Promise((resolve) => setTimeout(() => {
    const completedAt = new Date().toISOString();
    resolve({
      result: { protocolVersion: "v0alpha1", workloadId: workload.workloadId, leaseId: lease.leaseId, providerId: lease.providerId, status: "completed", output: { text: "late" }, completedAt },
      meter: { protocolVersion: "v0alpha1", meterId: "meter-late", workloadId: workload.workloadId, leaseId: lease.leaseId, providerId: lease.providerId, startedAt: completedAt, completedAt, durationMs: 0, inputTokens: 1, outputTokens: 1, priceEur: 0, outcome: "completed", metadata: { runtime: "ollama" } }
    });
  }, 40)) };
  const socket = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, leaseAuthority, executor, heartbeatMs: 10000 });
  t.after(() => socket.destroy());
  await nextLine(socket);
  const issuedAt = new Date();
  const lease = { protocolVersion: "v0alpha1", leaseId: "lease-timeout", workloadId: "work-timeout", offerId: "offer-1", providerId: "provider-1", state: "running", issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + 20000).toISOString(), attempt: 1 };
  const grant = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: lease.leaseId, workloadId: lease.workloadId, providerId: lease.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: lease.issuedAt, expiresAt: lease.expiresAt });
  const workload = { protocolVersion: "v0alpha1", workloadId: lease.workloadId, tenantId: "tenant-1", model: "qwen2.5:7b", dataClass: "synthetic", minimumTrustTier: "community", allowedRegions: ["FI"], maximumPriceEur: 0, timeoutMs: 100, input: { messages: [{ role: "user", content: "synthetic" }] } };
  const dispatched = server.requestExecution("provider-1", { protocolVersion: "v0alpha1", executionId: lease.leaseId, grant, lease, workload }, { timeoutMs: 20 });
  await assert.rejects(server.requestExecution("provider-1", { protocolVersion: "v0alpha1", executionId: lease.leaseId, grant, lease, workload }, { timeoutMs: 20 }), (error) => error.code === "control_capacity_exceeded" && error.noFallback === false);
  await assert.rejects(dispatched, (error) => error.code === "execution_outcome_unknown" && error.noFallback === true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  const nextLease = { ...lease, leaseId: "lease-after-late-result", workloadId: "work-after-late-result", issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 20000).toISOString() };
  const nextGrant = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: nextLease.leaseId, workloadId: nextLease.workloadId, providerId: nextLease.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: nextLease.issuedAt, expiresAt: nextLease.expiresAt });
  assert.equal(nextGrant.leaseId, nextLease.leaseId);
});

test("broker falls through one enrolled cell before completing on a second mTLS cell", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [
    { agentId: "agent-1", providerId: "provider-1" },
    { agentId: "agent-2", providerId: "provider-2" }
  ] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const now = new Date();
  const capability1 = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: now.toISOString() };
  const capability2 = { ...capability1, providerId: "provider-2", capabilityId: "cap-2" };
  const authority1 = new AgentLeaseAuthority({ providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"] });
  authority1.request({ protocolVersion: "v0alpha1", leaseId: "occupied", workloadId: "occupied", providerId: "provider-1", capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 20000).toISOString() });
  const authority2 = new AgentLeaseAuthority({ providerId: "provider-2", capabilityId: "cap-2", models: ["qwen2.5:7b"] });
  let firstExecutions = 0;
  let secondExecutions = 0;
  const executor = (counter, providerId) => ({ async execute({ workload, lease }) {
    counter();
    const completedAt = new Date().toISOString();
    return {
      result: { protocolVersion: "v0alpha1", workloadId: workload.workloadId, leaseId: lease.leaseId, providerId, status: "completed", output: { text: `${providerId} ok` }, completedAt },
      meter: { protocolVersion: "v0alpha1", meterId: `meter-${providerId}`, workloadId: workload.workloadId, leaseId: lease.leaseId, providerId, startedAt: completedAt, completedAt, durationMs: 0, inputTokens: 1, outputTokens: 1, priceEur: 0, outcome: "completed", metadata: { runtime: "ollama" } }
    };
  } });
  const socket1 = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability: capability1, leaseAuthority: authority1, executor: executor(() => { firstExecutions += 1; }, "provider-1"), heartbeatMs: 10000 });
  const socket2 = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.client2Key, cert: certificates.client2Cert, ca: certificates.ca, agentId: "agent-2", capability: capability2, leaseAuthority: authority2, executor: executor(() => { secondExecutions += 1; }, "provider-2"), heartbeatMs: 10000 });
  t.after(() => { socket1.destroy(); socket2.destroy(); });
  await Promise.all([nextLine(socket1), nextLine(socket2)]);
  const offer1 = makeOffer({ providerId: "provider-1", capabilityId: "cap-1", offerId: "offer-1", qualityScore: 1 });
  const offer2 = makeOffer({ providerId: "provider-2", capabilityId: "cap-2", offerId: "offer-2", qualityScore: 0.8 });
  const remote1 = new MtlsRemoteProvider({ offer: offer1, controlServer: server });
  const remote2 = new MtlsRemoteProvider({ offer: offer2, controlServer: server });
  const broker = new Broker({ leaseStore: new LeaseStore({ ttlMs: 5000 }), maxAttempts: 2 });
  const execution = await broker.run(makeWorkload({ timeoutMs: 2000 }), [offer1, offer2], new Map([["provider-1", remote1], ["provider-2", remote2]]));
  assert.equal(execution.providerId, "provider-2");
  assert.equal(execution.result.output.text, "provider-2 ok");
  assert.equal(firstExecutions, 0);
  assert.equal(secondExecutions, 1);
});

test("closing a replaced provider socket does not reject work sent on the replacement", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const oldSocket = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, heartbeatMs: 10000 });
  await nextLine(oldSocket);
  const leaseAuthority = new AgentLeaseAuthority({ providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"] });
  let finishExecution;
  const executor = { execute: () => new Promise((resolve) => { finishExecution = resolve; }) };
  const newSocket = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, leaseAuthority, executor, heartbeatMs: 10000 });
  t.after(() => { oldSocket.destroy(); newSocket.destroy(); });
  await nextLine(newSocket);
  const issuedAt = new Date();
  const lease = { protocolVersion: "v0alpha1", leaseId: "lease-reconnect", workloadId: "work-reconnect", offerId: "offer-1", providerId: "provider-1", state: "running", issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + 20000).toISOString(), attempt: 1 };
  const grant = await server.requestLease("provider-1", { protocolVersion: "v0alpha1", leaseId: lease.leaseId, workloadId: lease.workloadId, providerId: lease.providerId, capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: lease.issuedAt, expiresAt: lease.expiresAt });
  const workload = { protocolVersion: "v0alpha1", workloadId: lease.workloadId, tenantId: "tenant-1", model: "qwen2.5:7b", dataClass: "synthetic", minimumTrustTier: "community", allowedRegions: ["FI"], maximumPriceEur: 0, timeoutMs: 2000, input: { messages: [{ role: "user", content: "synthetic" }] } };
  const pending = server.requestExecution("provider-1", { protocolVersion: "v0alpha1", executionId: lease.leaseId, grant, lease, workload }, { timeoutMs: 2000 });
  for (let attempt = 0; attempt < 100 && !finishExecution; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(typeof finishExecution, "function");
  oldSocket.destroy();
  const completedAt = new Date().toISOString();
  finishExecution({
    result: { protocolVersion: "v0alpha1", workloadId: workload.workloadId, leaseId: lease.leaseId, providerId: lease.providerId, status: "completed", output: { text: "replacement ok" }, completedAt },
    meter: { protocolVersion: "v0alpha1", meterId: "meter-reconnect", workloadId: workload.workloadId, leaseId: lease.leaseId, providerId: lease.providerId, startedAt: completedAt, completedAt, durationMs: 0, inputTokens: 1, outputTokens: 1, priceEur: 0, outcome: "completed", metadata: { runtime: "ollama" } }
  });
  assert.equal((await pending).result.output.text, "replacement ok");
});

test("broker refuses a lease for an inactive provider", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  const issuedAt = new Date();
  const request = { protocolVersion: "v0alpha1", leaseId: "lease-1", workloadId: "work-1", providerId: "provider-1", capabilityId: "cap-1", model: "qwen2.5:7b", issuedAt: issuedAt.toISOString(), expiresAt: new Date(issuedAt.getTime() + 20000).toISOString() };
  await assert.rejects(server.requestLease("provider-1", request), (error) => error.code === "provider_inactive");
});

test("an oversized control message closes the connection without crashing the server", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const events = [];
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry, maxMessageBytes: 1024, logger: (event) => events.push(event) });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const socket = tls.connect({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, rejectUnauthorized: true, minVersion: "TLSv1.3" });
  t.after(() => socket.destroy());
  await new Promise((resolve, reject) => { socket.once("secureConnect", resolve); socket.once("error", reject); });
  socket.write("x".repeat(2048));
  await new Promise((resolve) => socket.once("close", resolve));
  assert.ok(events.some((event) => event.event === "control_socket_error"));
});

test("a malformed message from the broker does not crash the connecting agent", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const rawServer = tls.createServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.3" }, (socket) => {
    socket.on("secureConnect", () => {});
    socket.write("not json\n");
  });
  await new Promise((resolve, reject) => { rawServer.once("error", reject); rawServer.listen(0, "127.0.0.1", resolve); });
  t.after(() => rawServer.close());
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const events = [];
  const socket = connectControlAgent({ host: "127.0.0.1", port: rawServer.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, heartbeatMs: 10000, logger: (event) => events.push(event) });
  t.after(() => socket.destroy());
  await new Promise((resolve) => socket.once("close", resolve));
  assert.ok(events.some((event) => event.event === "control_socket_error"));
});

function nextLine(socket) {
  return new Promise((resolve, reject) => {
    let data = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      data += chunk;
      const newline = data.indexOf("\n");
      if (newline >= 0) resolve(JSON.parse(data.slice(0, newline)));
    });
    socket.once("error", reject);
  });
}

function reverseObjectOrder(value) {
  if (Array.isArray(value)) return value.map(reverseObjectOrder);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).reverse().map((key) => [key, reverseObjectOrder(value[key])]));
}

function testCertificates() {
  const root = mkdtempSync(join(tmpdir(), "facf-mtls-"));
  const path = (name) => join(root, name);
  run(root, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.crt", "-subj", "/CN=FACF Test CA", "-days", "1"]);
  run(root, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "server.key", "-out", "server.csr", "-subj", "/CN=broker.test"]);
  writeFileSync(path("server.ext"), "subjectAltName=DNS:broker.test\nextendedKeyUsage=serverAuth\n");
  run(root, ["x509", "-req", "-in", "server.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "server.crt", "-days", "1", "-extfile", "server.ext"]);
  run(root, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "client.key", "-out", "client.csr", "-subj", "/CN=agent-1"]);
  writeFileSync(path("client.ext"), "extendedKeyUsage=clientAuth\n");
  run(root, ["x509", "-req", "-in", "client.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "client.crt", "-days", "1", "-extfile", "client.ext"]);
  run(root, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "client2.key", "-out", "client2.csr", "-subj", "/CN=agent-2"]);
  run(root, ["x509", "-req", "-in", "client2.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "client2.crt", "-days", "1", "-extfile", "client.ext"]);
  return { root, ca: readFileSync(path("ca.crt")), serverKey: readFileSync(path("server.key")), serverCert: readFileSync(path("server.crt")), clientKey: readFileSync(path("client.key")), clientCert: readFileSync(path("client.crt")), client2Key: readFileSync(path("client2.key")), client2Cert: readFileSync(path("client2.crt")) };
}

function run(cwd, args) {
  execFileSync("openssl", args, { cwd, stdio: "ignore" });
}
