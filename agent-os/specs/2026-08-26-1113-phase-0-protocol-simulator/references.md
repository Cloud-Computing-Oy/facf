# References for Phase 0 Protocol Simulator

## Existing FACF design

- **Location:** `docs/architecture.md`, `docs/protocol.md`, `docs/scheduling.md`
- **Relevance:** Defines component boundaries, request lifecycle, policy filters, lease states, and failure semantics.
- **Key patterns:** Transport-neutral envelopes, short leases, deterministic scoring, whole-workload routing, and bounded fallback.

## CCO LLM Router and laptop worker

- **Location:** External integration maintained separately by Cloud Computing Oy.
- **Relevance:** First intended upstream router and provider node.
- **Key patterns:** Opportunistic laptop execution, explicit local limits, Ollama runtime, and cloud fallback.

## Petals

- **Location:** `https://github.com/bigscience-workshop/petals`
- **Relevance:** Demonstrates distributed layer-sharded inference over heterogeneous internet nodes.
- **Key patterns:** Dynamic block placement, routing, and failure-aware inference are research inputs for a later verified/private sharding mode, not the Phase 0 execution model.
