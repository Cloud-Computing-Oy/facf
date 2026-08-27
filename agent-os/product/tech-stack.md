# Tech Stack

These are intended choices, not completed implementation. Material changes
require an Architecture Decision Record and milestone evidence.

## User Interfaces

- Initial operator interface: CLI and generated status pages.
- Later dashboard: TypeScript and React.
- Client API: OpenAPI 3.1 and OpenAI-compatible HTTP/SSE.
- Provider control and first bounded data-plane slice: newline-delimited JSON
  over outbound TLS 1.3 mutual-TLS connections.
- Target interoperable transport after the v0alpha1 contracts stabilize:
  gRPC/protobuf, recorded by a future transport ADR before migration.

## Backend

- Node.js for the reference broker, gateway, and provider agent (see
  [ADR 0004](../../docs/adr/0004-node-reference-implementation.md)).
- NATS JetStream for durable asynchronous events.
- Typed policy in the reference implementation initially; evaluate Open
  Policy Agent only when externally administered policies justify it.

## Database

- PostgreSQL for identities, offers, leases, jobs, metering, and reconciliation.
- Redis only for derived scheduling state if benchmarks require it.
- Versioned SQL migrations controlled by the release process.

## Provider Runtimes

- Ollama for consumer/workstation MVP nodes.
- vLLM for server inference.
- Kubernetes or Ray Serve only inside larger provider cells.
- Immutable OCI image digests and runtime/model allowlists.

## Identity and Security

- Pilot: private networking plus mutual TLS.
- Target: SPIFFE/SPIRE-compatible workload identities.
- OCI signatures, SBOMs, and short-lived execution credentials.
- Confidential tier only on supported, independently attested hardware/software.

## Observability and Delivery

- OpenTelemetry, Prometheus, and Grafana.
- Prompt and response bodies excluded from default telemetry.
- GitHub Actions, CodeQL, signed artifacts, and semantic versioning.
- Apache-2.0 for the open protocol and community components.

## Commercial Components

Cloud Computing Oy may develop and operate proprietary or separately licensed
services around the open core: managed multi-tenant control plane, billing and
settlement, verified-provider registry, enterprise policy and audit features,
private-fabric management, SLA operations, and commercial support.
