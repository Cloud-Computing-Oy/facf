import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createLocalOllamaGateway, localGatewayConfig } from "../src/gateway/local-ollama.js";
import { listenLocal } from "../src/gateway/server.js";

test("local gateway configuration fails closed", () => {
  const config = localGatewayConfig({ FACF_GATEWAY_ENABLE: "0" });
  assert.equal(config.enabled, false);
  assert.throws(() => createLocalOllamaGateway(config), /Refusing live gateway startup/);
  assert.throws(() => localGatewayConfig({ FACF_GATEWAY_PORT: "0" }), /between 1 and 65535/);
  assert.throws(() => localGatewayConfig({ FACF_OLLAMA_URL: "http://user:pass@localhost" }), /without credentials/);
});

test("local gateway CLI refuses startup without explicit consent", () => {
  const result = spawnSync(process.execPath, ["src/cli/local-gateway.js"], {
    cwd: process.cwd(),
    env: { ...process.env, FACF_GATEWAY_ENABLE: "0" },
    encoding: "utf8",
    timeout: 5000
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Refusing live gateway startup/);
  assert.doesNotMatch(result.stdout + result.stderr, /API_KEY|password/i);
});

test("runnable gateway completes a synthetic request through Ollama", async (t) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ message: { content: "FACF LOCAL OK" }, prompt_eval_count: 4, eval_count: 3 }), { status: 200 });
  };
  const config = localGatewayConfig({ FACF_GATEWAY_ENABLE: "1", FACF_GATEWAY_PORT: "8787", FACF_OLLAMA_MODEL: "qwen2.5:7b" });
  const server = createLocalOllamaGateway(config, { fetchImpl });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "synthetic test" }], facf: { data_class: "synthetic" } })
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.choices[0].message.content, "FACF LOCAL OK");
  assert.equal(result.usage.total_tokens, 7);
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/chat");
  assert.equal(calls[0].body.stream, false);
});

test("runnable gateway records the completed lease and meter when an audit log is configured", async (t) => {
  const leaseCalls = [];
  const meterCalls = [];
  const auditLog = {
    async recordLease(lease) { leaseCalls.push(lease); },
    async recordMeter(meter) { meterCalls.push(meter); }
  };
  const fetchImpl = async () => new Response(JSON.stringify({ message: { content: "FACF LOCAL OK" }, prompt_eval_count: 4, eval_count: 3 }), { status: 200 });
  const config = localGatewayConfig({ FACF_GATEWAY_ENABLE: "1", FACF_GATEWAY_PORT: "8787", FACF_OLLAMA_MODEL: "qwen2.5:7b" });
  const server = createLocalOllamaGateway(config, { fetchImpl, auditLog });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "synthetic test" }], facf: { data_class: "synthetic" } })
  });
  assert.equal(response.status, 200);
  assert.equal(leaseCalls.length, 1);
  assert.equal(leaseCalls[0].state, "completed");
  assert.equal(meterCalls.length, 1);
});

test("runnable gateway publishes the completed lease and meter when an event publisher is configured", async (t) => {
  const leaseCalls = [];
  const meterCalls = [];
  const eventPublisher = {
    async publishLease(lease) { leaseCalls.push(lease); },
    async publishMeter(meter) { meterCalls.push(meter); }
  };
  const fetchImpl = async () => new Response(JSON.stringify({ message: { content: "FACF LOCAL OK" }, prompt_eval_count: 4, eval_count: 3 }), { status: 200 });
  const config = localGatewayConfig({ FACF_GATEWAY_ENABLE: "1", FACF_GATEWAY_PORT: "8787", FACF_OLLAMA_MODEL: "qwen2.5:7b" });
  const server = createLocalOllamaGateway(config, { fetchImpl, eventPublisher });
  const address = await listenLocal(server, { port: 0 });
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "qwen2.5:7b", messages: [{ role: "user", content: "synthetic test" }], facf: { data_class: "synthetic" } })
  });
  assert.equal(response.status, 200);
  assert.equal(leaseCalls.length, 1);
  assert.equal(leaseCalls[0].state, "completed");
  assert.equal(meterCalls.length, 1);
});
