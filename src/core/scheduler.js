import { protocolConstants, validateOffer, validateWorkload } from "../protocol/validate.js";

const trustRank = new Map(protocolConstants.trustTiers.map((tier, index) => [tier, index]));

// Shared by offer eligibility and fallback authorization so both routes enforce
// the same region/trust-tier/data-class/price policy from the workload.
export function evaluatePolicy(workload, { region, trustTier, dataClasses, priceEur } = {}) {
  const reasons = [];
  const regionAllowed = workload.allowedRegions.includes(region) || (workload.allowedRegions.includes("EU") && EU_REGIONS.has(region));
  if (!regionAllowed) reasons.push("region_not_allowed");
  if ((trustRank.get(trustTier) ?? -1) < (trustRank.get(workload.minimumTrustTier) ?? Infinity)) reasons.push("trust_tier_too_low");
  if (!dataClasses.includes(workload.dataClass)) reasons.push("data_class_not_allowed");
  if (priceEur !== undefined && priceEur > workload.maximumPriceEur) reasons.push("price_exceeds_budget");
  return reasons;
}

export function evaluateEligibility(workload, offer, now = new Date()) {
  validateWorkload(workload);
  validateOffer(offer);
  const reasons = [];
  if (!offer.models.includes(workload.model)) reasons.push("model_not_available");
  reasons.push(...evaluatePolicy(workload, { region: offer.region, trustTier: offer.trustTier, dataClasses: offer.dataClasses, priceEur: offer.priceEur }));
  if (offer.availableSlots < 1) reasons.push("no_available_slots");
  if (Date.parse(offer.expiresAt) <= now.getTime()) reasons.push("offer_expired");
  return { eligible: reasons.length === 0, reasons };
}

const EU_REGIONS = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);

export function scoreOffer(workload, offer) {
  const priceHeadroom = workload.maximumPriceEur === 0 ? (offer.priceEur === 0 ? 1 : 0) : 1 - offer.priceEur / workload.maximumPriceEur;
  const latencyScore = 1 / (1 + offer.estimatedLatencyMs / 1000);
  const trustScore = (trustRank.get(offer.trustTier) + 1) / protocolConstants.trustTiers.length;
  return Number((offer.qualityScore * 0.45 + priceHeadroom * 0.25 + latencyScore * 0.2 + trustScore * 0.1).toFixed(9));
}

export function rankOffers(workload, offers, now = new Date()) {
  const evaluated = offers.map((offer) => {
    const eligibility = evaluateEligibility(workload, offer, now);
    return { offer, ...eligibility, score: eligibility.eligible ? scoreOffer(workload, offer) : null };
  });
  const eligible = evaluated.filter((item) => item.eligible).sort((left, right) =>
    right.score - left.score || left.offer.providerId.localeCompare(right.offer.providerId) || left.offer.offerId.localeCompare(right.offer.offerId)
  );
  return { eligible, rejected: evaluated.filter((item) => !item.eligible) };
}
