const TRUST_TIERS = ["community", "verified", "confidential", "private"];
const DATA_CLASSES = ["public", "synthetic", "internal", "confidential"];
const LEASE_STATES = ["offered", "accepted", "running", "completed", "failed", "expired", "released"];
const FORBIDDEN_METER_KEYS = new Set(["prompt", "input", "output", "messages", "response", "content"]);
const RUNTIMES = ["simulator", "ollama", "vllm"];

export class ProtocolValidationError extends Error {
  constructor(kind, issues) {
    super(`${kind} validation failed: ${issues.join("; ")}`);
    this.name = "ProtocolValidationError";
    this.kind = kind;
    this.issues = issues;
  }
}

function object(value, name, issues) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${name} must be an object`);
    return false;
  }
  return true;
}

function text(value, name, issues) {
  if (typeof value !== "string" || value.length === 0) issues.push(`${name} must be a non-empty string`);
}

function finite(value, name, issues, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum) issues.push(`${name} must be a number >= ${minimum}`);
}

function date(value, name, issues) {
  text(value, name, issues);
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) issues.push(`${name} must be an ISO date-time`);
}

function version(value, issues) {
  if (value !== "v0alpha1") issues.push("protocolVersion must be v0alpha1");
}

function stringArray(value, name, issues, allowed) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${name} must be a non-empty array`);
    return;
  }
  if (new Set(value).size !== value.length) issues.push(`${name} must not contain duplicates`);
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) issues.push(`${name} entries must be non-empty strings`);
    if (allowed && !allowed.includes(item)) issues.push(`${name} contains unsupported value ${item}`);
  }
}

function finish(kind, issues) {
  if (issues.length) throw new ProtocolValidationError(kind, issues);
}

function exactKeys(value, allowed, issues) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`unknown field ${key}`);
}

export function validateWorkload(value) {
  const issues = [];
  if (!object(value, "workload", issues)) finish("workload", issues);
  version(value.protocolVersion, issues);
  for (const key of ["workloadId", "tenantId", "model"]) text(value[key], key, issues);
  if (!DATA_CLASSES.includes(value.dataClass)) issues.push("dataClass is unsupported");
  if (!TRUST_TIERS.includes(value.minimumTrustTier)) issues.push("minimumTrustTier is unsupported");
  stringArray(value.allowedRegions, "allowedRegions", issues);
  finite(value.maximumPriceEur, "maximumPriceEur", issues);
  if (!Number.isInteger(value.timeoutMs) || value.timeoutMs < 100 || value.timeoutMs > 300000) issues.push("timeoutMs must be an integer between 100 and 300000");
  object(value.input, "input", issues);
  finish("workload", issues);
  return value;
}

export function validateOffer(value) {
  const issues = [];
  if (!object(value, "offer", issues)) finish("offer", issues);
  version(value.protocolVersion, issues);
  for (const key of ["offerId", "providerId", "capabilityId", "region"]) text(value[key], key, issues);
  stringArray(value.models, "models", issues);
  stringArray(value.dataClasses, "dataClasses", issues, DATA_CLASSES);
  if (!TRUST_TIERS.includes(value.trustTier)) issues.push("trustTier is unsupported");
  if (!Number.isInteger(value.availableSlots) || value.availableSlots < 0) issues.push("availableSlots must be an integer >= 0");
  finite(value.priceEur, "priceEur", issues);
  if (!Number.isInteger(value.estimatedLatencyMs) || value.estimatedLatencyMs < 0) issues.push("estimatedLatencyMs must be an integer >= 0");
  finite(value.qualityScore, "qualityScore", issues);
  if (Number.isFinite(value.qualityScore) && value.qualityScore > 1) issues.push("qualityScore must be <= 1");
  date(value.expiresAt, "expiresAt", issues);
  finish("offer", issues);
  return value;
}

export function validateCapability(value) {
  const issues = [];
  if (!object(value, "capability", issues)) finish("capability", issues);
  exactKeys(value, ["protocolVersion", "providerId", "capabilityId", "models", "runtime", "region", "trustTier", "slots", "expiresAt"], issues);
  version(value.protocolVersion, issues);
  for (const key of ["providerId", "capabilityId", "region"]) text(value[key], key, issues);
  stringArray(value.models, "models", issues);
  if (!RUNTIMES.includes(value.runtime)) issues.push("runtime is unsupported");
  if (!TRUST_TIERS.includes(value.trustTier)) issues.push("trustTier is unsupported");
  if (!Number.isInteger(value.slots) || value.slots < 1 || value.slots > 1024) issues.push("slots must be an integer between 1 and 1024");
  date(value.expiresAt, "expiresAt", issues);
  finish("capability", issues);
  return value;
}

export function validateLeaseRequest(value) {
  const issues = [];
  if (!object(value, "leaseRequest", issues)) finish("leaseRequest", issues);
  exactKeys(value, ["protocolVersion", "leaseId", "workloadId", "providerId", "capabilityId", "model", "issuedAt", "expiresAt"], issues);
  version(value.protocolVersion, issues);
  for (const key of ["leaseId", "workloadId", "providerId", "capabilityId", "model"]) text(value[key], key, issues);
  date(value.issuedAt, "issuedAt", issues); date(value.expiresAt, "expiresAt", issues);
  finish("leaseRequest", issues); return value;
}

export function validateExecutionGrant(value) {
  const issues = [];
  if (!object(value, "executionGrant", issues)) finish("executionGrant", issues);
  exactKeys(value, ["protocolVersion", "grantId", "token", "leaseId", "workloadId", "providerId", "model", "scope", "issuedAt", "expiresAt"], issues);
  version(value.protocolVersion, issues);
  for (const key of ["grantId", "token", "leaseId", "workloadId", "providerId", "model"]) text(value[key], key, issues);
  if (typeof value.token === "string" && value.token.length < 43) issues.push("token must contain at least 256 bits encoded as base64url");
  if (value.scope !== "execute:model") issues.push("scope must be execute:model");
  date(value.issuedAt, "issuedAt", issues); date(value.expiresAt, "expiresAt", issues);
  finish("executionGrant", issues); return value;
}

export function validateLease(value) {
  const issues = [];
  if (!object(value, "lease", issues)) finish("lease", issues);
  version(value.protocolVersion, issues);
  for (const key of ["leaseId", "workloadId", "offerId", "providerId"]) text(value[key], key, issues);
  if (!LEASE_STATES.includes(value.state)) issues.push("state is unsupported");
  date(value.issuedAt, "issuedAt", issues);
  date(value.expiresAt, "expiresAt", issues);
  if (!Number.isInteger(value.attempt) || value.attempt < 1) issues.push("attempt must be an integer >= 1");
  finish("lease", issues);
  return value;
}

function inspectMeterMetadata(value, path, issues) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_METER_KEYS.has(key.toLowerCase())) issues.push(`${path}.${key} may contain workload content`);
    inspectMeterMetadata(child, `${path}.${key}`, issues);
  }
}

export function validateMeter(value) {
  const issues = [];
  if (!object(value, "meter", issues)) finish("meter", issues);
  exactKeys(value, ["protocolVersion", "meterId", "workloadId", "leaseId", "providerId", "startedAt", "completedAt", "durationMs", "inputTokens", "outputTokens", "priceEur", "outcome", "metadata"], issues);
  version(value.protocolVersion, issues);
  for (const key of ["meterId", "workloadId", "leaseId", "providerId"]) text(value[key], key, issues);
  for (const key of ["startedAt", "completedAt"]) date(value[key], key, issues);
  for (const key of ["durationMs", "inputTokens", "outputTokens", "priceEur"]) finite(value[key], key, issues);
  if (!Number.isInteger(value.durationMs) || !Number.isInteger(value.inputTokens) || !Number.isInteger(value.outputTokens)) issues.push("duration and token counters must be integers");
  if (!["completed", "failed", "fallback"].includes(value.outcome)) issues.push("outcome is unsupported");
  if (object(value.metadata, "metadata", issues)) inspectMeterMetadata(value.metadata, "metadata", issues);
  finish("meter", issues);
  return value;
}

export const protocolConstants = Object.freeze({
  trustTiers: [...TRUST_TIERS],
  dataClasses: [...DATA_CLASSES],
  leaseStates: [...LEASE_STATES]
});
