import { randomBytes, randomUUID } from "node:crypto";
import { validateExecutionGrant, validateLeaseRequest } from "../protocol/validate.js";

export class AgentLeaseError extends Error {
  constructor(code, message) { super(message); this.name = "AgentLeaseError"; this.code = code; }
}

export class AgentLeaseAuthority {
  #grants = new Map();
  #requests = new Map();
  #inFlight = new Set();

  constructor({ providerId, capabilityId, models, slots = 1, clock = () => new Date(), idFactory = randomUUID, tokenFactory = () => randomBytes(32).toString("base64url"), maxLeaseMs = 30000 } = {}) {
    if (!providerId || !capabilityId || !Array.isArray(models) || models.length < 1) throw new TypeError("providerId, capabilityId, and models are required");
    if (!Number.isInteger(slots) || slots < 1 || slots > 1024) throw new RangeError("slots must be between 1 and 1024");
    Object.assign(this, { providerId, capabilityId, slots, clock, idFactory, tokenFactory, maxLeaseMs });
    this.models = new Set(models);
  }

  request(value) {
    const request = validateLeaseRequest(structuredClone(value));
    this.#expire();
    const existing = this.#grants.get(request.leaseId);
    if (existing) {
      if (JSON.stringify(this.#requests.get(request.leaseId)) !== JSON.stringify(request)) throw new AgentLeaseError("idempotency_conflict", "leaseId was already used with different request data");
      return structuredClone(existing);
    }
    if (request.providerId !== this.providerId) throw new AgentLeaseError("provider_mismatch", "lease targets another provider");
    if (request.capabilityId !== this.capabilityId) throw new AgentLeaseError("capability_mismatch", "lease targets another capability");
    if (!this.models.has(request.model)) throw new AgentLeaseError("model_unavailable", "requested model is unavailable");
    const now = this.clock().getTime();
    const issuedAt = Date.parse(request.issuedAt);
    const expiresAt = Date.parse(request.expiresAt);
    if (issuedAt > now + 5000 || expiresAt <= now || expiresAt > now + this.maxLeaseMs) throw new AgentLeaseError("invalid_deadline", "lease deadline is invalid");
    if (this.#grants.size >= this.slots) throw new AgentLeaseError("capacity_unavailable", "provider has no free slots");
    const grant = validateExecutionGrant({ protocolVersion: "v0alpha1", grantId: this.idFactory(), token: this.tokenFactory(), leaseId: request.leaseId, workloadId: request.workloadId, providerId: request.providerId, model: request.model, scope: "execute:model", issuedAt: this.clock().toISOString(), expiresAt: request.expiresAt });
    this.#grants.set(request.leaseId, grant);
    this.#requests.set(request.leaseId, request);
    return structuredClone(grant);
  }

  authorize({ leaseId, token, model }) {
    this.#expire();
    const grant = this.#grants.get(leaseId);
    return Boolean(grant && timingSafeEqualText(grant.token, token) && grant.model === model && grant.scope === "execute:model");
  }

  authorizeGrant(value) {
    let candidate;
    try { candidate = validateExecutionGrant(structuredClone(value)); } catch { return false; }
    this.#expire();
    const grant = this.#grants.get(candidate.leaseId);
    if (!grant || !timingSafeEqualText(grant.token, candidate.token)) return false;
    for (const key of ["protocolVersion", "grantId", "leaseId", "workloadId", "providerId", "model", "scope", "issuedAt", "expiresAt"]) {
      if (grant[key] !== candidate[key]) return false;
    }
    return true;
  }

  start(leaseId) {
    if (!this.#grants.has(leaseId)) throw new AgentLeaseError("grant_unauthorized", "cannot start an unknown or expired grant");
    this.#inFlight.add(leaseId);
  }

  release(leaseId) { this.#inFlight.delete(leaseId); this.#requests.delete(leaseId); return this.#grants.delete(leaseId); }
  activeCount() { this.#expire(); return this.#grants.size; }
  #expire() { const now = this.clock().getTime(); for (const [leaseId, grant] of this.#grants) if (!this.#inFlight.has(leaseId) && Date.parse(grant.expiresAt) <= now) { this.#grants.delete(leaseId); this.#requests.delete(leaseId); } }
}

function timingSafeEqualText(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
