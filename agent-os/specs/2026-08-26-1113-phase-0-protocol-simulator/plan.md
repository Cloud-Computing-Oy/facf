# Phase 0 Protocol Simulator — Implementation Plan

## Task 1: Save spec documentation

**Outcome:** The implementation scope, constraints, references, and validation commands are preserved before code changes.

**Acceptance criteria:** This spec folder contains `plan.md`, `shape.md`, `standards.md`, and `references.md`.

**Validation:** `node scripts/check-docs.mjs`

## Task 2: Define versioned protocol artifacts

**Outcome:** Clients, brokers, and provider agents share machine-readable workload, capability, offer, lease, result, and meter contracts.

**Scope:** `protocol/v0alpha1/`, examples, schema index, conformance checks.

**Acceptance criteria:** Valid fixtures pass; missing identity, invalid state, negative pricing, and prompt-bearing meter data fail.

**Validation:** `npm test`

## Task 3: Implement deterministic broker core

**Outcome:** Mandatory policy filters produce a stable eligible-provider ranking and atomic leases prevent double allocation.

**Scope:** policy evaluation, scoring, lease store, scheduler, failure reasons.

**Acceptance criteria:** Tests cover model, region, trust, data class, price, capacity, tie-breaking, expiry, and double-allocation behavior.

**Validation:** `npm test`

## Task 4: Implement provider simulation and adapters

**Outcome:** A provider can advertise capacity, accept a bounded lease, execute a simulated whole workload, and emit privacy-safe metering; Ollama has a real HTTP adapter boundary.

**Scope:** provider simulator, Ollama adapter, fallback interface, execution orchestration.

**Acceptance criteria:** Success, provider loss, runtime failure, timeout, and fallback paths are deterministic and metered without prompt/output content.

**Validation:** `npm test`

## Task 5: Deliver a reproducible end-to-end demo

**Outcome:** One command demonstrates broker selection, laptop-style execution, signed-style meter evidence, and cloud fallback.

**Scope:** CLI, fixtures, operator output, README and docs updates.

**Acceptance criteria:** `npm run demo` exits zero and shows both local success and fallback scenarios without secrets.

**Validation:** `npm run demo && node scripts/check-docs.mjs`

## Task 6: Release through quality gates

**Outcome:** The implementation is audited, reviewed in a pull request, merged, released, and verified on the default branch.

**Acceptance criteria:** Tests and docs pass; strict diff audit reports no unaddressed critical/high findings; GitHub CI is green; the release points to the verified merge commit.

**Validation:** GitHub PR checks, release metadata, default-branch workflow, and clean local worktree.

## Non-goals

- production authentication, mTLS, SPIFFE, PostgreSQL, NATS, billing, or settlement;
- OpenAI-compatible streaming gateway;
- automatic public provider enrollment;
- sensitive workloads on ordinary providers;
- cross-provider tensor or layer parallelism;
- cryptocurrency or token payments.

## Dependencies and compatibility

- Requires Node.js 22 or newer; no package installation is required.
- Adds a new `v0alpha1` protocol with no backward-compatibility promise before `v1`.
- Phase 1 implementations may replace the simulator internals but must retain passing fixtures or explicitly version the protocol.

## Risks and rollback

- **Risk:** A simulator may be mistaken for production readiness. **Control:** prominent alpha and simulation status in CLI and documentation.
- **Risk:** Schema churn. **Control:** versioned directory and conformance fixtures.
- **Rollback:** Revert the feature commit; no databases, credentials, remote providers, or migrations are introduced.
