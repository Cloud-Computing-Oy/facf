import test from "node:test";
import assert from "node:assert/strict";
import { OllamaProvider } from "../src/provider/ollama-provider.js";
import { offer, workload } from "../test-support/helpers.js";

test("Ollama provider binds execution to the lease and emits content-free meter metadata", async () => {
  const adapter = { async chat() { return { text: "runtime output", usage: { inputTokens: 4, outputTokens: 2 } }; } };
  const clock = () => new Date("2026-08-26T08:00:00.000Z");
  const provider = new OllamaProvider({ offer: offer(), adapter, clock, idFactory: () => "meter-1" });
  const execution = await provider.execute({
    workload: workload(),
    lease: { leaseId: "lease-1", providerId: "provider-1", offerId: "offer-1" }
  });
  assert.equal(execution.result.output.text, "runtime output");
  assert.equal(execution.meter.metadata.runtime, "ollama");
  assert.equal(JSON.stringify(execution.meter).includes("runtime output"), false);
});

test("Ollama provider rejects a lease for another provider", async () => {
  const provider = new OllamaProvider({ offer: offer(), adapter: { async chat() { throw new Error("must not run"); } } });
  await assert.rejects(() => provider.execute({ workload: workload(), lease: { leaseId: "lease-1", providerId: "other", offerId: "offer-1" } }), (error) => error.code === "grant_mismatch");
});

test("Ollama provider bounds runtime options", async () => {
  let options;
  const adapter = { async chat(request) { options = request.options; return { text: "ok", usage: { inputTokens: 1, outputTokens: 1 } }; } };
  const provider = new OllamaProvider({ offer: offer(), adapter });
  await provider.execute({
    workload: workload({ input: { messages: [{ role: "user", content: "hello" }], options: { num_predict: 32, temperature: 0 } } }),
    lease: { leaseId: "lease-1", providerId: "provider-1", offerId: "offer-1" }
  });
  assert.deepEqual(options, { num_predict: 32, temperature: 0 });
  await assert.rejects(() => provider.execute({
    workload: workload({ input: { messages: [{ role: "user", content: "hello" }], options: { num_predict: 1000 } } }),
    lease: { leaseId: "lease-2", providerId: "provider-1", offerId: "offer-1" }
  }), (error) => error.code === "invalid_workload");
});
