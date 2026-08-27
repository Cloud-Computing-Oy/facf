import { Broker } from "../core/broker.js";
import { LeaseStore } from "../core/lease-store.js";
import { OllamaAdapter } from "../provider/ollama-adapter.js";
import { OllamaProvider } from "../provider/ollama-provider.js";
import { createGatewayServer } from "./server.js";

export function localGatewayConfig(env = process.env) {
  const model = boundedText(env.FACF_OLLAMA_MODEL ?? "qwen2.5:7b", "FACF_OLLAMA_MODEL", 128);
  const region = boundedText(env.FACF_PROVIDER_REGION ?? "FI", "FACF_PROVIDER_REGION", 32);
  const providerId = boundedText(env.FACF_PROVIDER_ID ?? "provider-local-ollama", "FACF_PROVIDER_ID", 128);
  const baseUrl = new URL(env.FACF_OLLAMA_URL ?? "http://127.0.0.1:11434");
  if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) throw new TypeError("FACF_OLLAMA_URL must be an HTTP(S) URL without credentials");
  return {
    enabled: env.FACF_GATEWAY_ENABLE === "1",
    host: "127.0.0.1",
    port: integer(env.FACF_GATEWAY_PORT ?? "8787", "FACF_GATEWAY_PORT", 1, 65535),
    model,
    region,
    providerId,
    baseUrl: baseUrl.toString(),
    timeoutMs: integer(env.FACF_GATEWAY_TIMEOUT_MS ?? "120000", "FACF_GATEWAY_TIMEOUT_MS", 1000, 300000),
    maximumPriceEur: number(env.FACF_GATEWAY_MAX_PRICE_EUR ?? "0", "FACF_GATEWAY_MAX_PRICE_EUR", 0, 1000),
    maxBodyBytes: integer(env.FACF_GATEWAY_MAX_BODY_BYTES ?? "262144", "FACF_GATEWAY_MAX_BODY_BYTES", 1024, 1048576)
  };
}

export function createLocalOllamaGateway(config, { fetchImpl = fetch, clock = () => new Date(), logger = () => {}, auditLog = null, eventPublisher = null } = {}) {
  if (!config?.enabled) throw new Error("Refusing live gateway startup. Set FACF_GATEWAY_ENABLE=1 after confirming workloads are public or synthetic.");
  const offer = {
    protocolVersion: "v0alpha1",
    offerId: `offer:${config.providerId}`,
    providerId: config.providerId,
    capabilityId: `capability:${config.providerId}`,
    models: [config.model],
    region: config.region,
    trustTier: "community",
    dataClasses: ["public", "synthetic"],
    availableSlots: 1,
    priceEur: 0,
    estimatedLatencyMs: 500,
    qualityScore: 0.8,
    expiresAt: new Date(clock().getTime() + 60000).toISOString()
  };
  const adapter = new OllamaAdapter({ baseUrl: config.baseUrl, fetchImpl, timeoutMs: config.timeoutMs });
  const provider = new OllamaProvider({ offer, adapter, clock });
  const broker = new Broker({ leaseStore: new LeaseStore({ clock, ttlMs: config.timeoutMs + 5000 }), clock, maxAttempts: 1, auditLog, eventPublisher, logger });
  const offers = () => [{ ...provider.advertise(), expiresAt: new Date(clock().getTime() + 60000).toISOString() }];
  const providers = new Map([[config.providerId, provider]]);
  const policy = {
    tenantId: "facf-local-gateway",
    models: [config.model],
    dataClass: "public",
    dataClasses: ["public", "synthetic"],
    minimumTrustTier: "community",
    allowedRegions: [config.region],
    maximumPriceEur: config.maximumPriceEur,
    timeoutMs: config.timeoutMs,
    maxMessages: 32,
    maxMessageChars: 16384,
    maxBodyBytes: config.maxBodyBytes
  };
  return createGatewayServer({ broker, offers, providers, policy, logger });
}

function boundedText(value, name, max) {
  if (typeof value !== "string" || value.length < 1 || value.length > max || /[\r\n\0]/.test(value)) throw new TypeError(`${name} must be 1-${max} safe characters`);
  return value;
}

function integer(value, name, min, max) {
  if (!/^\d+$/.test(value)) throw new TypeError(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new RangeError(`${name} must be between ${min} and ${max}`);
  return parsed;
}

function number(value, name, min, max) {
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(Number(value))) throw new TypeError(`${name} must be a number`);
  const parsed = Number(value);
  if (parsed < min || parsed > max) throw new RangeError(`${name} must be between ${min} and ${max}`);
  return parsed;
}
