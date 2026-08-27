# Threat Model

This document defines the initial security assumptions for FACF. It is not a certification or a substitute for a deployment-specific assessment.

## Protected assets

- prompts, outputs, model weights, adapters, and customer metadata;
- provider credentials and signing keys;
- scheduler integrity and policy decisions;
- metering, balances, invoices, and reputation records;
- availability of the broker and provider fleet.

## Principal threats and controls

| Threat | Initial controls | Residual risk |
| --- | --- | --- |
| Malicious provider reads workload data | Data classification, trust tiers, least-data routing, encryption in transit, private or attested execution | A normal host administrator can still inspect plaintext during ordinary execution |
| Provider falsifies capacity or work | Signed offers and meters, leases, benchmarks, challenges, anomaly detection | Verification can add cost and may not prove arbitrary inference correctness |
| Client submits hostile workload | Whole-job API, model allowlists, quotas, input limits, sandboxed adapters | Model and runtime vulnerabilities remain possible |
| Broker abuses its position | Auditable policy, separation of duties, signed records, customer-controlled private fabrics | Managed-network customers still trust its operator contractually |
| Identity or key theft | Short-lived credentials, hardware-backed keys where available, rotation and revocation | Compromised endpoints can act until detected or revoked |
| Replay or double execution | Unique request and lease IDs, expiries, idempotency keys, monotonic state transitions | External side effects require application-level idempotency |
| Denial of service | Admission control, quotas, bounded queues, circuit breakers, provider diversity | Large coordinated attacks can exhaust economic capacity |
| Supply-chain compromise | Signed releases, reproducible build goals, dependency review, staged rollout | Build infrastructure and upstream dependencies remain trust anchors |
| Metering or billing fraud | Signed usage goals, reconciliation, bounded disputes, and best-effort alpha audit records | Alpha audit writes can be dropped or falsified; economic attacks may remain below detection thresholds |

## Important limitation

Transport encryption does not protect data from the machine performing ordinary inference. Confidential workloads require an explicitly approved private or confidential-computing environment, and remote attestation must be verified before secrets are released.

## Security boundaries

The open protocol does not automatically make an unknown provider trustworthy. The official managed network adds enrollment, policy, monitoring, billing, incident response, and contractual accountability. Private fabrics can replace that operator boundary with a customer's own controls.

## Reporting

Report suspected vulnerabilities according to [SECURITY.md](../SECURITY.md). Do not include sensitive exploit details in a public issue.
