import { randomUUID } from "node:crypto";
import { validateLease } from "../protocol/validate.js";

const FINAL_STATES = new Set(["completed", "failed", "expired", "released"]);
const TRANSITIONS = {
  offered: new Set(["accepted", "expired", "released"]),
  accepted: new Set(["running", "expired", "released"]),
  running: new Set(["completed", "failed", "expired"])
};

export class LeaseConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "LeaseConflictError";
  }
}

export class LeaseStore {
  #leases = new Map();
  #activeByOffer = new Map();

  constructor({ clock = () => new Date(), idFactory = randomUUID, ttlMs = 30000 } = {}) {
    this.clock = clock;
    this.idFactory = idFactory;
    this.ttlMs = ttlMs;
  }

  acquire(workload, offer, attempt = 1) {
    this.expireStale();
    if (this.#activeByOffer.has(offer.offerId)) throw new LeaseConflictError(`offer ${offer.offerId} already has an active lease`);
    const issuedAt = this.clock();
    const lease = validateLease({
      protocolVersion: "v0alpha1",
      leaseId: this.idFactory(),
      workloadId: workload.workloadId,
      offerId: offer.offerId,
      providerId: offer.providerId,
      state: "offered",
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + this.ttlMs).toISOString(),
      attempt
    });
    this.#leases.set(lease.leaseId, lease);
    this.#activeByOffer.set(offer.offerId, lease.leaseId);
    return structuredClone(lease);
  }

  transition(leaseId, nextState) {
    const lease = this.#leases.get(leaseId);
    if (!lease) throw new LeaseConflictError(`unknown lease ${leaseId}`);
    // Reconcile expiry before validating the transition: without this, work that
    // finishes after the lease TTL could still move running -> completed and be
    // permanently recorded as successful, since "completed" is a terminal state
    // that later expiry reconciliation skips.
    if (!FINAL_STATES.has(lease.state) && Date.parse(lease.expiresAt) <= this.clock().getTime()) {
      lease.state = "expired";
      this.#activeByOffer.delete(lease.offerId);
      if (nextState === "expired") return structuredClone(lease);
    }
    if (!TRANSITIONS[lease.state]?.has(nextState)) throw new LeaseConflictError(`invalid lease transition ${lease.state} -> ${nextState}`);
    lease.state = nextState;
    if (FINAL_STATES.has(nextState)) this.#activeByOffer.delete(lease.offerId);
    return structuredClone(lease);
  }

  get(leaseId) {
    const lease = this.#leases.get(leaseId);
    return lease ? structuredClone(lease) : null;
  }

  expireStale() {
    const now = this.clock().getTime();
    for (const lease of this.#leases.values()) {
      if (!FINAL_STATES.has(lease.state) && Date.parse(lease.expiresAt) <= now) {
        lease.state = "expired";
        this.#activeByOffer.delete(lease.offerId);
      }
    }
  }
}
