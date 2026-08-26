import assert from "node:assert/strict";
import test from "node:test";
import { createGatewayServer, listenLocal } from "../src/gateway/server.js";
import { completionFromExecution, GatewayRequestError, toWorkload } from "../src/gateway/chat-completions.js";

const policy = { tenantId: "tenant-a", models: ["qwen2.5:7b"], dataClass: "public", dataClasses: ["public", "synthetic"], minimumTrustTier: "verified", allowedRegions: ["FI"], maximumPriceEur: 0.02, timeoutMs: 5000, maxMessages: 4, maxMessageChars: 100, maxBodyBytes: 4096 };

test("request translation pins server policy", () => {
  const workload = toWorkload({ model: "qwen2.5:7b", messages: [{ role: "user", content: "hello" }], tenantId: "attacker", facf: { data_class: "synthetic", maximum_price_eur: 999 } }, policy, () => "work-1");
  assert.equal(workload.workloadId, "work-1");
  assert.equal(workload.tenantId, "tenant-a");
  assert.equal(workload.maximumPriceEur, 0.02);
  assert.equal(workload.dataClass, "synthetic");
});

test("request translation rejects disallowed model and data class", () => {
  assert.throws(() => toWorkload({ model: "other", messages: [{ role: "user", content: "x" }] }, policy), (error) => error instanceof GatewayRequestError && error.code === "model_not_allowed");
  assert.throws(() => toWorkload({ model: "qwen2.5:7b", messages: [{ role: "user", content: "x" }], facf: { data_class: "restricted" } }, policy), /data class is not allowed/);
});

test("completion response reports metered usage", () => {
  const response = completionFromExecution({ route: "facf", providerId: "p1", result: { output: { text: "hi" } }, meter: { inputTokens: 2, outputTokens: 3 } }, { model: "qwen2.5:7b" }, () => "id", () => 123);
  assert.equal(response.id, "chatcmpl-id");
  assert.equal(response.choices[0].message.content, "hi");
  assert.equal(response.usage.total_tokens, 5);
});

test("HTTP gateway serves JSON and SSE without logging content", async (t) => {
  const events = [];
  const broker = { run: async (workload) => ({ route: "facf", providerId: "p1", result: { output: { text: `reply:${workload.input.messages[0].content}` } }, meter: { inputTokens: 1, outputTokens: 2 } }) };
  const server = createGatewayServer({ broker, offers: [], providers: new Map(), policy, logger: (event) => events.push(event) });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const url = `http://127.0.0.1:${address.port}/v1/chat/completions`;
  const json = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "secret-test-text" }] }) });
  assert.equal(json.status, 200);
  assert.equal((await json.json()).choices[0].message.content, "reply:secret-test-text");
  const stream = await fetch(url, { method: "POST", body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "hello" }], stream: true }) });
  assert.match(await stream.text(), /data: \[DONE\]/);
  assert.doesNotMatch(JSON.stringify(events), /secret-test-text|reply:/);
});

test("HTTP gateway returns stable safe errors", async (t) => {
  const server = createGatewayServer({ broker: { run: async () => { throw new Error("provider leaked detail"); } }, offers: [], providers: new Map(), policy });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, { method: "POST", body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "x" }] }) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { message: "inference is unavailable", type: "facf_gateway_error", code: "inference_unavailable" } });
});
