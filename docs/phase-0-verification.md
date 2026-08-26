# Phase 0 Verification

## Status

Phase 0 has both deterministic simulation evidence and one bounded local Ollama
execution. This is implementation evidence, not a production-readiness claim.

## Verified commands

```bash
npm test
npm run check
npm run demo
FACF_LIVE_DEMO=1 \
FACF_OLLAMA_MODEL=qwen2.5:14b \
FACF_OLLAMA_URL=http://127.0.0.1:11434 \
FACF_PROVIDER_ID=provider-laptop-local \
npm run demo:live
```

## Live observation — 2026-08-26

- route: `facf`;
- provider: `provider-laptop-local`;
- runtime: local Ollama;
- model: `qwen2.5:14b`;
- workload class: synthetic;
- expected and observed response: `FACF LIVE OK`;
- final lease state: `completed`;
- measured duration: 910 ms;
- measured input/output tokens: 46 / 6;
- price in the local test offer: EUR 0;
- meter metadata contained runtime, model, and region but no prompt or output
  body.

The live CLI requires the explicit `FACF_LIVE_DEMO=1` consent flag and uses a
built-in synthetic prompt. It does not prove remote identity, mTLS, persistent
leases, multi-provider reliability, cloud-account fallback, billing, or SLA
behavior.

## Deterministic scenarios

The default demo also verifies:

1. eligible whole-workload selection and completed lease state;
2. simulated provider loss followed by bounded fallback;
3. privacy-safe meter evidence for both routes.
