import assert from "node:assert/strict";
import test from "node:test";
import { ControlMessageError, ProviderRegistry } from "../src/control/provider-registry.js";

const clock = () => new Date("2026-08-26T14:00:00.000Z");
const capability = (overrides = {}) => ({ protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: "2026-08-26T14:00:20.000Z", ...overrides });
const envelope = (overrides = {}) => ({ protocolVersion: "v0alpha1", messageId: "msg-1", sentAt: "2026-08-26T14:00:00.000Z", agentId: "agent-1", type: "capability", payload: capability(), ...overrides });
const peer = { authorized: true, commonName: "agent-1", fingerprint256: "AA:BB" };

test("enrolled certificate identity creates short-lived presence", () => {
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1", fingerprint256: "AA:BB" }], clock });
  const accepted = registry.accept(peer, envelope());
  assert.equal(accepted.capability.providerId, "provider-1");
  assert.equal(registry.getActive().length, 1);
});

test("registry rejects unknown, mismatched, stale, and overlong presence", () => {
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1", fingerprint256: "AA:BB" }], clock });
  const cases = [
    [{ ...peer, authorized: false }, envelope(), "tls_unauthorized"],
    [{ ...peer, commonName: "agent-2" }, envelope(), "certificate_identity_mismatch"],
    [{ ...peer, fingerprint256: "CC:DD" }, envelope(), "certificate_fingerprint_mismatch"],
    [peer, envelope({ sentAt: "2026-08-26T13:58:00.000Z" }), "stale_message"],
    [peer, envelope({ payload: capability({ providerId: "provider-2" }) }), "provider_identity_mismatch"],
    [peer, envelope({ payload: capability({ expiresAt: "2026-08-26T14:01:00.000Z" }) }), "invalid_capability_expiry"]
  ];
  for (const [identity, message, code] of cases) assert.throws(() => registry.accept(identity, message), (error) => error instanceof ControlMessageError && error.code === code);
});

test("expired provider presence is not active", () => {
  let now = clock();
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }], clock: () => now });
  registry.accept(peer, envelope());
  now = new Date("2026-08-26T14:00:21.000Z");
  assert.deepEqual(registry.getActive(), []);
});

test("accepted control message cannot be replayed", () => {
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }], clock });
  registry.accept(peer, envelope());
  assert.throws(() => registry.accept(peer, envelope()), (error) => error instanceof ControlMessageError && error.code === "replayed_message");
});
