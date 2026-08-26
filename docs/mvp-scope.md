# Closed Inference MVP Scope

## Current milestone

Phase 0 now has an executable deterministic simulator and v0alpha1 protocol
fixtures. This milestone validates whole-workload selection, lease exclusion,
provider failure, and cloud fallback semantics locally. It does not satisfy the
closed inference MVP or any production-readiness gate.

## Objective

Demonstrate that complete, non-sensitive LLM inference requests can be routed
reliably across independent provider cells with explicit policy, atomic leases,
measured service, and bounded fallback.

## Included

- Three to five manually approved providers.
- EU control plane and provider cells.
- Public and non-sensitive internal test data.
- Chat-completions compatible text inference and streaming.
- Ollama and vLLM runtime adapters.
- One request assigned to one provider cell.
- Heartbeats, capability offers, leases, cancellation, and completion reports.
- Static price cards and shadow EUR accounting.
- Operator availability windows and resource limits.
- Latency, throughput, error, queue, and capacity metrics.

## Excluded

- Personal, confidential, restricted, legal, medical, or regulated customer data.
- Anonymous community providers.
- Training and fine-tuning.
- Image, audio, and embedding workloads.
- Automated provider payouts.
- Cross-provider model parallelism.
- Confidential-compute claims.
- Customer service-level guarantees.

## Pilot Models

The exact model list is a milestone decision. Candidates require a compatible
licence, immutable revision, known tokenizer/chat template, repeatable benchmark
fixtures, and a runtime profile supported by at least two pilot providers.

The laptop prototype uses `qwen2.5:7b`; that does not automatically make it an
approved commercial-network model.

## Acceptance Criteria

1. A client completes streaming inference through two provider cells.
2. Removing a provider causes bounded pre-stream fallback without double work.
3. Concurrent lease attempts cannot allocate one slot twice.
4. Expired offers and leases are never selected.
5. Policy rejects an unsupported model, region, trust class, and data class.
6. Provider and gateway token counts reconcile within documented tolerance.
7. Prompt and response bodies are absent from default logs and metrics.
8. A provider can pause, drain, and disconnect without broker host access.
9. Installation, failure drills, and teardown are independently reproducible.

## Decision Gates

- **G0 — Specification:** protocol fixtures and threat model approved.
- **G1 — Simulation:** scheduler and lease invariants pass fault tests.
- **G2 — Private federation:** three known nodes pass conformance tests.
- **G3 — Measured pilot:** 30-day reliability and reconciliation complete.
- **G4 — Commercial pilot:** demand, margin, contracts, and responsibilities approved.
- **G5 — Expansion:** explicit approval before customer or community workloads.
