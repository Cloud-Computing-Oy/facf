import { ProviderExecutionError } from "./simulator.js";

export class DeepSeekRelayAdapter {
  constructor({ apiKey, baseUrl = "https://api.deepseek.com", fetchImpl = fetch, timeoutMs = 30000 } = {}) {
    if (typeof apiKey !== "string" || apiKey.length === 0) throw new TypeError("DeepSeek relay adapter requires an apiKey");
    this.apiKey = apiKey;
    this.baseUrl = new URL(baseUrl);
    if (!["http:", "https:"].includes(this.baseUrl.protocol)) throw new TypeError("DeepSeek relay baseUrl must use http or https");
    if (this.baseUrl.username || this.baseUrl.password) throw new TypeError("DeepSeek relay baseUrl must not contain credentials");
    const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(this.baseUrl.hostname);
    // Unlike the local, unauthenticated Ollama adapter, this adapter carries a
    // reusable cloud API credential in its Authorization header — plaintext HTTP
    // to a non-loopback host would send that credential over the network in the clear.
    if (this.baseUrl.protocol === "http:" && !isLoopback) throw new TypeError("DeepSeek relay baseUrl must use https unless it targets a loopback address");
    // A relative reference resolved against a base URL whose path does not end in "/"
    // drops the base path's last segment entirely (WHATWG URL resolution treats it as
    // a file, not a directory) — silently discarding any operator-configured path
    // prefix such as a gateway/proxy mount point. Normalize once here so chat()'s
    // relative "chat/completions" reference always preserves that prefix.
    if (!this.baseUrl.pathname.endsWith("/")) this.baseUrl.pathname += "/";
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async chat({ model, messages, options = {}, signal, timeoutMs = this.timeoutMs }) {
    if (!model || !Array.isArray(messages) || messages.length === 0) throw new ProviderExecutionError("invalid_workload", "model and messages are required");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, timeoutMs));
    const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const response = await this.fetchImpl(new URL("chat/completions", this.baseUrl), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        // options is spread first so a caller-supplied options object can never
        // override the validated model/messages/stream values that follow it.
        body: JSON.stringify({ ...options, model, messages, stream: false }),
        signal: requestSignal
      });
      if (response.status === 401 || response.status === 403) throw new ProviderExecutionError("relay_auth_error", "DeepSeek relay rejected the configured credentials");
      if (!response.ok) throw new ProviderExecutionError("relay_http_error", `DeepSeek relay returned HTTP ${response.status}`);
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new ProviderExecutionError("relay_invalid_response", "DeepSeek relay response did not contain choices[0].message.content");
      return { text: content, usage: { inputTokens: payload.usage?.prompt_tokens ?? 0, outputTokens: payload.usage?.completion_tokens ?? 0 } };
    } catch (error) {
      if (error?.name === "AbortError") throw new ProviderExecutionError("relay_timeout", "DeepSeek relay request timed out");
      if (error instanceof ProviderExecutionError) throw error;
      throw new ProviderExecutionError("relay_unreachable", "DeepSeek relay request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
