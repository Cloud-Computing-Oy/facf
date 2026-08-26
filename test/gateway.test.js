import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createGatewayServer, listenLocal } from "../src/gateway/server.js";
import { completionFromExecution, GatewayRequestError, toWorkload } from "../src/gateway/chat-completions.js";
import { Broker } from "../src/core/broker.js";
import { LeaseStore } from "../src/core/lease-store.js";

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

test("request translation rejects malformed or excessive generation options", () => {
  const base = { model: "qwen2.5:7b", messages: [{ role: "user", content: "hello" }] };
  assert.throws(() => toWorkload({ ...base, max_tokens: 1_000_000 }, policy), (error) => error instanceof GatewayRequestError && error.code === "invalid_options");
  assert.throws(() => toWorkload({ ...base, max_tokens: "256" }, policy), (error) => error instanceof GatewayRequestError && error.code === "invalid_options");
  assert.throws(() => toWorkload({ ...base, temperature: 5 }, policy), (error) => error instanceof GatewayRequestError && error.code === "invalid_options");
  const workload = toWorkload({ ...base, max_tokens: 128, temperature: 0.5 }, policy);
  assert.deepEqual(workload.input.options, { num_predict: 128, temperature: 0.5 });
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
  const stream = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "hello" }], stream: true }) });
  assert.match(await stream.text(), /data: \[DONE\]/);
  assert.doesNotMatch(JSON.stringify(events), /secret-test-text|reply:/);
});

test("HTTP gateway returns stable safe errors", async (t) => {
  const server = createGatewayServer({ broker: { run: async () => { throw new Error("provider leaked detail"); } }, offers: [], providers: new Map(), policy });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "x" }] }) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: { message: "inference is unavailable", type: "facf_gateway_error", code: "inference_unavailable" } });
});

test("HTTP gateway request is bounded by the workload timeout even when the provider hangs", async (t) => {
  const shortPolicy = { ...policy, timeoutMs: 100 };
  const hungOffer = { protocolVersion: "v0alpha1", offerId: "offer-1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], region: "FI", trustTier: "verified", dataClasses: ["public", "synthetic"], availableSlots: 1, priceEur: 0.01, estimatedLatencyMs: 50, qualityScore: 0.9, expiresAt: "2099-01-01T00:00:00.000Z" };
  const provider = { execute: () => new Promise(() => {}) };
  const broker = new Broker({ leaseStore: new LeaseStore(), maxAttempts: 1 });
  const server = createGatewayServer({ broker, offers: [hungOffer], providers: new Map([["provider-1", provider]]), policy: shortPolicy });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const startedAt = Date.now();
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "x" }] }) });
  assert.equal(response.status, 503);
  assert.ok(Date.now() - startedAt < 2000, "request must be bounded by workload.timeoutMs, not hang indefinitely");
});

test("HTTP gateway rejects a CORS-safelisted content-type from a browser-originated request", async (t) => {
  const broker = { run: async () => { throw new Error("must not be reached"); } };
  const server = createGatewayServer({ broker, offers: [], providers: new Map(), policy });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "x" }] })
  });
  assert.equal(response.status, 415);
  assert.equal((await response.json()).error.code, "unsupported_media_type");
});

test("HTTP gateway rejects a request whose Host header does not match the loopback listener (DNS rebinding)", async (t) => {
  // fetch() treats Host as a forbidden header and always overwrites it to match the
  // connection target, so a DNS-rebinding attempt (attacker hostname resolved to
  // 127.0.0.1, browser still sends the attacker hostname as Host) has to be simulated
  // with a raw http.request that connects to the loopback listener but claims another Host.
  const broker = { run: async () => { throw new Error("must not be reached"); } };
  const server = createGatewayServer({ broker, offers: [], providers: new Map(), policy });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const body = JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "x" }] });
  const response = await new Promise((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", port: address.port, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json", host: "attacker.example:1234", "content-length": Buffer.byteLength(body) } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
    });
    request.on("error", reject);
    request.end(body);
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "untrusted_host");
});
