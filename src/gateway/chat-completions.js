import { randomUUID } from "node:crypto";

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);
const ALLOWED_DATA_CLASSES = new Set(["public", "synthetic"]);

export class GatewayRequestError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "GatewayRequestError";
    this.code = code;
    this.status = status;
  }
}

export function toWorkload(body, policy, idFactory = randomUUID) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new GatewayRequestError("invalid_request", "request body must be an object");
  if (typeof body.model !== "string" || !policy.models.includes(body.model)) throw new GatewayRequestError("model_not_allowed", "model is not allowed", 403);
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > policy.maxMessages) throw new GatewayRequestError("invalid_messages", "messages must contain an allowed number of items");
  const messages = body.messages.map((message) => {
    if (!message || typeof message !== "object" || !ALLOWED_ROLES.has(message.role) || typeof message.content !== "string" || message.content.length < 1 || message.content.length > policy.maxMessageChars) {
      throw new GatewayRequestError("invalid_message", "each message requires an allowed role and bounded text content");
    }
    return { role: message.role, content: message.content };
  });
  const dataClass = body.facf?.data_class ?? policy.dataClass;
  if (!ALLOWED_DATA_CLASSES.has(dataClass) || !policy.dataClasses.includes(dataClass)) throw new GatewayRequestError("data_class_not_allowed", "data class is not allowed", 403);
  // Reject malformed/excessive generation options at the gateway boundary, using the
  // same bounds the Ollama provider enforces downstream — otherwise a bad value only
  // fails after a lease is already acquired, wasting the attempt and returning a
  // misleading 503 instead of a clear 400.
  const options = {};
  if (body.max_tokens !== undefined) {
    if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 256) throw new GatewayRequestError("invalid_options", "max_tokens must be an integer between 1 and 256");
    options.num_predict = body.max_tokens;
  }
  if (body.temperature !== undefined) {
    if (!Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2) throw new GatewayRequestError("invalid_options", "temperature must be a number between 0 and 2");
    options.temperature = body.temperature;
  }
  return {
    protocolVersion: "v0alpha1",
    workloadId: idFactory(),
    tenantId: policy.tenantId,
    model: body.model,
    dataClass,
    minimumTrustTier: policy.minimumTrustTier,
    allowedRegions: [...policy.allowedRegions],
    maximumPriceEur: policy.maximumPriceEur,
    timeoutMs: policy.timeoutMs,
    input: { messages, options }
  };
}

export function completionFromExecution(execution, workload, idFactory = randomUUID, created = () => Math.floor(Date.now() / 1000)) {
  const text = execution?.result?.output?.text;
  if (typeof text !== "string") throw new Error("broker result did not contain text output");
  return {
    id: `chatcmpl-${idFactory()}`,
    object: "chat.completion",
    created: created(),
    model: workload.model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: execution.meter?.inputTokens ?? 0,
      completion_tokens: execution.meter?.outputTokens ?? 0,
      total_tokens: (execution.meter?.inputTokens ?? 0) + (execution.meter?.outputTokens ?? 0)
    },
    facf: { route: execution.route, provider_id: execution.providerId }
  };
}
