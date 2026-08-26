#!/usr/bin/env node
import { Broker } from "../core/broker.js";
import { LeaseStore } from "../core/lease-store.js";
import { OllamaAdapter } from "../provider/ollama-adapter.js";
import { OllamaProvider } from "../provider/ollama-provider.js";

if (process.env.FACF_LIVE_DEMO !== "1") {
  console.error("Refusing live execution. Set FACF_LIVE_DEMO=1 after confirming the workload is public or synthetic.");
  process.exitCode = 2;
} else {
  const model = process.env.FACF_OLLAMA_MODEL || "qwen2.5:7b";
  const baseUrl = process.env.FACF_OLLAMA_URL || "http://127.0.0.1:11434";
  const providerId = process.env.FACF_PROVIDER_ID || "provider-local-ollama";
  const offer = {
    protocolVersion: "v0alpha1",
    offerId: "offer-live-ollama",
    providerId,
    capabilityId: "capability-live-ollama",
    models: [model],
    region: "FI",
    trustTier: "community",
    dataClasses: ["public", "synthetic"],
    availableSlots: 1,
    priceEur: 0,
    estimatedLatencyMs: 500,
    qualityScore: 0.8,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  };
  const workload = {
    protocolVersion: "v0alpha1",
    workloadId: `live-${Date.now()}`,
    tenantId: "facf-local-demo",
    model,
    dataClass: "synthetic",
    minimumTrustTier: "community",
    allowedRegions: ["FI"],
    maximumPriceEur: 0,
    timeoutMs: 120000,
    input: {
      messages: [{ role: "user", content: "This is a synthetic FACF connectivity test. Reply with exactly: FACF LIVE OK" }],
      options: { num_predict: 16, temperature: 0 }
    }
  };
  const adapter = new OllamaAdapter({ baseUrl, timeoutMs: workload.timeoutMs });
  const provider = new OllamaProvider({ offer, adapter });
  const broker = new Broker({ leaseStore: new LeaseStore({ ttlMs: workload.timeoutMs + 5000 }), maxAttempts: 1 });
  const execution = await broker.run(workload, [provider.advertise()], new Map([[providerId, provider]]));
  console.log(JSON.stringify({
    status: "live_execution_completed",
    route: execution.route,
    providerId: execution.providerId,
    model,
    output: execution.result.output.text,
    leaseState: execution.lease.state,
    meter: execution.meter
  }, null, 2));
  // This command is a one-shot smoke test. Explicit exit avoids environment-
  // specific HTTP keep-alive handles delaying completion after the response.
  process.exit(0);
}
