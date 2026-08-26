import { ProviderExecutionError } from "./simulator.js";

export class OllamaAdapter {
  constructor({ baseUrl = "http://127.0.0.1:11434", fetchImpl = fetch, timeoutMs = 30000 } = {}) {
    this.baseUrl = new URL(baseUrl);
    if (!["http:", "https:"].includes(this.baseUrl.protocol)) throw new TypeError("Ollama baseUrl must use http or https");
    if (this.baseUrl.username || this.baseUrl.password) throw new TypeError("Ollama baseUrl must not contain credentials");
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async chat({ model, messages, options = {} }) {
    if (!model || !Array.isArray(messages) || messages.length === 0) throw new ProviderExecutionError("invalid_workload", "model and messages are required");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(new URL("/api/chat", this.baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, messages, options, stream: false }),
        signal: controller.signal
      });
      if (!response.ok) throw new ProviderExecutionError("runtime_http_error", `Ollama returned HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.message || typeof payload.message.content !== "string") throw new ProviderExecutionError("runtime_invalid_response", "Ollama response did not contain message.content");
      return { text: payload.message.content, usage: { inputTokens: payload.prompt_eval_count ?? 0, outputTokens: payload.eval_count ?? 0 } };
    } catch (error) {
      if (error?.name === "AbortError") throw new ProviderExecutionError("runtime_timeout", "Ollama request timed out");
      if (error instanceof ProviderExecutionError) throw error;
      throw new ProviderExecutionError("runtime_unreachable", "Ollama request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
