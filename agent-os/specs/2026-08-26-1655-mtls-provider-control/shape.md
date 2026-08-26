# mTLS Provider Control — Shaping Notes

## Scope

Add the first authenticated broker–agent control-plane slice: an outbound mTLS
connection carries capability heartbeats into an enrolled provider registry.
No workload or prompt content crosses this channel.

## Decisions

- A CA-valid certificate is necessary but not sufficient: certificate CN and
  optional SHA-256 fingerprint must match a manual enrollment record.
- Only the `capability` message type is accepted in this slice.
- Messages are newline-delimited JSON, freshness-bounded, size-bounded, and
  fail closed on unknown fields or identities.
- Capability expiry is at most 30 seconds; missing refresh removes scheduling
  eligibility.
- The Node implementation is an alpha protocol proof. The roadmap's Go
  reference agent remains a later milestone.

## Context

- **Visuals:** None.
- **References:** `docs/protocol.md` and the v0alpha1 capability schema.
- **Product alignment:** Identity and liveness are proven before remote data
  plane execution.

## Standards Applied

No local standards index exists. Existing mTLS, fail-closed, short-lived offer,
no-content telemetry, and dependency-free test conventions apply.
