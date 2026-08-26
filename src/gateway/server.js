import http from "node:http";
import { randomUUID } from "node:crypto";
import { completionFromExecution, GatewayRequestError, toWorkload } from "./chat-completions.js";

const DEFAULT_POLICY = Object.freeze({
  tenantId: "local-pilot",
  models: ["qwen2.5:7b"],
  dataClass: "public",
  dataClasses: ["public", "synthetic"],
  minimumTrustTier: "community",
  allowedRegions: ["FI"],
  maximumPriceEur: 0.05,
  timeoutMs: 30_000,
  maxMessages: 32,
  maxMessageChars: 16_384,
  maxBodyBytes: 256 * 1024
});

export function createGatewayServer({ broker, offers, providers, policy = {}, logger = () => {} } = {}) {
  if (!broker || !(Array.isArray(offers) || typeof offers === "function") || !(providers instanceof Map)) throw new TypeError("broker, offers, and providers are required");
  const effectivePolicy = { ...DEFAULT_POLICY, ...policy };
  return http.createServer(async (request, response) => {
    const requestId = randomUUID();
    try {
      if (request.method === "GET" && request.url === "/healthz") return sendJson(response, 200, { status: "ok" });
      if (request.method !== "POST" || request.url !== "/v1/chat/completions") return sendError(response, 404, "not_found", "route not found");
      const body = await readJson(request, effectivePolicy.maxBodyBytes);
      const workload = toWorkload(body, effectivePolicy);
      const availableOffers = typeof offers === "function" ? offers() : offers;
      if (!Array.isArray(availableOffers)) throw new TypeError("offers function must return an array");
      const execution = await broker.run(workload, availableOffers, providers);
      const completion = completionFromExecution(execution, workload);
      logger({ event: "completion", requestId, route: execution.route, providerId: execution.providerId });
      if (body.stream === true) return sendStream(response, completion);
      return sendJson(response, 200, completion);
    } catch (error) {
      const status = error instanceof GatewayRequestError ? error.status : error.code === "body_too_large" ? 413 : 503;
      const code = error instanceof GatewayRequestError ? error.code : error.code === "body_too_large" ? error.code : "inference_unavailable";
      logger({ event: "request_failed", requestId, code });
      return sendError(response, status, code, status === 503 ? "inference is unavailable" : error.message);
    }
  });
}

export function listenLocal(server, { host = "127.0.0.1", port = 8787 } = {}) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server.address()));
  });
}

async function readJson(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error("request body is too large");
      error.code = "body_too_large";
      throw error;
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new GatewayRequestError("invalid_json", "request body must be valid JSON"); }
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { message, type: "facf_gateway_error", code } });
}

function sendStream(response, completion) {
  response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", connection: "keep-alive" });
  const base = { id: completion.id, object: "chat.completion.chunk", created: completion.created, model: completion.model };
  response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: "assistant", content: completion.choices[0].message.content }, finish_reason: null }] })}\n\n`);
  response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
  response.end("data: [DONE]\n\n");
}
