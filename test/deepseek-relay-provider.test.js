import test from "node:test";
import assert from "node:assert/strict";
import { DeepSeekRelayProvider } from "../src/provider/deepseek-relay-provider.js";
import { offer, workload } from "../test-support/helpers.js";

const relayOffer = (overrides = {}) => offer({ nodeType: "relay", relayUpstream: "deepseek", models: ["deepseek-chat"], ...overrides });

test("DeepSeek relay provider binds execution to the lease and discloses relay metadata", async () => {
  const adapter = { async chat() { return { text: "runtime output", usage: { inputTokens: 4, outputTokens: 2 } }; } };
  const clock = () => new Date("2026-08-26T08:00:00.000Z");
  const provider = new DeepSeekRelayProvider({ offer: relayOffer(), adapter, clock, idFactory: () => "meter-1" });
  const execution = await provider.execute({
    workload: workload({ model: "deepseek-chat" }),
    lease: { leaseId: "lease-1", providerId: "provider-1", offerId: "offer-1" }
  });
  assert.equal(execution.result.output.text, "runtime output");
  assert.equal(execution.meter.metadata.nodeType, "relay");
  assert.equal(execution.meter.metadata.relayUpstream, "deepseek");
  assert.equal(JSON.stringify(execution.meter).includes("runtime output"), false);
});

test("DeepSeek relay provider rejects a lease for another provider", async () => {
  const provider = new DeepSeekRelayProvider({ offer: relayOffer(), adapter: { async chat() { throw new Error("must not run"); } } });
  await assert.rejects(() => provider.execute({ workload: workload({ model: "deepseek-chat" }), lease: { leaseId: "lease-1", providerId: "other", offerId: "offer-1" } }), (error) => error.code === "grant_mismatch");
});

test("DeepSeek relay provider rejects a model the offer does not advertise", async () => {
  const provider = new DeepSeekRelayProvider({ offer: relayOffer(), adapter: { async chat() { throw new Error("must not run"); } } });
  await assert.rejects(() => provider.execute({ workload: workload({ model: "other-model" }), lease: { leaseId: "lease-1", providerId: "provider-1", offerId: "offer-1" } }), (error) => error.code === "model_unavailable");
});

test("DeepSeek relay provider refuses a workload outside public or synthetic dataClass even if it reaches execute", async () => {
  const provider = new DeepSeekRelayProvider({ offer: relayOffer(), adapter: { async chat() { throw new Error("must not run"); } } });
  await assert.rejects(
    () => provider.execute({ workload: workload({ model: "deepseek-chat", dataClass: "internal" }), lease: { leaseId: "lease-1", providerId: "provider-1", offerId: "offer-1" } }),
    (error) => error.code === "relay_dataclass_forbidden"
  );
});
