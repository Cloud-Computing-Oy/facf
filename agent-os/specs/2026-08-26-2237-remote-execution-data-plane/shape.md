# Remote Execution Data Plane — Shaping Notes

## Scope

Add the first bounded remote execution path over the existing outbound mTLS
provider connection. A broker-side provider negotiates a lease, sends one
complete public or synthetic workload bound to the execution grant, and
receives one terminal result plus meter event from the provider runtime.

## Decisions

- Reuse the existing newline-delimited JSON TLS 1.3 connection for v0alpha1.
- Keep this slice non-streaming because the current Ollama adapter is
  non-streaming; incremental token streaming remains in G2.
- Treat any timeout or disconnect after dispatch as an unknown outcome and do
  not transparently retry or fall back.
- Make identical retries idempotent by lease; reject changed payloads.
- Bound message size, execution deadline, and completed-execution cache.
- Allow only public or synthetic workloads in this alpha transport.
- Never log grant tokens, workload input, or result output.

## Context

- **Visuals:** None.
- **References:** `src/control/mtls-control.js`,
  `src/control/agent-lease-authority.js`, `src/core/broker.js`,
  `src/provider/ollama-provider.js`.
- **Product alignment:** advances G2 private federation without claiming the
  30-day G3 pilot or production readiness.

## Standards Applied

No `agent-os/standards/` index exists in this repository. The implementation
uses the repository's closed-schema, fail-closed, bounded-input, content-free
logging, deterministic-test, and backward-compatible optional-dependency
patterns.
