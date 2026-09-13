# References for Relay Node Type

## Ollama adapter/provider pair

- **Location:** `src/provider/ollama-adapter.js`, `src/provider/ollama-provider.js`
- **Relevance:** the exact interface shape (`chat()` raw client plus
  `execute()` wrapper) the DeepSeek relay adapter/provider must mirror,
  including error-code conventions and meter/result construction.

## Runtime protocol validator

- **Location:** `src/protocol/validate.js`
- **Relevance:** the actual enforcement point for `nodeType`,
  `relayUpstream`, and the dataClasses restriction — not the JSON Schema
  files, which only document the contract.

## Scheduler policy

- **Location:** `src/core/scheduler.js`
- **Relevance:** `evaluatePolicy`/`evaluateEligibility` already match
  `offer.dataClasses` against `workload.dataClass` through `validateOffer` —
  confirms no separate scheduler-level relay rule is needed.

## Live demo consent-gate pattern

- **Location:** `src/cli/live-ollama-demo.js`
- **Relevance:** the exact structure (env-flag refusal, synthetic-only demo
  workload, one-shot broker run, explicit `process.exit(0)`) to mirror for
  `live-deepseek-demo.js`.

## Prior conversation context

- Pilot outreach copy and Show HN/directory-submission work for FACF (this
  session, 2026-09-13) established the "Honest alpha" disclosure bar this
  feature must meet, and the three concerns (third-party API ToS/reselling
  risk, data-residency, differentiation dilution) that led to relay being a
  distinct, disclosed node type rather than blended into compute-provider
  claims.
