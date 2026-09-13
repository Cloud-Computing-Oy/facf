# ADR 0005: Relay Node Type

- Status: Accepted
- Date: 2026-09-13

## Context

A pilot idea proposed routing a FACF "provider" entirely through a
third-party cloud LLM API (starting with DeepSeek) instead of independently
owned idle hardware, to get a working node without needing physical GPU
capacity. Blending this into the existing compute-provider concept
(`runtime: ollama|vllm`) would contradict the project's core claim —
federating fragmented, independently owned idle hardware, as opposed to "a
small number of centralised providers" (README, "Why FACF?") — and the
"Measured claims" principle: a relay node proves nothing about hardware
federation, carries a different data-residency profile (execution leaves
EU-controlled infrastructure), and risks the third-party API's own terms of
service on reselling or proxying access.

## Decision

Relay nodes are a distinct, explicitly disclosed `nodeType: relay`, separate
from `nodeType: compute`. Relay offers are structurally restricted to
`public`/`synthetic` dataClasses regardless of trustTier, must declare their
`relayUpstream`, and every execution's meter event discloses
`nodeType`/`relayUpstream`. Relay nodes do not count toward the roadmap's
Phase 1 "2-3 verified EU providers" pilot exit gate. The first relay upstream
is DeepSeek, accessed via a dedicated API key provisioned for this purpose,
never the operator's shared internal key.

## Consequences

The pilot can demonstrate broker, scheduler, and gateway plumbing end to end
without waiting on physical provider onboarding, without diluting the
evidentiary claims the pilot exists to produce. Future relay upstreams extend
the `relayUpstream` enum without a protocol version change. mTLS/remote-
provider wiring for relay nodes, and any commercial or accounting treatment
distinct from compute nodes, remain open follow-up decisions.
