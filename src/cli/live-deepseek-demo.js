#!/usr/bin/env node
import { Broker } from "../core/broker.js";
import { LeaseStore } from "../core/lease-store.js";
import { DeepSeekRelayAdapter } from "../provider/deepseek-relay-adapter.js";
import { DeepSeekRelayProvider } from "../provider/deepseek-relay-provider.js";

if (process.env.FACF_LIVE_RELAY_DEMO !== "1") {
  console.error("Refusing live execution. Set FACF_LIVE_RELAY_DEMO=1 after confirming the workload is public or synthetic.");
  process.exitCode = 2;
} else if (!process.env.FACF_DEEPSEEK_API_KEY) {
  console.error("Refusing live execution. Set FACF_DEEPSEEK_API_KEY to a dedicated DeepSeek API key for this relay node.");
  process.exitCode = 2;
} else {
  const model = process.env.FACF_DEEPSEEK_MODEL || "deepseek-chat";
  const baseUrl = process.env.FACF_DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const providerId = process.env.FACF_PROVIDER_ID || "provider-deepseek-relay";
  // DeepSeek's API does not publish a guaranteed execution region, and it is not
  // EU-hosted by default, so this must never default to a claim like "EU" that the
  // scheduler's EU-only region policies would treat as a real, verifiable location.
  // Set FACF_DEEPSEEK_REGION only if the configured endpoint's actual region is known.
  const region = process.env.FACF_DEEPSEEK_REGION || "GLOBAL";
  const offer = {
    protocolVersion: "v0alpha1",
    offerId: "offer-live-deepseek-relay",
    providerId,
    capabilityId: "capability-live-deepseek-relay",
    models: [model],
    region,
    trustTier: "community",
    dataClasses: ["public", "synthetic"],
    nodeType: "relay",
    relayUpstream: "deepseek",
    availableSlots: 1,
    priceEur: 0,
    estimatedLatencyMs: 800,
    qualityScore: 0.8,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  };
  const workload = {
    protocolVersion: "v0alpha1",
    workloadId: `live-relay-${Date.now()}`,
    tenantId: "facf-local-relay-demo",
    model,
    dataClass: "synthetic",
    minimumTrustTier: "community",
    allowedRegions: [region],
    maximumPriceEur: 0,
    timeoutMs: 120000,
    input: {
      messages: [{ role: "user", content: "This is a synthetic FACF relay connectivity test. Reply with exactly: FACF RELAY OK" }],
      options: { max_tokens: 16, temperature: 0 }
    }
  };
  const adapter = new DeepSeekRelayAdapter({ apiKey: process.env.FACF_DEEPSEEK_API_KEY, baseUrl, timeoutMs: workload.timeoutMs });
  const provider = new DeepSeekRelayProvider({ offer, adapter });
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
