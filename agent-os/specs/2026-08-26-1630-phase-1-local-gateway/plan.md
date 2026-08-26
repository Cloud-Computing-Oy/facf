# Phase 1 Local Gateway Plan

## Task 1: Save spec documentation

Outcome: Scope, decisions, references, and validation are reviewable before
implementation. Validation: `npm run check`.

## Task 2: Add request translation and response formatting

Outcome: Valid chat-completions requests become FACF workloads and completed
broker results become OpenAI-compatible responses.

Acceptance criteria:

- Only approved models, roles, data classes, and bounded inputs are accepted.
- The client cannot override tenant, trust, region, or price policy.
- Error bodies contain stable codes without prompt or response content.

Validation: focused gateway unit tests.

## Task 3: Add a loopback HTTP server

Outcome: `POST /v1/chat/completions` supports JSON and SSE-compatible output;
`GET /healthz` reports liveness.

Acceptance criteria:

- Default bind address is `127.0.0.1`.
- Unsupported paths and methods fail predictably.
- Request bodies and execution time are bounded.
- Disconnects and malformed JSON do not crash the process.

Validation: HTTP integration tests with an in-memory broker.

## Task 4: Document and verify

Outcome: Operators can run the local gateway without interpreting it as a
production or remotely safe deployment.

Validation: `npm test`, `npm run check`, and repository audit.

## Non-goals

- Remote exposure, authentication, mTLS, PostgreSQL, NATS, multi-tenancy,
  runtime-native token streaming, production deployment, or sensitive data.

## Compatibility and rollback

The gateway is additive and uses no migrations. Rollback is removal of the new
module, script, tests, and documentation.
