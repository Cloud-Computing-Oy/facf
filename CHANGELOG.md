# Changelog

## Unreleased

- Add a bounded, grant-bound remote execution data-plane slice over the
  enrolled provider mTLS connection, including idempotency, hard message and
  pending-operation limits, two-cell fallback tests, and no replay after an
  ambiguous dispatch outcome.
- Add optional Postgres audit persistence for completed/failed leases and
  meter events, off by default and requiring no new mandatory dependency.
- Add a local-only OpenAI-compatible chat-completions gateway with bounded
  request translation, JSON and SSE response modes, safe errors, and tests.
- Add an explicitly enabled runnable local Ollama gateway that wires the broker,
  lease store, provider, dynamic offer, and HTTP boundary together.
- Add enrolled provider presence and outbound mTLS capability-heartbeat
  primitives with strict identity, freshness, size, and expiry boundaries.
- Add strict provider-side lease requests and short-lived, least-privilege
  execution grants with idempotency and local slot exclusion.
- Carry lease requests and grant/rejection decisions bidirectionally over the
  enrolled mTLS control channel with correlation, timeout, and binding checks.

All notable project changes will be recorded here.

## [Unreleased]

### Added

- v0alpha1 workload, capability, offer, lease, result, and meter schemas;
- deterministic policy-aware provider ranking and atomic in-memory leases;
- simulated provider execution, privacy-safe metering, and bounded fallback;
- an Ollama chat/provider boundary, explicit-consent live smoke test, and
  reproducible two-scenario deterministic demo;
- Node.js tests for policy, state transitions, retries, fallback, telemetry, and
  runtime error handling.

## [0.1.0] - 2026-08-26

### Added

- foundational product mission, roadmap, and technology choices;
- MVP, architecture, protocol, scheduling, trust, and threat documentation;
- provider and operator guidance;
- commercial strategy, network economics, control, licensing, and governance model;
- initial architecture decision records and contributor policies;
- automated validation for internal documentation links and required project files.
