import { validateCapability } from "../protocol/validate.js";

export class ControlMessageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ControlMessageError";
    this.code = code;
  }
}

export class ProviderRegistry {
  #enrollments;
  #presence = new Map();
  #seenMessages = new Map();

  constructor({ enrollments = [], clock = () => new Date(), maxClockSkewMs = 30000 } = {}) {
    this.clock = clock;
    this.maxClockSkewMs = maxClockSkewMs;
    this.#enrollments = new Map(enrollments.map((entry) => [entry.agentId, structuredClone(entry)]));
  }

  accept(peer, envelope) {
    if (!peer?.authorized) throw new ControlMessageError("tls_unauthorized", "client certificate is not authorized");
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new ControlMessageError("invalid_envelope", "control envelope must be an object");
    const allowed = new Set(["protocolVersion", "messageId", "sentAt", "agentId", "type", "payload"]);
    if (Object.keys(envelope).some((key) => !allowed.has(key))) throw new ControlMessageError("unknown_field", "control envelope contains an unknown field");
    if (envelope.protocolVersion !== "v0alpha1" || envelope.type !== "capability") throw new ControlMessageError("unsupported_message", "unsupported control message");
    if (typeof envelope.messageId !== "string" || envelope.messageId.length < 1 || envelope.messageId.length > 128) throw new ControlMessageError("invalid_message_id", "messageId is invalid");
    const sentAt = Date.parse(envelope.sentAt);
    const now = this.clock().getTime();
    if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > this.maxClockSkewMs) throw new ControlMessageError("stale_message", "control message is outside the freshness window");
    for (const [messageId, expiresAt] of this.#seenMessages) if (expiresAt <= now) this.#seenMessages.delete(messageId);
    if (this.#seenMessages.has(envelope.messageId)) throw new ControlMessageError("replayed_message", "control message was already accepted");
    const enrollment = this.#enrollments.get(envelope.agentId);
    if (!enrollment) throw new ControlMessageError("agent_not_enrolled", "agent is not enrolled");
    if (peer.commonName !== envelope.agentId) throw new ControlMessageError("certificate_identity_mismatch", "certificate identity does not match agentId");
    if (enrollment.fingerprint256 && enrollment.fingerprint256 !== peer.fingerprint256) throw new ControlMessageError("certificate_fingerprint_mismatch", "certificate fingerprint does not match enrollment");
    const capability = validateCapability(structuredClone(envelope.payload));
    if (capability.providerId !== enrollment.providerId) throw new ControlMessageError("provider_identity_mismatch", "providerId does not match enrollment");
    const expiresAt = Date.parse(capability.expiresAt);
    if (expiresAt <= now || expiresAt > now + 30000) throw new ControlMessageError("invalid_capability_expiry", "capability expiry must be within 30 seconds");
    this.#seenMessages.set(envelope.messageId, now + this.maxClockSkewMs);
    this.#presence.set(capability.providerId, { agentId: envelope.agentId, capability, lastMessageId: envelope.messageId, lastSeenAt: this.clock().toISOString() });
    return structuredClone(this.#presence.get(capability.providerId));
  }

  getActive() {
    const now = this.clock().getTime();
    return [...this.#presence.values()].filter((entry) => Date.parse(entry.capability.expiresAt) > now).map((entry) => structuredClone(entry));
  }
}
