# FACF — Federated AI Compute Fabric

FACF is an open protocol and reference architecture for routing AI workloads
across independently operated compute nodes.

The project turns otherwise idle GPUs in laptops, workstations, servers, and
data centres into a policy-controlled capacity pool. FACF schedules complete
inference requests or asynchronous jobs to one provider cell at a time. It does
not attempt to stretch a single Kubernetes cluster or GPU tensor-parallel job
across the public internet.

> **Project status: Phase 0 protocol and deterministic simulator.** The
> repository includes executable scheduling, lease, provider, metering, Ollama
> adapter, and fallback boundaries. No production network, token, marketplace,
> or confidentiality guarantee exists yet.

## Why FACF?

AI capacity is fragmented. Organisations and individuals own accelerators that
are idle much of the day, while application teams depend on a small number of
centralised providers. Existing capacity is difficult to share because nodes
differ in hardware, models, availability, trust, geography, cost, and network
quality.

FACF defines a common control plane for discovering that capacity, reserving it
briefly, routing eligible workloads, measuring service, and falling back safely.

## What FACF is

- A broker–agent protocol for independently operated provider cells.
- An OpenAI-compatible gateway for real-time inference.
- A job API for retryable asynchronous workloads.
- A policy engine for model, trust, region, cost, latency, and data-class rules.
- A capacity lease and metering system.
- A path from a small verified federation to a larger community network.

## What FACF is not

- A single internet-wide Kubernetes cluster.
- A way to combine consumer GPU memory across the WAN for one model request.
- A guarantee that an ordinary provider cannot see data processed on its host.
- A cryptocurrency or blockchain project in the MVP.
- A production-ready marketplace today.

## High-level architecture

```text
Application / agent
        |
        | OpenAI-compatible API or Job API
        v
+------------------------------+
| FACF Gateway and Broker      |
| identity, policy, scheduling |
| leases, metering, fallback   |
+---------------+--------------+
                | outbound mTLS streams
       +--------+---------+
       |                  |
       v                  v
+-------------+    +-------------+
| Provider A  |    | Provider B  |
| FACF agent  |    | FACF agent  |
| Ollama/vLLM |    | vLLM/Ray    |
+-------------+    +-------------+
```

The first practical FACF node is a Windows laptop with an NVIDIA RTX 5060,
Ollama, and a private Tailscale endpoint. The CCO LLM Router can use that node
opportunistically and fall back to cloud providers. FACF generalises the same
pattern into an open, multi-provider protocol.

## Proposed MVP

- 3–5 manually approved providers.
- EU-hosted control plane and provider cells.
- Public or non-sensitive data only.
- Text inference only.
- 1–3 approved open-weight models.
- Warm model replicas and whole-request scheduling.
- One active lease per advertised slot.
- OpenAI-compatible streaming API.
- Measured time-to-first-token, tokens/second, success rate, and token counts.
- Conventional EUR accounting; no token or automated payout system.

See [Product Roadmap](agent-os/product/roadmap.md) and
[MVP Scope](docs/mvp-scope.md).

## Run the Phase 0 simulator

Node.js 22 or newer is required. There are no runtime package dependencies.

```bash
npm test
npm run check
npm run demo
```

The demo executes one whole workload on a laptop-style simulated provider and
then demonstrates bounded cloud fallback after a simulated provider failure.
It never connects to a real provider or cloud account.

An explicitly authorized local Ollama smoke test is also available. It accepts
only the built-in synthetic prompt and refuses to run without the consent flag:

```bash
FACF_LIVE_DEMO=1 \
FACF_OLLAMA_MODEL=qwen2.5:7b \
FACF_OLLAMA_URL=http://127.0.0.1:11434 \
npm run demo:live
```

Do not point the alpha adapter at an untrusted endpoint or use it for sensitive
data. Remote-provider identity and mTLS are Phase 1 work.

Machine-readable alpha contracts are in
[`protocol/v0alpha1`](protocol/v0alpha1/README.md). The implementation plan and
acceptance criteria are preserved in the
[`Phase 0 spec`](agent-os/specs/2026-08-26-1113-phase-0-protocol-simulator/plan.md).
Current local execution evidence and its limitations are recorded in
[`Phase 0 verification`](docs/phase-0-verification.md).

## Documentation

Start with the [documentation index](docs/README.md).

- [Product mission](agent-os/product/mission.md)
- [Product roadmap](agent-os/product/roadmap.md)
- [Technology stack](agent-os/product/tech-stack.md)
- [Commercial strategy](docs/commercial-strategy.md)
- [Control and defensibility](docs/control-and-defensibility.md)
- [Intellectual property and licensing](docs/ip-and-licensing.md)
- [Architecture](docs/architecture.md)
- [Protocol](docs/protocol.md)
- [Trust model](docs/trust-model.md)
- [Threat model](docs/threat-model.md)
- [Provider guide](docs/provider-guide.md)
- [Operator guide](docs/operator-guide.md)

## Principles

1. **Human control.** Operators choose when, what, and how much they share.
2. **Fail closed.** Unknown trust, policy, or identity never expands access.
3. **No false confidentiality.** Consumer nodes are not trusted enclaves.
4. **Whole-job federation.** WAN links coordinate cells; they do not replace
   local NVLink or high-speed fabrics.
5. **Open protocol, replaceable components.** The broker, agent, runtimes, and
   identity systems are separable.
6. **Measured claims.** Capacity, performance, and releases require evidence.
7. **Sustainable stewardship.** Open adoption and a viable commercial operator
   reinforce each other.
8. **No blockchain before verifiable service.** Useful-work verification and
   conventional accounting come first.

## Open source and commercial services

The protocol, schemas, community agent, conformance fixtures, and baseline
reference components are intended to remain open source under Apache-2.0.
Cloud Computing Oy may separately provide the official managed network,
verified-provider programme, enterprise control plane, private fabrics, billing,
support, and service-level commitments. The Apache licence does not grant rights
to project or company trademarks.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the
[Code of Conduct](CODE_OF_CONDUCT.md) before participating. Official-status and
branding boundaries are described in [TRADEMARKS.md](TRADEMARKS.md).

Licensed under the [Apache License 2.0](LICENSE).
