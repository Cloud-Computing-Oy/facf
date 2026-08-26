# Agent Lease Grants — Shaping Notes

## Scope

Add the provider-side lease authority that accepts or rejects content-free lease
requests and issues a short-lived, least-privilege execution grant for one
provider, model, workload, and deadline.

## Decisions

- The provider agent, not the broker, is final authority for local slot use.
- Requests contain identifiers and policy metadata only; no prompt or result.
- Duplicate requests for the same lease are idempotent and return the same
  grant. A different lease cannot consume an occupied slot.
- Grants contain a cryptographically random bearer token, are never logged, and
  cannot outlive the requested lease or 30 seconds.
- This slice implements and tests agent semantics; mTLS message wiring follows
  separately.

## Context

- **Visuals:** None.
- **References:** lease schema, protocol lease lifecycle, and local LeaseStore.
- **Product alignment:** Establish local authority before remote execution.

## Standards Applied

No local standards index exists. Fail-closed validation, short lifetimes,
idempotency, single-slot exclusion, and content-free control messages apply.
