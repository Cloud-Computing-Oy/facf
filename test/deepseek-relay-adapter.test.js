import test from "node:test";
import assert from "node:assert/strict";
import { DeepSeekRelayAdapter } from "../src/provider/deepseek-relay-adapter.js";

test("DeepSeek relay adapter uses the chat completions API and returns usage", async () => {
  let captured;
  const adapter = new DeepSeekRelayAdapter({
    apiKey: "test-key",
    baseUrl: "https://api.deepseek.com",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), headers: options.headers, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }), { status: 200 });
    }
  });
  const result = await adapter.chat({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] });
  assert.equal(captured.url, "https://api.deepseek.com/chat/completions");
  assert.equal(captured.headers.authorization, "Bearer test-key");
  assert.equal(captured.body.stream, false);
  assert.deepEqual(result, { text: "ok", usage: { inputTokens: 3, outputTokens: 2 } });
});

test("DeepSeek relay adapter maps a 401 response to relay_auth_error without leaking the response body", async () => {
  const adapter = new DeepSeekRelayAdapter({
    apiKey: "test-key",
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "invalid api key sk-secret-leak" } }), { status: 401 })
  });
  await assert.rejects(() => adapter.chat({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] }), (error) => {
    assert.equal(error.code, "relay_auth_error");
    assert.equal(error.message.includes("sk-secret-leak"), false);
    return true;
  });
});

test("DeepSeek relay adapter maps other non-2xx responses to relay_http_error", async () => {
  const adapter = new DeepSeekRelayAdapter({ apiKey: "test-key", fetchImpl: async () => new Response("", { status: 500 }) });
  await assert.rejects(() => adapter.chat({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] }), (error) => error.code === "relay_http_error");
});

test("DeepSeek relay adapter maps a malformed response to relay_invalid_response", async () => {
  const adapter = new DeepSeekRelayAdapter({ apiKey: "test-key", fetchImpl: async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }) });
  await assert.rejects(() => adapter.chat({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] }), (error) => error.code === "relay_invalid_response");
});

test("DeepSeek relay adapter does not expose network error details", async () => {
  const adapter = new DeepSeekRelayAdapter({ apiKey: "test-key", fetchImpl: async () => { throw new Error("secret host details"); } });
  await assert.rejects(() => adapter.chat({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] }), (error) => {
    assert.equal(error.code, "relay_unreachable");
    assert.equal(error.message.includes("secret"), false);
    return true;
  });
});

test("DeepSeek relay adapter enforces its timeout", async () => {
  const adapter = new DeepSeekRelayAdapter({
    apiKey: "test-key",
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })
  });
  await assert.rejects(() => adapter.chat({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }] }), (error) => error.code === "relay_timeout");
});

test("DeepSeek relay adapter honors an agent execution deadline signal", async () => {
  const controller = new AbortController();
  const adapter = new DeepSeekRelayAdapter({
    apiKey: "test-key",
    timeoutMs: 30000,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })
  });
  const execution = adapter.chat({ model: "deepseek-chat", messages: [{ role: "user", content: "hi" }], signal: controller.signal });
  controller.abort();
  await assert.rejects(execution, (error) => error.code === "relay_timeout");
});

test("DeepSeek relay adapter requires an API key", () => {
  assert.throws(() => new DeepSeekRelayAdapter({ apiKey: "" }), /apiKey/);
  assert.throws(() => new DeepSeekRelayAdapter({}), /apiKey/);
});

test("DeepSeek relay adapter rejects credentials embedded in its base URL", () => {
  assert.throws(() => new DeepSeekRelayAdapter({ apiKey: "test-key", baseUrl: "https://user:pass@api.deepseek.com" }), /must not contain credentials/);
});
