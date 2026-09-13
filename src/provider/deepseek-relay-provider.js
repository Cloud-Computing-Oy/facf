import { randomUUID } from "node:crypto";
import { validateMeter, validateOffer } from "../protocol/validate.js";
import { ProviderExecutionError } from "./simulator.js";

export class DeepSeekRelayProvider {
  constructor({ offer, adapter, clock = () => new Date(), idFactory = randomUUID } = {}) {
    if (!adapter) throw new TypeError("adapter is required");
    this.offer = validateOffer(structuredClone(offer));
    this.adapter = adapter;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  advertise() {
    return structuredClone(this.offer);
  }

  async execute({ workload, lease, signal, timeoutMs }) {
    if (lease.providerId !== this.offer.providerId || lease.offerId !== this.offer.offerId) throw new ProviderExecutionError("grant_mismatch", "lease is not bound to this provider offer");
    if (!this.offer.models.includes(workload.model)) throw new ProviderExecutionError("model_unavailable", "model is not available");
    if (workload.dataClass !== "public" && workload.dataClass !== "synthetic") throw new ProviderExecutionError("relay_dataclass_forbidden", "relay providers may only execute public or synthetic workloads");
    const messages = workload.input?.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new ProviderExecutionError("invalid_workload", "DeepSeek relay workloads require input.messages");
    const startedAt = this.clock();
    const response = await this.adapter.chat({ model: workload.model, messages, options: sanitizeOptions(workload.input.options), signal, timeoutMs });
    const completedAt = this.clock();
    const meter = validateMeter({
      protocolVersion: "v0alpha1",
      meterId: this.idFactory(),
      workloadId: workload.workloadId,
      leaseId: lease.leaseId,
      providerId: this.offer.providerId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      priceEur: this.offer.priceEur,
      outcome: "completed",
      metadata: { nodeType: "relay", relayUpstream: this.offer.relayUpstream, model: workload.model, region: this.offer.region }
    });
    return {
      result: {
        protocolVersion: "v0alpha1",
        workloadId: workload.workloadId,
        leaseId: lease.leaseId,
        providerId: this.offer.providerId,
        status: "completed",
        output: { text: response.text },
        completedAt: completedAt.toISOString()
      },
      meter
    };
  }
}

function sanitizeOptions(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProviderExecutionError("invalid_workload", "input.options must be an object");
  const options = {};
  if (value.max_tokens !== undefined) {
    if (!Number.isInteger(value.max_tokens) || value.max_tokens < 1 || value.max_tokens > 256) throw new ProviderExecutionError("invalid_workload", "max_tokens must be an integer between 1 and 256");
    options.max_tokens = value.max_tokens;
  }
  if (value.temperature !== undefined) {
    if (!Number.isFinite(value.temperature) || value.temperature < 0 || value.temperature > 2) throw new ProviderExecutionError("invalid_workload", "temperature must be between 0 and 2");
    options.temperature = value.temperature;
  }
  return options;
}
