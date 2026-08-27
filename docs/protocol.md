# Broker–Agent Protocol

## Executable alpha contracts

The first machine-readable contracts are published under
[`protocol/v0alpha1`](../protocol/v0alpha1/README.md). They cover workloads,
capabilities, offers, leases, grant-bound execution requests, results, and meter events. The alpha version is a
conformance and simulation surface; it has no backward-compatibility promise
before `v1`.

## Status

This document defines the intended contract. JSON Schema contracts exist for
Phase 0; protobuf and OpenAPI surfaces remain future work. Normative requirements
use MUST, MUST NOT, SHOULD, and MAY in their RFC 2119 sense.

## Versioning

- Every envelope MUST contain `protocol_version`.
- Major versions are incompatible.
- Unknown optional fields MUST be ignored.
- Unknown message types MUST fail closed.
- Capability negotiation MUST precede offers.

## Identity

Every agent and broker connection MUST be authenticated and encrypted. An
`agent_id` identifies an enrolled software identity, not merely a hostname.
Production identities SHOULD be short-lived and bound to node/workload evidence
where available.

## Envelope

```json
{
  "protocol_version": "0.1",
  "message_id": "01J...",
  "sent_at": "2026-08-26T12:00:00Z",
  "agent_id": "agent_fi_tampere_01",
  "type": "capacity_offer",
  "payload": {}
}
```

Messages whose security depends on freshness MUST reject clock skew beyond the
configured tolerance.

## Capability Declaration

```json
{
  "accelerators": [{
    "vendor": "nvidia",
    "model": "RTX_5060_LAPTOP",
    "count": 1,
    "memory_bytes": 8752062464
  }],
  "runtimes": [{"type": "ollama", "version": "0.33.0"}],
  "models": [{
    "id": "qwen2.5:7b",
    "revision": "immutable-runtime-identifier",
    "max_context_tokens": 4096,
    "warm": true
  }],
  "trust_class": "community",
  "regions": ["EU", "FI"]
}
```

Self-reported hardware is not proof of hardware or trust class.

## Capacity Offer

```json
{
  "offer_id": "offer_01J...",
  "valid_until": "2026-08-26T12:00:20Z",
  "model_id": "qwen2.5:7b",
  "free_slots": 1,
  "max_input_tokens": 3072,
  "max_output_tokens": 1024,
  "estimated_ttft_ms": 1800,
  "estimated_tokens_per_second": 18.5,
  "price": {
    "currency": "EUR",
    "input_per_million": "0.10",
    "output_per_million": "0.20"
  }
}
```

The broker MUST NOT schedule an expired offer. The agent MUST re-check local
capacity when accepting a lease; an offer is not a reservation.

## Lease Lifecycle

```text
requested -> offered -> accepted -> running -> completed
                       |          |-> failed
                       |          |-> cancelled
                       |-> expired
                       |-> rejected
```

Transitions MUST be idempotent by `lease_id` and monotonically versioned. Only
one accepted lease may consume a slot. The agent is the local authority for that
invariant; the broker is the network authority for assignment history.

## Execution Grant

After acceptance, the agent returns a short-lived, least-privilege grant scoped
to one lease, runtime, model, and deadline. It MUST NOT permit administration or
another workload.

## Bounded Remote Execution

The v0alpha1 data-plane slice sends one closed `execution-request` payload over
the authenticated provider connection. The request contains the grant, running
lease, and complete public or synthetic workload. The agent MUST bind all
provider, workload, lease, model, and deadline fields before invoking its
allowlisted runtime.

An identical retry for the same execution ID MUST return the cached in-flight or
terminal outcome. Reusing the ID with changed request data MUST fail closed. A
timeout or disconnect after dispatch leaves the outcome unknown and MUST NOT
trigger transparent execution on another provider.

## Meter Statement

```json
{
  "lease_id": "lease_01J...",
  "observation_point": "provider",
  "started_at": "2026-08-26T12:00:04Z",
  "completed_at": "2026-08-26T12:00:09Z",
  "input_tokens": 421,
  "output_tokens": 96,
  "first_token_ms": 1840,
  "runtime_ms": 5220,
  "model_revision": "immutable-runtime-identifier",
  "result_digest": "sha256:...",
  "signature": "base64url-signature"
}
```

Statements are evidence, not unquestionable truth. The broker reconciles
provider and gateway observations and flags material disagreement.

## Liveness

- Target heartbeat: every 10 seconds.
- Offer lifetime: 30 seconds or less.
- Missing heartbeats remove a node from new scheduling.
- Liveness loss MUST NOT silently decide a running job's result.
- The agent MUST enforce its deadline if the broker disappears.

## Privacy

Prompt and response bodies MUST NOT appear in capability, heartbeat, lease, or
other control-plane payloads, routine logs, meter metadata, or metrics. They may
appear only inside the authenticated execution request and terminal result
data-plane frames. Data-plane handling follows the selected trust class.
