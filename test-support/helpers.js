export const fixedClock = () => new Date("2026-08-26T08:00:00.000Z");

export const workload = (overrides = {}) => ({
  protocolVersion: "v0alpha1",
  workloadId: "workload-1",
  tenantId: "tenant-1",
  model: "qwen2.5:7b",
  dataClass: "public",
  minimumTrustTier: "community",
  allowedRegions: ["FI"],
  maximumPriceEur: 0.05,
  timeoutMs: 5000,
  input: { messages: [{ role: "user", content: "hello" }] },
  ...overrides
});

export const offer = (overrides = {}) => ({
  protocolVersion: "v0alpha1",
  offerId: "offer-1",
  providerId: "provider-1",
  capabilityId: "capability-1",
  models: ["qwen2.5:7b"],
  region: "FI",
  trustTier: "community",
  dataClasses: ["public", "synthetic"],
  availableSlots: 1,
  priceEur: 0.01,
  estimatedLatencyMs: 100,
  qualityScore: 0.9,
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...overrides
});
