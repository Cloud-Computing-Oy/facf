import { randomUUID } from "node:crypto";
import { evaluatePolicy, rankOffers } from "./scheduler.js";
import { LeaseConflictError } from "./lease-store.js";
import { validateMeter, validateWorkload } from "../protocol/validate.js";

export class NoEligibleProviderError extends Error {
  constructor(rejected) {
    super("no eligible FACF provider and no fallback succeeded");
    this.name = "NoEligibleProviderError";
    this.rejected = rejected;
  }
}

// workload.timeoutMs is validated but was never enforced anywhere: a hung provider,
// simulator, or fallback previously blocked retries and fallback indefinitely.
function withTimeout(promise, timeoutMs, code) {
  promise.catch(() => {});
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("workload execution timed out"), { code })), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

export class Broker {
  constructor({ leaseStore, fallback = null, clock = () => new Date(), idFactory = randomUUID, maxAttempts = 2 } = {}) {
    if (!leaseStore) throw new TypeError("leaseStore is required");
    if (fallback) {
      const capability = fallback.capability;
      if (!capability || typeof capability.region !== "string" || typeof capability.trustTier !== "string" || !Array.isArray(capability.dataClasses)) {
        throw new TypeError("fallback.capability with region, trustTier, and dataClasses is required to authorize fallback routing");
      }
      if (capability.maxPriceEur !== undefined && (!Number.isFinite(capability.maxPriceEur) || capability.maxPriceEur < 0)) {
        throw new TypeError("fallback.capability.maxPriceEur must be a non-negative finite number");
      }
    }
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
      // Eligibility (including offer expiry) was computed once at the start of run();
      // an earlier attempt can take long enough for a later candidate's offer to have
      // expired by the time we get to it, so recheck immediately before acquiring it.
      if (Date.parse(candidate.offer.expiresAt) <= this.clock().getTime()) {
        failures.push({ providerId: candidate.offer.providerId, code: "offer_expired" });
        continue;
      }
      let lease;
      try {
        lease = this.leaseStore.acquire(workload, candidate.offer, attempt);
        lease = this.leaseStore.transition(lease.leaseId, "accepted");
        lease = this.leaseStore.transition(lease.leaseId, "running");
        const provider = providers.get(candidate.offer.providerId);
        if (!provider) throw new Error("provider_not_connected");
        const execution = await withTimeout(provider.execute({ workload, lease }), workload.timeoutMs, "execution_timeout");
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
    const capability = this.fallback.capability;
    const reasons = evaluatePolicy(workload, {
      region: capability.region,
      trustTier: capability.trustTier,
      dataClasses: capability.dataClasses,
      priceEur: capability.maxPriceEur
    });
    if (reasons.length > 0) {
      const code = reasons.includes("price_exceeds_budget") ? "fallback_price_not_allowed" : `fallback_${reasons[0]}`;
      throw new NoEligibleProviderError([...ranking.rejected, ...failures, { providerId: this.fallback.providerId, code }]);
    }
    const startedAt = this.clock();
    const response = await withTimeout(this.fallback.execute(workload), workload.timeoutMs, "fallback_execution_timeout");
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
