# ADR 0004: Node.js Reference Implementation

- Status: Accepted
- Date: 2026-08-26

## Context

`agent-os/product/tech-stack.md` commits Phase 1 to "Go for the reference
broker, gateway, and provider agent." The merged Phase 0/1 implementation
(PRs #1-9: protocol simulator, local Ollama gateway, mTLS provider control,
lease negotiation) is entirely Node.js. No Go code exists in the repository.
This drift was identified while scoping Postgres audit persistence
(`docs/superpowers/specs/2026-08-26-postgres-audit-persistence-design.md`)
and should be recorded rather than left implicit.

## Decision

The reference broker, gateway, and provider agent continue in Node.js.
Node's built-in `node:test`, `node:tls`, and `node:http` already cover the
Phase 0/1 surface without a framework, and switching languages now would
discard nine merged, tested PRs for no functional gain. `tech-stack.md`'s
Go commitment is retired for the reference implementation; a Go
implementation remains possible as an independent, protocol-conformant peer
under the same open protocol (see
[ADR 0003](0003-open-protocol-managed-network.md)), not as a replacement
for this one.

## Consequences

`agent-os/product/tech-stack.md`'s "Go for the reference broker, gateway,
and provider agent" line is superseded by this ADR for the reference
implementation; PostgreSQL, NATS JetStream, and the other Phase 1
tech-stack commitments are unaffected and still apply, starting with
Postgres audit persistence. Anyone building a second, protocol-conformant
implementation (Go or otherwise) should treat this repository's Node.js
code as the behavioral reference for conformance testing, not as an
example to port line-for-line.
