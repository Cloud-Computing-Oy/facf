# Product Roadmap

## Phase 0: Specification and Simulation

- Publish architecture, threat model, trust levels, and protocol lifecycle.
- Define versioned capability, heartbeat, lease, job, result, and meter schemas.
- Build a deterministic provider simulator and scheduler tests.
- Define conformance, commercial-control, and failure semantics.

Exit gate: two implementations exchange fixtures and produce the same lease
state transitions.

## Phase 1: Closed Inference MVP

- Go reference provider agent and broker.
- Outbound mTLS control stream.
- Ollama and vLLM runtime adapters.
- OpenAI-compatible chat-completions gateway with streaming.
- Atomic leases, model allowlists, and immutable runtime-image digests.
- PostgreSQL system of record and NATS JetStream events.
- OpenTelemetry metrics and operator dashboard.
- Manual provider approval and EUR-denominated shadow accounting.
- CCO LLM Router integration as an optional upstream route.

Exit gate: a 30-day internal/partner pilot completes reliability, incident,
metering, demand, unit-economics, and reconciliation reviews.

## Phase 2: Managed Verified Network

- Commercial provider onboarding and ownership verification.
- Signed metering and broker-side reconciliation.
- Reputation based on observable outcomes.
- Regional, tenant, dedicated-capacity, and SLA policies.
- Conventional invoicing and provider settlement.
- Cloud Computing Oy managed service, support, and enterprise administration.

Exit gate: two paying workload owners and three verified providers reconcile
usage, invoices, service levels, and provider compensation successfully.

## Phase 3: Private Fabrics and Community Capacity

- Customer-operated private fabrics with managed control-plane options.
- Self-service provider enrollment with quarantine and benchmarks.
- Sybil resistance, challenge jobs, fraud controls, and dispute workflow.
- Dynamic pricing and provider-defined availability.
- Community governance for the open protocol.

Exit gate: community workloads meet published quality, abuse, and payment-loss
thresholds without weakening verified-provider guarantees.

## Phase 4: Confidential and Specialised Compute

- Hardware-rooted attestation for supported confidential GPU environments.
- Workload identity bound to approved image digests and evidence.
- Embeddings, speech, image generation, and selected batch workloads.
- Broker federation without a single required global operator.

## Explicitly Deferred

- Cross-provider tensor parallelism over the public internet.
- Permissionless cryptocurrency payments or a native FACF token.
- Sensitive workloads on ordinary community hardware.
- Autonomous installation with unrestricted host privileges.
