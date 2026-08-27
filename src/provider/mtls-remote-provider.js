import { validateOffer } from "../protocol/validate.js";

export class MtlsRemoteProvider {
  constructor({ offer, controlServer, clock = () => new Date(), leaseTimeoutMs = 5000 } = {}) {
    if (!controlServer?.requestLease || !controlServer?.requestExecution) throw new TypeError("controlServer with lease and execution transport is required");
    this.offer = validateOffer(structuredClone(offer));
    this.controlServer = controlServer;
    this.clock = clock;
    this.leaseTimeoutMs = leaseTimeoutMs;
    // The transport owns its timeout so it can distinguish a safe pre-dispatch
    // failure from an ambiguous post-dispatch outcome.
    this.executionTimeoutManaged = true;
  }

  advertise() { return structuredClone(this.offer); }

  async execute({ workload, lease }) {
    const remainingMs = Date.parse(lease.expiresAt) - this.clock().getTime();
    if (remainingMs <= 0) throw Object.assign(new Error("remote lease expired before negotiation"), { code: "lease_expired" });
    const grant = await this.controlServer.requestLease(this.offer.providerId, {
      protocolVersion: "v0alpha1",
      leaseId: lease.leaseId,
      workloadId: workload.workloadId,
      providerId: this.offer.providerId,
      capabilityId: this.offer.capabilityId,
      model: workload.model,
      issuedAt: lease.issuedAt,
      expiresAt: lease.expiresAt
    }, { timeoutMs: Math.max(1, Math.min(this.leaseTimeoutMs, remainingMs)) });
    return this.controlServer.requestExecution(this.offer.providerId, {
      protocolVersion: "v0alpha1",
      executionId: lease.leaseId,
      grant,
      lease,
      workload
    }, { timeoutMs: Math.max(1, Math.min(workload.timeoutMs, Date.parse(grant.expiresAt) - this.clock().getTime())) });
  }
}
