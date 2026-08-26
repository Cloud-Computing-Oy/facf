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

test("broker uses bounded cloud fallback and emits fallback meter", async () => {
  const idFactory = ids();
  const provider = new SimulatedProvider({ offer: offer(), failureCode: "runtime_unreachable", clock: fixedClock, idFactory });
  const fallback = { providerId: "cloud", async execute() { return { text: "cloud result", usage: { inputTokens: 1, outputTokens: 2 }, priceEur: 0.02 }; } };
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
  const fallback = { providerId: "cloud", async execute() { return { text: "expensive", usage: {}, priceEur: 1 }; } };
  const broker = new Broker({ leaseStore: new LeaseStore({ clock: fixedClock, idFactory }), fallback, clock: fixedClock, idFactory });
  await assert.rejects(() => broker.run(workload(), [], new Map()), (error) => {
    assert.ok(error instanceof NoEligibleProviderError);
    assert.equal(error.rejected.at(-1).code, "fallback_price_not_allowed");
    return true;
  });
});
