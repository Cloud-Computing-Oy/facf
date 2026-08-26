# mTLS Lease Negotiation — Shaping Notes

## Scope

Carry content-free lease requests and bounded grant/rejection decisions over the
existing authenticated provider control connection.

## Decisions

- Broker requests are allowed only for a currently active, enrolled provider.
- Responses are correlated to one request and one authenticated provider socket.
- Grants are validated again at the broker boundary and must match the original
  lease, workload, provider, and model.
- Timeouts and disconnects reject the pending request; grant tokens never enter
  routine logs.
- Prompt and runtime execution remain out of scope.

## Context

- **Visuals:** None.
- **References:** mTLS control, provider registry, and agent lease authority.
- **Product alignment:** Completes control-plane reservation before data-plane
  design.

## Standards Applied

No local standards index exists. Mutual identity, bounded messages, correlation,
least privilege, fail-closed validation, and content-free telemetry apply.
