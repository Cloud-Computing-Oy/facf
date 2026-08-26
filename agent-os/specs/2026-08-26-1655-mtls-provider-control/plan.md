# mTLS Provider Control Plan

## Task 1: Save spec documentation

Validation: `npm run check`.

## Task 2: Add enrolled provider registry

Outcome: authenticated capability heartbeats create short-lived provider
presence only when certificate identity, enrollment, message freshness, and
provider identity agree.

Validation: identity, expiry, replay/freshness, and unknown-provider tests.

## Task 3: Add mTLS control server and agent sender

Outcome: a provider opens an outbound mutually authenticated TLS connection and
sends bounded capability heartbeats; the broker acknowledges accepted messages.

Validation: ephemeral-CA integration test plus unauthorized-client rejection.

## Task 4: Document and release

Validation: tests, protocol/docs checks, strict diff audit, CI, and merge.

## Non-goals

Remote workload execution, prompts, leases over the wire, reconnect backoff,
certificate issuance/rotation service, public enrollment, PostgreSQL, or NATS.
