# Runnable Local Ollama Gateway — Shaping Notes

## Scope

Wire the Phase 1 HTTP gateway to the existing broker, in-memory lease store,
Ollama provider, and Ollama adapter as an explicitly enabled local process.

## Decisions

- Refuse startup without `FACF_GATEWAY_ENABLE=1`.
- Bind only to `127.0.0.1`; remote exposure, authentication, and mTLS remain
  out of scope.
- Accept only public and synthetic workloads on the local community provider.
- Refresh the short-lived local offer for each scheduling decision.
- Validate all environment configuration before opening a socket.

## Context

- **Visuals:** None.
- **References:** Phase 0 live Ollama CLI and Phase 1 gateway modules.
- **Product alignment:** Establishes a reproducible single-node vertical slice
  before private multi-node control-plane work.

## Standards Applied

No repository-local standards index exists. Existing fail-closed, no-secrets,
loopback-only, dependency-free ESM, and Node test conventions apply.
