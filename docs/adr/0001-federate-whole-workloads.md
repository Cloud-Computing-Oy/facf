# ADR 0001: Federate Whole Workloads

- Status: Accepted
- Date: 2026-08-26

## Context

Internet-connected providers have heterogeneous accelerators, bandwidth, latency, availability, and trust. Splitting every model layer or tensor operation between unrelated hosts would make the critical path dependent on all of those links.

## Decision

FACF initially assigns a complete inference request or bounded batch to one compatible execution cell. A cell may use its own tightly coupled cluster internally.

## Consequences

This design supports heterogeneous providers, simple leases, bounded retries, and clearer privacy boundaries. It does not make independently owned GPUs behave like one low-latency accelerator, and very large models still require a suitably capable cell.
