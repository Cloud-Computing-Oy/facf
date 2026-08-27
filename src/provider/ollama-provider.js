import { randomUUID } from "node:crypto";
import { validateMeter, validateOffer } from "../protocol/validate.js";
import { ProviderExecutionError } from "./simulator.js";

export class OllamaProvider {
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
    const messages = workload.input?.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new ProviderExecutionError("invalid_workload", "Ollama workloads require input.messages");
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
      metadata: { runtime: "ollama", model: workload.model, region: this.offer.region }
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
  if (value.num_predict !== undefined) {
    if (!Number.isInteger(value.num_predict) || value.num_predict < 1 || value.num_predict > 256) throw new ProviderExecutionError("invalid_workload", "num_predict must be an integer between 1 and 256");
    options.num_predict = value.num_predict;
  }
  if (value.temperature !== undefined) {
    if (!Number.isFinite(value.temperature) || value.temperature < 0 || value.temperature > 2) throw new ProviderExecutionError("invalid_workload", "temperature must be between 0 and 2");
    options.temperature = value.temperature;
  }
  return options;
}
