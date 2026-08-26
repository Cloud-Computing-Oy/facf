# Operator Guide

An FACF operator runs a scheduling and trust domain. Cloud Computing Oy intends to operate the official managed FACF network; organizations may also run private fabrics under their own control.

## Core duties

- approve and revoke client and provider identities;
- enforce workload, geography, model, trust, and budget policies;
- operate gateway, broker, event transport, and durable state;
- verify provider claims and monitor service quality;
- reconcile usage, disputes, invoices, and provider compensation;
- manage incident response, retention, and customer communications.

## Deployment sequence

1. Define the network's legal entity, policies, regions, and trust tiers.
2. Deploy PostgreSQL, NATS, identity services, gateway, and broker in a restricted control plane.
3. Configure immutable audit export and operational telemetry.
4. Enroll internal test providers and run synthetic workloads.
5. Exercise key loss, provider loss, broker failover, duplicate event, and dispute scenarios.
6. Enroll a small verified provider cohort and design partners.
7. Expand only after the operational and economic gates in [MVP scope](mvp-scope.md) pass.

## Operating safeguards

- Never route by price alone.
- Fail closed when policy, identity, or trust evidence is missing.
- Keep prompt and output content out of routine logs.
- Reconcile signed meter events before settlement.
- Separate enrollment approval, financial operations, and incident authority.
- Publish status and material policy changes for managed-network participants.

## Service levels

The open-source components carry no managed-service SLA. An operator may contract availability, response times, data location, support, and service credits for its own network.
