# Standards for Relay Node Type

No Agent OS standards index exists in this repository. These existing
project rules apply:

- Protocol payloads are closed/exact-key objects, validated by the
  hand-written runtime validators in `src/protocol/validate.js` (the
  `protocol/v0alpha1/*.schema.json` files are the documentation/conformance
  contract, kept in sync but not what the broker executes against).
- Unknown or forbidden values fail closed with a stable, content-free error
  code (matches `grant_mismatch`, `model_unavailable`, etc.).
- Meter metadata never carries prompt/output content
  (`FORBIDDEN_METER_KEYS` in `validate.js`) but must disclose execution
  provenance (`runtime`/`nodeType`) — matches existing
  `SimulatedProvider`/`OllamaProvider` metadata.
- A workload's declared `dataClass` and an offer's advertised `dataClasses`
  are matched at a single existing enforcement point (`evaluatePolicy` in
  `src/core/scheduler.js`); new eligibility restrictions belong in
  `validateOffer`/`evaluatePolicy`, not a parallel bespoke check.
- Every failure rule has a deterministic automated test in `node:test`, no
  framework.
- Live/credentialed demos are consent-gated by an explicit env flag and
  excluded from automated CI, matching `FACF_LIVE_DEMO`.
- Existing local and control-plane behavior remains backward compatible.
