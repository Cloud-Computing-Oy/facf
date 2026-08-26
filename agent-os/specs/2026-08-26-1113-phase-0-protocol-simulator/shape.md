# Phase 0 Protocol Simulator — Shaping Notes

## Scope

Build the first executable FACF artifact: versioned protocol schemas, a deterministic policy-aware scheduler, atomic in-memory leases, a simulated provider agent, an Ollama HTTP adapter, a bounded fallback contract, and a reproducible end-to-end CLI demo.

## Decisions

- This is a simulation and conformance foundation, not a production network.
- Use Node.js 22 and JavaScript modules with no runtime dependencies so the repository is immediately executable in the current environment.
- Keep the protocol transport-neutral and make every state transition deterministic and testable.
- Route one complete workload to one provider cell; Petals-style cross-provider sharding remains deferred.
- Fail closed on missing policy, identity, capability, trust, or budget data.
- Never include prompt or output bodies in routine meter or audit events.
- Preserve the Phase 1 plan to implement the production broker and provider agent in Go.

## Context

- **Visuals:** None required; the existing FACF decision deck describes the commercial and architectural context.
- **References:** Existing FACF architecture, protocol, scheduling, trust, threat, and MVP documentation; the current CCO LLM Router and laptop worker are integration targets, not copied implementations.
- **Product alignment:** Implements the Phase 0 roadmap exit path and the first measurable whole-workload federation flow.

## Standards Applied

No indexed repository standards exist yet. The implementation follows the documented FACF protocol, trust, security, and whole-workload decisions.
