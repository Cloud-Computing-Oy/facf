# Agent Lease Grants Plan

## Task 1: Save spec documentation

Validation: `npm run check`.

## Task 2: Define lease request and execution grant contracts

Outcome: strict v0alpha1 JSON schemas describe content-free requests and
least-privilege grants.

Validation: fixtures and protocol schema checks.

## Task 3: Implement provider-side lease authority

Outcome: an enrolled provider can accept one eligible lease, reject invalid or
overlapping requests, return an idempotent grant, release it, and expire it.

Validation: model/provider/capability/deadline, concurrency, idempotency,
token-redaction, release, and expiry tests.

## Task 4: Document and release

Validation: tests, checks, strict diff audit, CI, and merge.

## Non-goals

mTLS message wiring, prompts, runtime invocation, broker retries, persistent
leases, settlement, or production deployment.
