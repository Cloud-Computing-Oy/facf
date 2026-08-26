# FACF Protocol v0alpha1

This directory contains the first machine-readable FACF protocol contracts. It
is an alpha conformance surface, not a production or compatibility promise.

## Artifacts

- `workload.schema.json` — client requirements and policy boundary;
- `capability.schema.json` — provider hardware and runtime claims;
- `offer.schema.json` — short-lived capacity and price advertisement;
- `lease.schema.json` — bounded reservation and lifecycle state;
- `result.schema.json` — execution outcome without transport assumptions;
- `meter.schema.json` — privacy-safe usage evidence.

Examples in `fixtures/` are exercised by `npm test` and
`node scripts/check-protocol.mjs`.

The schemas use JSON Schema 2020-12. Runtime code also applies semantic checks
that are awkward to express portably, including trust ordering, lease ownership,
and the prohibition on prompt or output content in meter metadata.
