# Bounded Remote Execution Data Plane Plan

## Task 1: Save spec documentation

**Outcome:** Shaping, standards, references, scope, and verification gates are
preserved before implementation.

**Validation:** `npm run check` validates all repository documentation links.

## Task 2: Define the execution protocol

**Outcome:** A closed v0alpha1 execution-request schema and runtime validators
bind grant, lease, and workload fields. Result and meter validators enforce the
same correlation on the response.

**Acceptance criteria:** unknown fields, content-class violations, mismatched
lease/grant/workload identity, invalid deadlines, and malformed terminal
evidence fail closed.

**Validation:** protocol unit tests and `npm run check` pass with the new schema.

## Task 3: Transport execution over mTLS

**Outcome:** The broker sends one bounded execution request to an enrolled,
connected provider and correlates one terminal response. The agent authorizes
the short-lived grant, executes through its configured runtime, and returns a
validated result and meter.

**Acceptance criteria:** messages and pending requests are bounded; duplicate
identical execution is idempotent; changed replay is rejected; disconnect and
timeout settle all pending promises; tokens and bodies are absent from logs.

**Validation:** deterministic mTLS tests cover success, replay, mismatch,
oversize input, timeout, and disconnect.

## Task 4: Integrate with broker retry semantics

**Outcome:** A remote provider implements the existing provider contract by
negotiating a grant and dispatching execution. Failures before dispatch may
retry; unknown outcomes after dispatch stop retry and fallback.

**Acceptance criteria:** two known provider cells complete requests; a provider
that rejects before dispatch falls back to the next cell; a disconnect after
dispatch never starts a second execution.

**Validation:** broker and end-to-end tests prove each branch and reconcile the
returned lease, result, and meter identifiers.

## Task 5: Validate and release

**Outcome:** The complete branch passes targeted and full tests, documentation
and protocol checks, a real-base strict repository audit, CI, and Codex review
before squash merge.

**Validation:** `npm ci`, `npm test`, `npm run check`, `git diff --check`, strict
repo-auditor SARIF, GitHub Validate, and an independent final review.

## Non-goals

- Incremental token streaming or replay after client-visible output.
- NATS JetStream, OpenTelemetry dashboard, certificate automation, vLLM, or a
  public provider enrollment flow.
- Confidential, personal, legal, medical, or regulated workloads.
- A production-readiness, G2-complete, or SLA claim.

## Dependencies and compatibility

The slice uses Node.js core TLS and existing protocol/runtime code. It adds no
mandatory package. Existing heartbeat and lease messages remain compatible.

## Risks and rollback

The main risks are payload disclosure, replay, double execution, unbounded
buffers, and ambiguous failure. Closed validation, mTLS identity, idempotency,
hard bounds, and no-fallback unknown outcomes mitigate them. Rollback is a
normal code revert; there is no database migration or destructive state change.

## Unresolved decisions

Incremental streaming framing and the eventual gRPC/protobuf migration require
a later transport ADR. NATS is introduced only after this direct path is proven.
