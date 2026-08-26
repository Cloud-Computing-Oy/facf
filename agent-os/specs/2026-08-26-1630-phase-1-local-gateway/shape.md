# Phase 1 Local Gateway — Shaping Notes

## Scope

Add a dependency-free, local-only OpenAI-compatible `chat/completions` HTTP
gateway over the existing Phase 0 broker. Support JSON and SSE responses,
explicit public/synthetic data classification, bounded request bodies, and
safe error responses.

## Decisions

- Bind to loopback by default; remote identity and mTLS remain future work.
- Reuse the existing broker, lease, policy, and provider boundaries.
- Streaming compatibility may emit the completed provider result as one delta;
  runtime-native incremental streaming is explicitly deferred.
- Never log prompt or response bodies.

## Context

- **Visuals:** None.
- **References:** `src/core/broker.js`, `src/provider/ollama-provider.js`, and
  OpenAI chat-completions response conventions.
- **Product alignment:** First bounded Phase 1 gateway slice; no claim that the
  closed inference MVP or production network is complete.

## Standards Applied

No repository-local standards index exists. Existing project conventions,
Node.js built-ins, v0alpha1 schemas, and fail-closed policy apply.
