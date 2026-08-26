import { randomUUID } from "node:crypto";
import { rankOffers } from "./scheduler.js";
import { LeaseConflictError } from "./lease-store.js";
import { validateMeter, validateWorkload } from "../protocol/validate.js";

export class NoEligibleProviderError extends Error {
  constructor(rejected) {
    super("no eligible FACF provider and no fallback succeeded");
    this.name = "NoEligibleProviderError";
    this.rejected = rejected;
  }
}

export class Broker {
  constructor({ leaseStore, fallback = null, clock = () => new Date(), idFactory = randomUUID, maxAttempts = 2 } = {}) {
    if (!leaseStore) throw new TypeError("leaseStore is required");
    this.leaseStore = leaseStore;
    this.fallback = fallback;
    this.clock = clock;
    this.idFactory = idFactory;
    this.maxAttempts = maxAttempts;
  }

  async run(workload, offers, providers) {
    validateWorkload(workload);
    const ranking = rankOffers(workload, offers, this.clock());
    const failures = [];
    let attempt = 0;
    for (const candidate of ranking.eligible) {
      if (attempt >= this.maxAttempts) break;
      attempt += 1;
      let lease;
      try {
        lease = this.leaseStore.acquire(workload, candidate.offer, attempt);
        lease = this.leaseStore.transition(lease.leaseId, "accepted");
        lease = this.leaseStore.transition(lease.leaseId, "running");
        const provider = providers.get(candidate.offer.providerId);
        if (!provider) throw new Error("provider_not_connected");
        const execution = await provider.execute({ workload, lease });
        this.leaseStore.transition(lease.leaseId, "completed");
        return { route: "facf", providerId: candidate.offer.providerId, lease: this.leaseStore.get(lease.leaseId), ...execution, ranking };
      } catch (error) {
        failures.push({ providerId: candidate.offer.providerId, code: error.code ?? error.message ?? "execution_failed" });
        if (lease) {
          const current = this.leaseStore.get(lease.leaseId);
          if (current && current.state === "running") this.leaseStore.transition(lease.leaseId, "failed");
          else if (current && !["failed", "completed", "expired", "released"].includes(current.state)) this.leaseStore.transition(lease.leaseId, "released");
        }
        if (error instanceof LeaseConflictError) continue;
      }
    }
    if (this.fallback) return this.#runFallback(workload, ranking, failures);
    throw new NoEligibleProviderError([...ranking.rejected, ...failures]);
  }

  async #runFallback(workload, ranking, failures) {
    const startedAt = this.clock();
    const response = await this.fallback.execute(workload);
    if (!Number.isFinite(response.priceEur) || response.priceEur < 0 || response.priceEur > workload.maximumPriceEur) {
      throw new NoEligibleProviderError([...ranking.rejected, ...failures, { providerId: this.fallback.providerId, code: "fallback_price_not_allowed" }]);
    }
    const completedAt = this.clock();
    const meter = validateMeter({
      protocolVersion: "v0alpha1",
      meterId: this.idFactory(),
      workloadId: workload.workloadId,
      leaseId: `fallback:${workload.workloadId}`,
      providerId: this.fallback.providerId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      inputTokens: response.usage?.inputTokens ?? 0,
      outputTokens: response.usage?.outputTokens ?? 0,
      priceEur: response.priceEur,
      outcome: "fallback",
      metadata: { route: "fallback", provider: this.fallback.providerId, model: workload.model }
    });
    return { route: "fallback", providerId: this.fallback.providerId, result: { output: { text: response.text }, status: "completed" }, meter, ranking, failures };
  }
}
