# Runnable Local Ollama Gateway Plan

## Task 1: Save spec documentation

Validation: `npm run check`.

## Task 2: Add validated local runtime assembly

Outcome: one function constructs the broker, lease store, Ollama adapter,
provider, dynamic offer source, policy, and HTTP server from bounded config.

Acceptance criteria: invalid model, port, timeout, price, or URL fails before
listen; policy remains public/synthetic; offer expiry refreshes per request.

Validation: configuration and runtime assembly unit tests.

## Task 3: Add an explicitly enabled CLI

Outcome: an operator can run the vertical slice with `npm run gateway:local`.

Acceptance criteria: startup requires explicit consent, binds only to loopback,
prints no secrets, and handles SIGINT/SIGTERM cleanly.

Validation: CLI refusal test plus an HTTP integration test using a fake Ollama
endpoint.

## Task 4: Document and release

Validation: `npm test`, `npm run check`, strict diff audit, CI, and merge.

## Non-goals

Authentication, mTLS, public/LAN binding, PostgreSQL, NATS, multiple provider
agents, production deployment, and sensitive data.
