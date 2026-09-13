# Relay Node Type Plan

## Task 1: Save spec documentation

Validation: `npm run check`.

## Task 2: Add nodeType to the offer contract

Outcome: `protocol/v0alpha1/offer.schema.json` gains `nodeType`/`relayUpstream`
with the relay-to-public/synthetic `dataClasses` restriction, plus a new
`protocol/v0alpha1/fixtures/offer.deepseek-relay.json` fixture.
`src/protocol/validate.js`'s `validateOffer` enforces `nodeType`,
`relayUpstream`, and the `dataClasses` restriction — the same function every
offer already passes through in `evaluateEligibility`.

Validation: existing compute-offer fixtures still validate unchanged; a
relay-plus-internal fixture is rejected; `test/protocol.test.js` gains cases
for both.

## Task 3: Add the DeepSeek relay adapter and provider

Outcome: `src/provider/deepseek-relay-adapter.js`
(`chat({model, messages, options, signal, timeoutMs}) → {text, usage}`
against DeepSeek's OpenAI-compatible endpoint; `FACF_DEEPSEEK_API_KEY`
required at construction; errors mapped to `relay_auth_error`,
`relay_http_error`, `relay_invalid_response`, `relay_timeout`,
`relay_unreachable`) and `src/provider/deepseek-relay-provider.js` (mirrors
`OllamaProvider.execute()`, adds the public/synthetic dataClass guard, tags
meter `metadata.nodeType`/`relayUpstream`).

Validation: `test/deepseek-relay-adapter.test.js` (mocked fetch: success,
each error path, missing-key constructor failure) and
`test/deepseek-relay-provider.test.js` (grant mismatch, model unavailable,
non-public/synthetic dataClass rejected, meter disclosure fields present).

## Task 4: Add the consent-gated demo CLI

Outcome: `src/cli/live-deepseek-demo.js` mirrors `live-ollama-demo.js` —
refuses to run without `FACF_LIVE_RELAY_DEMO=1`, builds a `nodeType: relay`
offer, runs one workload through the broker, prints the result including
disclosure metadata. `npm run demo:relay` script added to `package.json`.

Validation: manual run against the dedicated DeepSeek key (not part of
automated CI, matching `demo:live`'s own exclusion since it needs live
credentials).

## Task 5: Document and release

Outcome: `docs/adr/0005-relay-node-type.md` records the decision;
`docs/provider-guide.md` gains a "Relay nodes" section (forwards to a
third-party API, must disclose upstream, capped to public/synthetic data,
excluded from hardware-federation pilot counts); `docs/trust-model.md` gets
one paragraph noting `nodeType` is orthogonal to `trustTier`;
`agent-os/product/roadmap.md`'s Phase 1 section notes relay nodes don't count
toward the "2-3 verified EU providers" milestone.

Validation: `npm run check` (docs/protocol/fixture checks), full test suite,
Codex review (or DeepSeek-fallback review if Codex is rate-limited), merge.

## Non-goals

mTLS/remote-provider wiring for relay nodes, capability/heartbeat schema
changes, facf.eu site changes, payment/accounting distinctions between relay
and compute, additional relay upstreams beyond DeepSeek, PostgreSQL/NATS
persistence changes.
