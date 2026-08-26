import { randomUUID } from "node:crypto";
import { validateMeter, validateOffer } from "../protocol/validate.js";

export class ProviderExecutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderExecutionError";
    this.code = code;
  }
}

export class SimulatedProvider {
  constructor({ offer, responseText = "FACF simulated response", failureCode = null, clock = () => new Date(), idFactory = randomUUID } = {}) {
    this.offer = validateOffer(structuredClone(offer));
    this.responseText = responseText;
    this.failureCode = failureCode;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  advertise() {
    return structuredClone(this.offer);
  }

  async execute({ workload, lease }) {
    if (lease.providerId !== this.offer.providerId || lease.offerId !== this.offer.offerId) throw new ProviderExecutionError("grant_mismatch", "lease is not bound to this provider offer");
    if (!this.offer.models.includes(workload.model)) throw new ProviderExecutionError("model_unavailable", "model is not available");
    const startedAt = this.clock();
    if (this.failureCode) throw new ProviderExecutionError(this.failureCode, `simulated provider failure: ${this.failureCode}`);
    const completedAt = this.clock();
    const inputTokens = estimateTokens(JSON.stringify(workload.input));
    const outputTokens = estimateTokens(this.responseText);
    const meter = validateMeter({
      protocolVersion: "v0alpha1",
      meterId: this.idFactory(),
      workloadId: workload.workloadId,
      leaseId: lease.leaseId,
      providerId: this.offer.providerId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      inputTokens,
      outputTokens,
      priceEur: this.offer.priceEur,
      outcome: "completed",
      metadata: { runtime: "simulator", model: workload.model, region: this.offer.region }
    });
    return {
      result: {
        protocolVersion: "v0alpha1",
        workloadId: workload.workloadId,
        leaseId: lease.leaseId,
        providerId: this.offer.providerId,
        status: "completed",
        output: { text: this.responseText },
        completedAt: completedAt.toISOString()
      },
      meter
    };
  }
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(text.length / 4));
}
