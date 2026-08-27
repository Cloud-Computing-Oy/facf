# Architecture

## Implementation status

The repository implements a Node.js Phase 0 simulator and bounded Phase 1
slices: a loopback-only OpenAI-compatible gateway, Ollama execution, enrolled
outbound mTLS provider presence, lease negotiation, and optional best-effort
Postgres audit persistence. The current G2 slice transports complete public or
synthetic workloads and terminal results over the authenticated connection.
Incremental token streaming, production identity lifecycle, durable event
delivery, reconciliation, and billing remain Phase 1 or later work.

## Design Boundary

FACF federates autonomous provider cells. The WAN control plane selects a cell
for a complete request or job. GPU collectives and tensor parallelism remain
inside a provider's low-latency local fabric.

## Components

### Client gateway

- authenticates workload owners;
- accepts OpenAI-compatible requests and asynchronous jobs;
- validates model, data class, budget, and service requirements;
- obtains a lease from the broker;
- streams requests and responses without logging bodies by default;
- records gateway-side meter observations;
- applies bounded fallback before output is committed.

### Broker

- maintains the provider and capability registry;
- removes expired offers from scheduling;
- evaluates mandatory placement policy;
- scores eligible offers and creates atomic leases;
- coordinates job state and cancellation;
- reconciles provider and gateway meter statements.

The broker is logically central in the MVP, but the open protocol must not
require a permanent global monopoly. Cloud Computing Oy's official managed
network is a commercial deployment of the protocol.

### Provider agent

- inventories approved hardware and runtime capabilities;
- enforces local power, thermal, model, time-window, and concurrency limits;
- opens an outbound authenticated control stream;
- publishes short-lived signed offers;
- accepts or rejects leases atomically;
- invokes an allowlisted local runtime;
- sends health, result, and meter events;
- provides pause, drain, and emergency-stop controls.

The agent never grants the broker arbitrary shell access.

### Runtime adapter

Adapters translate the FACF execution contract into a local runtime such as
Ollama or vLLM. They validate model revision, request limits, and runtime health
before accepting a lease.

### State and events

- PostgreSQL is authoritative for identity, policy, lease, job, and accounting.
- NATS JetStream carries durable asynchronous events.
- Caches contain derived state and can be rebuilt.

## Request Flow

```text
1. Client -> Gateway: request + model + data class + constraints
2. Gateway -> Broker: placement request
3. Broker: filter, score, create pending lease
4. Broker -> Agent: lease offer
5. Agent: atomic local capacity check
6. Agent -> Broker: accept + scoped execution grant
7. Broker -> Agent: lease-bound execution request
8. Agent -> Broker: terminal result and meter evidence
9. Gateway + Agent -> Broker: signed meter observations
10. Broker: reconcile and close lease
```

## Failure Rules

- Before streaming, the gateway may release a failed lease and select another
  provider after a bounded transient error.
- Once a remote execution has been dispatched, a timeout or disconnect is an
  unknown outcome and must not trigger transparent replay on another provider.
- After client-visible tokens begin, transparent replay is disabled by default.
- Agent disconnect does not erase completed meter evidence.
- Expired leases release capacity but not audit history.
- The agent enforces local deadlines if the broker disappears.

## Deployment Topology

The pilot runs an EU broker/gateway region with independent provider agents
connecting outward. Runtime endpoints stay private to the provider network or
authenticated tunnel. Commercial production configuration, provider identities,
customer policies, and fraud signals are not stored in the public repository.

## Scalability

The scale unit is an independent model replica and execution slot. Later broker
partitioning may use model, region, or provider-group shards. Heartbeat ingestion
is separated from durable accounting so telemetry load cannot determine billing
correctness.
