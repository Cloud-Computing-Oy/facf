import test from "node:test";
import assert from "node:assert/strict";
import { OllamaAdapter } from "../src/provider/ollama-adapter.js";

test("Ollama adapter uses non-streaming chat API and returns usage", async () => {
  let captured;
  const adapter = new OllamaAdapter({
    baseUrl: "http://127.0.0.1:11434",
    fetchImpl: async (url, options) => {
      captured = { url: String(url), body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ message: { content: "ok" }, prompt_eval_count: 3, eval_count: 2 }), { status: 200 });
    }
  });
  const result = await adapter.chat({ model: "qwen2.5:7b", messages: [{ role: "user", content: "hi" }] });
  assert.equal(captured.url, "http://127.0.0.1:11434/api/chat");
  assert.equal(captured.body.stream, false);
  assert.deepEqual(result, { text: "ok", usage: { inputTokens: 3, outputTokens: 2 } });
});

test("Ollama adapter does not expose network error details", async () => {
  const adapter = new OllamaAdapter({ fetchImpl: async () => { throw new Error("secret host details"); } });
  await assert.rejects(() => adapter.chat({ model: "test", messages: [{ role: "user", content: "hi" }] }), (error) => {
    assert.equal(error.code, "runtime_unreachable");
    assert.equal(error.message.includes("secret"), false);
    return true;
  });
});

test("Ollama adapter enforces its timeout", async () => {
  const adapter = new OllamaAdapter({
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })
  });
  await assert.rejects(() => adapter.chat({ model: "test", messages: [{ role: "user", content: "hi" }] }), (error) => error.code === "runtime_timeout");
});

test("Ollama adapter honors an agent execution deadline signal", async () => {
  const controller = new AbortController();
  const adapter = new OllamaAdapter({
    timeoutMs: 30000,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })
  });
  const execution = adapter.chat({ model: "test", messages: [{ role: "user", content: "hi" }], signal: controller.signal });
  controller.abort();
  await assert.rejects(execution, (error) => error.code === "runtime_timeout");
});

test("Ollama adapter rejects credentials embedded in its base URL", () => {
  assert.throws(() => new OllamaAdapter({ baseUrl: "http://user:pass@127.0.0.1:11434" }), /must not contain credentials/);
});
