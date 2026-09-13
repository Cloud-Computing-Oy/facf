# Relay Node Type — Shaping Notes

## Scope

Add an honestly-disclosed "relay" provider node type that forwards execution
to a third-party cloud LLM API (DeepSeek first) instead of independently
owned local hardware. This slice is local-only: a new adapter/provider pair
usable through the existing broker and scheduler, plus a consent-gated CLI
demo, mirroring the existing Ollama adapter/provider pattern. No mTLS or
remote-provider wiring, no facf.eu changes, no payment/accounting distinction
between node types in this slice.

## Decisions

- `nodeType: enum[compute, relay]` is added to `offer.schema.json` and
  enforced in `validateOffer` — this repository's real runtime validator
  lives in `src/protocol/validate.js`, not the JSON Schema files (those are
  the documentation/conformance contract layer; both are kept in sync).
  `capability.schema.json`/`validateCapability` are untouched in this slice:
  capability/heartbeat is only used by the mTLS control plane, which is out
  of scope here.
- `relayUpstream: enum[deepseek]` is required when `nodeType: relay` and
  absent for `compute`. `runtime` (the local execution-engine field) is
  unaffected — it already only exists on `capability`, never on `offer`.
- Relay offers are structurally restricted to
  `dataClasses: ["public", "synthetic"]`: `validateOffer` rejects any relay
  offer advertising `internal` or `confidential`, regardless of `trustTier`.
  This is enforced once, in the same function every offer already passes
  through before scheduling (`evaluateEligibility` calls `validateOffer`), so
  no separate scheduler-level rule is needed — `evaluatePolicy` already
  matches `offer.dataClasses` against `workload.dataClass` generically.
- `DeepSeekRelayProvider.execute()` repeats the public/synthetic check
  against the workload immediately before dispatch, matching the existing
  belt-and-suspenders pattern in `OllamaProvider.execute()` (which re-checks
  lease/offer/model binding even though the scheduler already evaluated
  eligibility).
- Every relay execution's meter event records
  `metadata: { nodeType: "relay", relayUpstream: "deepseek", model, region }`
  — the same disclosure mechanism `OllamaProvider`/`SimulatedProvider`
  already use for `runtime`.
- `FACF_DEEPSEEK_API_KEY` is a dedicated key provisioned for this pilot, read
  from `.env` (now gitignored in this repo), never logged or included in
  thrown error messages.
- Relay nodes are excluded from the roadmap's "2-3 verified EU providers"
  Phase 1 pilot/exit-gate count — documented explicitly so the pilot's public
  claims stay honest.

## Context

- **Visuals:** None.
- **References:** `src/provider/ollama-adapter.js` + `src/provider/ollama-provider.js`
  (interface shape to mirror), `src/protocol/validate.js` (real runtime
  validator), `src/core/scheduler.js` (`evaluatePolicy`/`evaluateEligibility`,
  where the dataClasses restriction is naturally enforced via the existing
  `validateOffer` call), `src/cli/live-ollama-demo.js` (consent-gate CLI
  pattern to mirror).
- **Product alignment:** `docs/trust-model.md`, `docs/provider-guide.md`,
  README "Principles" #3 ("No false confidentiality") and #6 ("Measured
  claims") — relay disclosure keeps the pilot's public claims honest.

## Standards Applied

No local standards index exists (consistent with prior specs in this
repository). Existing conventions applied: closed/exact-key payloads,
fail-closed on unknown or forbidden values, meter metadata never carries
prompt/output content, dependency-free `node:test` coverage for every new
failure rule, backward compatibility with existing compute-offer behavior.
