import test from "node:test";
import assert from "node:assert/strict";
import { Broker, NoEligibleProviderError } from "../src/core/broker.js";
import { LeaseStore } from "../src/core/lease-store.js";
import { SimulatedProvider } from "../src/provider/simulator.js";
import { fixedClock, offer, workload } from "../test-support/helpers.js";

function ids() {
  let id = 0;
  return () => `id-${++id}`;
}

test("broker executes a whole workload and completes the lease", async () => {
  const idFactory = ids();
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  assert.equal(execution.lease.state, "completed");
  assert.equal(execution.meter.metadata.runtime, "simulator");
  assert.equal(JSON.stringify(execution.meter).includes("hello"), false);
});

test("broker retries another eligible provider after execution failure", async () => {
  const idFactory = ids();
  const firstOffer = offer({ offerId: "offer-a", providerId: "provider-a", qualityScore: 1 });
  const secondOffer = offer({ offerId: "offer-b", providerId: "provider-b", qualityScore: 0.8 });
  const first = new SimulatedProvider({ offer: firstOffer, failureCode: "runtime_unreachable", clock: fixedClock, idFactory });
  const second = new SimulatedProvider({ offer: secondOffer, responseText: "second provider", clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory });
  const execution = await broker.run(workload(), [first.advertise(), second.advertise()], new Map([["provider-a", first], ["provider-b", second]]));
  assert.equal(execution.providerId, "provider-b");
  assert.equal(execution.result.output.text, "second provider");
});

test("broker preserves one workload deadline across provider attempts", async () => {
  const idFactory = ids();
  let nowMs = fixedClock().getTime();
  let secondCalls = 0;
  const clock = () => new Date(nowMs);
  const firstOffer = offer({ offerId: "offer-a", providerId: "provider-a", qualityScore: 1 });
  const secondOffer = offer({ offerId: "offer-b", providerId: "provider-b", qualityScore: 0.8 });
  const first = { async execute() { nowMs += 100; throw Object.assign(new Error("safe rejection"), { code: "capacity_unavailable" }); } };
  const second = { async execute() { secondCalls += 1; return {}; } };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock, idFactory }), clock, idFactory });
  await assert.rejects(
    broker.run({ ...workload(), timeoutMs: 100 }, [firstOffer, secondOffer], new Map([["provider-a", first], ["provider-b", second]])),
    (error) => error instanceof NoEligibleProviderError && error.rejected.some((entry) => entry.code === "execution_timeout")
  );
  assert.equal(secondCalls, 0);
});

test("broker uses bounded cloud fallback and emits fallback meter", async () => {
  const idFactory = ids();
  const provider = new SimulatedProvider({ offer: offer(), failureCode: "runtime_unreachable", clock: fixedClock, idFactory });
  const fallback = { providerId: "cloud", capability: { region: "FI", trustTier: "community", dataClasses: ["public"] }, async execute() { return { text: "cloud result", usage: { inputTokens: 1, outputTokens: 2 }, priceEur: 0.02 }; } };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "fallback");
  assert.equal(execution.meter.outcome, "fallback");
  assert.deepEqual(execution.failures, [{ providerId: "provider-1", code: "runtime_unreachable" }]);
});

test("broker fails closed when no eligible provider or fallback exists", async () => {
  const idFactory = ids();
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory });
  await assert.rejects(() => broker.run(workload(), [offer({ models: ["other"] })], new Map()), NoEligibleProviderError);
});

test("fallback cannot exceed the workload price ceiling", async () => {
  const idFactory = ids();
  const fallback = { providerId: "cloud", capability: { region: "FI", trustTier: "community", dataClasses: ["public"] }, async execute() { return { text: "expensive", usage: {}, priceEur: 1 }; } };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory });
  await assert.rejects(() => broker.run(workload(), [], new Map()), (error) => {
    assert.ok(error instanceof NoEligibleProviderError);
    assert.equal(error.rejected.at(-1).code, "fallback_price_not_allowed");
    return true;
  });
});

test("broker requires fallback capability metadata to authorize fallback routing", () => {
  const idFactory = ids();
  const fallback = { providerId: "cloud", async execute() { return { text: "unchecked", usage: {}, priceEur: 0.01 }; } };
  assert.throws(() => new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory }), TypeError);
});

test("broker rejects a fallback with a non-finite declared price ceiling", () => {
  const idFactory = ids();
  const fallback = { providerId: "cloud", capability: { region: "FI", trustTier: "community", dataClasses: ["public"], maxPriceEur: Number.NaN }, async execute() { return { text: "unchecked", usage: {}, priceEur: 0.01 }; } };
  assert.throws(() => new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory }), TypeError);
});

test("broker rejects a fallback that fails workload policy without ever invoking execute", async () => {
  const idFactory = ids();
  let executed = false;
  const fallback = {
    providerId: "cloud",
    capability: { region: "FI", trustTier: "community", dataClasses: ["confidential"] },
    async execute() { executed = true; return { text: "should not run", usage: {}, priceEur: 0.01 }; }
  };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory });
  await assert.rejects(() => broker.run(workload(), [], new Map()), (error) => {
    assert.ok(error instanceof NoEligibleProviderError);
    assert.equal(error.rejected.at(-1).code, "fallback_data_class_not_allowed");
    return true;
  });
  assert.equal(executed, false);
});

test("broker rejects a fallback whose declared price ceiling exceeds the workload budget without invoking execute", async () => {
  const idFactory = ids();
  let executed = false;
  const fallback = {
    providerId: "cloud",
    capability: { region: "FI", trustTier: "community", dataClasses: ["public"], maxPriceEur: 1 },
    async execute() { executed = true; return { text: "should not run", usage: {}, priceEur: 0.01 }; }
  };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory });
  await assert.rejects(() => broker.run(workload(), [], new Map()), (error) => {
    assert.ok(error instanceof NoEligibleProviderError);
    assert.equal(error.rejected.at(-1).code, "fallback_price_not_allowed");
    return true;
  });
  assert.equal(executed, false);
});

test("broker enforces the workload timeout against a hung provider", async () => {
  const idFactory = ids();
  const provider = { execute: () => new Promise(() => {}) };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, maxAttempts: 1 });
  await assert.rejects(() => broker.run(workload({ timeoutMs: 100 }), [offer()], new Map([["provider-1", provider]])), (error) => {
    assert.ok(error instanceof NoEligibleProviderError);
    assert.equal(error.rejected.at(-1).code, "execution_timeout");
    return true;
  });
});

test("broker enforces the workload timeout against a hung fallback", async () => {
  const idFactory = ids();
  const fallback = { providerId: "cloud", capability: { region: "FI", trustTier: "community", dataClasses: ["public"] }, execute: () => new Promise(() => {}) };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory });
  await assert.rejects(() => broker.run(workload({ timeoutMs: 100 }), [], new Map()), (error) => error.code === "fallback_execution_timeout");
});

test("broker rechecks offer expiry before acquiring a later retry candidate", async () => {
  const idFactory = ids();
  let advanced = false;
  const clock = () => (advanced ? new Date("2026-08-26T08:00:10.000Z") : new Date("2026-08-26T08:00:00.000Z"));
  const firstOffer = offer({ offerId: "offer-a", providerId: "provider-a", qualityScore: 1, expiresAt: "2099-01-01T00:00:00.000Z" });
  const secondOffer = offer({ offerId: "offer-b", providerId: "provider-b", qualityScore: 0.8, expiresAt: "2026-08-26T08:00:05.000Z" });
  const first = { execute: async () => { advanced = true; throw Object.assign(new Error("unreachable"), { code: "runtime_unreachable" }); } };
  const second = { execute: async () => { throw new Error("should not be called: offer already expired"); } };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock, idFactory }), clock, idFactory });
  await assert.rejects(() => broker.run(workload(), [firstOffer, secondOffer], new Map([["provider-a", first], ["provider-b", second]])), (error) => {
    assert.ok(error instanceof NoEligibleProviderError);
    assert.deepEqual(error.rejected.slice(-2), [
      { providerId: "provider-a", code: "runtime_unreachable" },
      { providerId: "provider-b", code: "offer_expired" }
    ]);
    return true;
  });
});

test("broker records the completed lease and meter to the audit log on success", async () => {
  const idFactory = ids();
  const leaseCalls = [];
  const meterCalls = [];
  const auditLog = {
    async recordLease(lease) { leaseCalls.push(lease); },
    async recordMeter(meter) { meterCalls.push(meter); }
  };
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, auditLog });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(leaseCalls.length, 1);
  assert.equal(leaseCalls[0].leaseId, execution.lease.leaseId);
  assert.equal(leaseCalls[0].state, "completed");
  assert.equal(meterCalls.length, 1);
  assert.equal(meterCalls[0].meterId, execution.meter.meterId);
});

test("broker records each failed attempt before recording the eventual success", async () => {
  const idFactory = ids();
  const leaseCalls = [];
  const auditLog = { async recordLease(lease) { leaseCalls.push(lease); }, async recordMeter() {} };
  const firstOffer = offer({ offerId: "offer-a", providerId: "provider-a", qualityScore: 1 });
  const secondOffer = offer({ offerId: "offer-b", providerId: "provider-b", qualityScore: 0.8 });
  const first = new SimulatedProvider({ offer: firstOffer, failureCode: "runtime_unreachable", clock: fixedClock, idFactory });
  const second = new SimulatedProvider({ offer: secondOffer, responseText: "second provider", clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, auditLog });
  await broker.run(workload(), [firstOffer, secondOffer], new Map([["provider-a", first], ["provider-b", second]]));
  assert.equal(leaseCalls.length, 2);
  assert.equal(leaseCalls[0].state, "failed");
  assert.equal(leaseCalls[0].providerId, "provider-a");
  assert.equal(leaseCalls[1].state, "completed");
  assert.equal(leaseCalls[1].providerId, "provider-b");
});

test("broker records only the fallback meter, no lease, when no FACF attempt is made", async () => {
  const idFactory = ids();
  const leaseCalls = [];
  const meterCalls = [];
  const auditLog = { async recordLease(lease) { leaseCalls.push(lease); }, async recordMeter(meter) { meterCalls.push(meter); } };
  const fallback = { providerId: "cloud", capability: { region: "FI", trustTier: "community", dataClasses: ["public"] }, async execute() { return { text: "cloud result", usage: { inputTokens: 1, outputTokens: 2 }, priceEur: 0.02 }; } };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory, auditLog });
  const execution = await broker.run(workload(), [], new Map());
  assert.equal(execution.route, "fallback");
  assert.equal(leaseCalls.length, 0);
  assert.equal(meterCalls.length, 1);
  assert.equal(meterCalls[0].outcome, "fallback");
});

test("broker records a failed attempt lease even when the whole run is exhausted without fallback", async () => {
  const idFactory = ids();
  const leaseCalls = [];
  const meterCalls = [];
  const auditLog = { async recordLease(lease) { leaseCalls.push(lease); }, async recordMeter(meter) { meterCalls.push(meter); } };
  const provider = { execute: () => new Promise(() => {}) };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, maxAttempts: 1, auditLog });
  await assert.rejects(() => broker.run(workload({ timeoutMs: 100 }), [offer()], new Map([["provider-1", provider]])), NoEligibleProviderError);
  assert.equal(leaseCalls.length, 1);
  assert.equal(leaseCalls[0].state, "failed");
  assert.equal(meterCalls.length, 0);
});

test("broker never throws or blocks the response when the audit log write fails", async () => {
  const idFactory = ids();
  const auditLog = { async recordLease() { throw new Error("db unavailable"); }, async recordMeter() { throw new Error("db unavailable"); } };
  const logged = [];
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, auditLog, logger: (entry) => logged.push(entry) });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(logged.some((entry) => entry.event === "audit_write_failed" && entry.kind === "lease"));
  assert.ok(logged.some((entry) => entry.event === "audit_write_failed" && entry.kind === "meter"));
});

test("broker never throws or blocks the response when the audit log throws synchronously", async () => {
  const idFactory = ids();
  const auditLog = {
    recordLease(lease) { throw new Error("sync boom"); },
    recordMeter(meter) { throw new Error("sync boom"); }
  };
  const logged = [];
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, auditLog, logger: (entry) => logged.push(entry) });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(logged.some((entry) => entry.event === "audit_write_failed" && entry.kind === "lease"));
  assert.ok(logged.some((entry) => entry.event === "audit_write_failed" && entry.kind === "meter"));
});

test("broker contains logger failures while reporting an audit write failure", async () => {
  const idFactory = ids();
  const auditLog = {
    async recordLease() { throw new Error("db unavailable"); },
    async recordMeter() { throw new Error("db unavailable"); }
  };
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({
    leaseStore: new LeaseStore({ clock: fixedClock, idFactory }),
    clock: fixedClock,
    idFactory,
    auditLog,
    logger() { throw new Error("logger unavailable"); }
  });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  await new Promise((resolve) => setImmediate(resolve));
});

test("broker bounds pending audit writes and logs dropped events", async () => {
  const idFactory = ids();
  let releaseWrite;
  const blockedWrite = new Promise((resolve) => { releaseWrite = resolve; });
  const auditCalls = [];
  const auditLog = {
    recordLease(lease) { auditCalls.push({ kind: "lease", id: lease.leaseId }); return blockedWrite; },
    recordMeter(meter) { auditCalls.push({ kind: "meter", id: meter.meterId }); return blockedWrite; }
  };
  const logged = [];
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({
    leaseStore: new LeaseStore({ clock: fixedClock, idFactory }),
    clock: fixedClock,
    idFactory,
    auditLog,
    maxPendingAuditWrites: 1,
    logger: (entry) => logged.push(entry)
  });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  assert.equal(auditCalls.length, 1);
  assert.ok(logged.some((entry) => entry.event === "audit_write_dropped" && entry.kind === "meter" && entry.code === "queue_full"));
  releaseWrite();
  await new Promise((resolve) => setImmediate(resolve));
});

test("broker rejects an invalid audit queue bound", () => {
  assert.throws(
    () => new Broker({ leaseStore: new LeaseStore({ clock: fixedClock }), maxPendingAuditWrites: 0 }),
    /maxPendingAuditWrites must be a positive integer/
  );
});

test("broker never retries or falls back after an ambiguous remote dispatch", async () => {
  const idFactory = ids();
  let fallbackCalls = 0;
  const remote = {
    executionTimeoutManaged: true,
    async execute() { throw Object.assign(new Error("unknown outcome"), { code: "execution_outcome_unknown", noFallback: true }); }
  };
  const fallback = {
    providerId: "cloud",
    capability: { region: "FI", trustTier: "community", dataClasses: ["public"] },
    async execute() { fallbackCalls += 1; return { text: "must not execute", usage: {}, priceEur: 0 }; }
  };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory, maxAttempts: 1 });
  await assert.rejects(
    () => broker.run(workload(), [offer()], new Map([["provider-1", remote]])),
    (error) => error instanceof NoEligibleProviderError && error.rejected.at(-1).code === "execution_outcome_unknown"
  );
  assert.equal(fallbackCalls, 0);
});

test("broker publishes the completed lease and meter as events on success", async () => {
  const idFactory = ids();
  const leaseCalls = [];
  const meterCalls = [];
  const eventPublisher = {
    async publishLease(lease) { leaseCalls.push(lease); },
    async publishMeter(meter) { meterCalls.push(meter); }
  };
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, eventPublisher });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(leaseCalls.length, 1);
  assert.equal(leaseCalls[0].leaseId, execution.lease.leaseId);
  assert.equal(leaseCalls[0].state, "completed");
  assert.equal(meterCalls.length, 1);
  assert.equal(meterCalls[0].meterId, execution.meter.meterId);
});

test("broker publishes each failed attempt before publishing the eventual success", async () => {
  const idFactory = ids();
  const leaseCalls = [];
  const eventPublisher = { async publishLease(lease) { leaseCalls.push(lease); }, async publishMeter() {} };
  const firstOffer = offer({ offerId: "offer-a", providerId: "provider-a", qualityScore: 1 });
  const secondOffer = offer({ offerId: "offer-b", providerId: "provider-b", qualityScore: 0.8 });
  const first = new SimulatedProvider({ offer: firstOffer, failureCode: "runtime_unreachable", clock: fixedClock, idFactory });
  const second = new SimulatedProvider({ offer: secondOffer, responseText: "second provider", clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, eventPublisher });
  await broker.run(workload(), [firstOffer, secondOffer], new Map([["provider-a", first], ["provider-b", second]]));
  assert.equal(leaseCalls.length, 2);
  assert.equal(leaseCalls[0].state, "failed");
  assert.equal(leaseCalls[1].state, "completed");
});

test("broker publishes only the fallback meter, no lease event, when no FACF attempt is made", async () => {
  const idFactory = ids();
  const leaseCalls = [];
  const meterCalls = [];
  const eventPublisher = { async publishLease(lease) { leaseCalls.push(lease); }, async publishMeter(meter) { meterCalls.push(meter); } };
  const fallback = { providerId: "cloud", capability: { region: "FI", trustTier: "community", dataClasses: ["public"] }, async execute() { return { text: "cloud result", usage: { inputTokens: 1, outputTokens: 2 }, priceEur: 0.02 }; } };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory, eventPublisher });
  const execution = await broker.run(workload(), [], new Map());
  assert.equal(execution.route, "fallback");
  assert.equal(leaseCalls.length, 0);
  assert.equal(meterCalls.length, 1);
  assert.equal(meterCalls[0].outcome, "fallback");
});

test("broker never throws or blocks the response when event publishing fails", async () => {
  const idFactory = ids();
  const eventPublisher = { async publishLease() { throw new Error("nats unavailable"); }, async publishMeter() { throw new Error("nats unavailable"); } };
  const logged = [];
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, eventPublisher, logger: (entry) => logged.push(entry) });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(logged.some((entry) => entry.event === "event_publish_failed" && entry.kind === "lease"));
  assert.ok(logged.some((entry) => entry.event === "event_publish_failed" && entry.kind === "meter"));
});

test("broker bounds pending event publishes independently and logs dropped events", async () => {
  const idFactory = ids();
  let releaseWrite;
  const blockedWrite = new Promise((resolve) => { releaseWrite = resolve; });
  const publishCalls = [];
  const eventPublisher = {
    publishLease(lease) { publishCalls.push({ kind: "lease", id: lease.leaseId }); return blockedWrite; },
    publishMeter(meter) { publishCalls.push({ kind: "meter", id: meter.meterId }); return blockedWrite; }
  };
  const logged = [];
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({
    leaseStore: new LeaseStore({ clock: fixedClock, idFactory }),
    clock: fixedClock,
    idFactory,
    eventPublisher,
    maxPendingEventWrites: 1,
    logger: (entry) => logged.push(entry)
  });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  assert.equal(publishCalls.length, 1);
  assert.ok(logged.some((entry) => entry.event === "event_publish_dropped" && entry.kind === "meter" && entry.code === "queue_full"));
  releaseWrite();
  await new Promise((resolve) => setImmediate(resolve));
});

test("broker rejects an invalid event queue bound", () => {
  assert.throws(
    () => new Broker({ leaseStore: new LeaseStore({ clock: fixedClock }), maxPendingEventWrites: 0 }),
    /maxPendingEventWrites must be a positive integer/
  );
});

test("broker's audit log and event publisher queues are independent — one blocking never blocks the other", async () => {
  const idFactory = ids();
  const auditCalls = [];
  const eventCalls = [];
  const auditLog = {
    async recordLease(lease) { auditCalls.push(lease); },
    async recordMeter(meter) { auditCalls.push(meter); }
  };
  const eventPublisher = {
    publishLease() { return new Promise(() => {}); }, // never resolves
    publishMeter() { return new Promise(() => {}); }
  };
  const provider = new SimulatedProvider({ offer: offer(), clock: fixedClock, idFactory });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), clock: fixedClock, idFactory, auditLog, eventPublisher });
  const execution = await broker.run(workload(), [provider.advertise()], new Map([["provider-1", provider]]));
  assert.equal(execution.route, "facf");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(auditCalls.length, 2); // lease + meter still recorded to Postgres even though NATS is permanently stuck
});
