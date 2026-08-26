# Trust Model

FACF assumes that clients, brokers, and compute providers may belong to different administrative domains. Trust is therefore explicit, scoped, and continuously re-evaluated.

## Trust tiers

| Tier | Provider requirements | Suitable workloads |
| --- | --- | --- |
| Community | Registered identity, signed agent, basic health checks | Public or synthetic data, best-effort jobs |
| Verified | Organization verification, reproducible benchmarks, monitored operations, incident contact | Ordinary business inference with contractual controls |
| Confidential | Verified tier plus approved confidential-computing hardware and remote attestation | Workloads whose policy explicitly permits the attested environment |
| Private | Customer-controlled membership and network boundary | Customer-designated internal workloads |

A trust tier is an eligibility claim, not a guarantee that a workload is safe. The workload owner remains responsible for classifying data and selecting an allowed tier.

## Identity and authorization

- Every broker, agent, and operator has a cryptographic identity.
- Enrollment is approved by the relevant network operator; possession of the software alone does not grant access.
- Short-lived credentials are preferred over static secrets.
- Execution grants bind a workload, provider, model, resource ceiling, and expiry.
- The provider receives only the material required to execute the accepted workload.

## Verification

The managed network may combine organization checks, agent integrity checks, benchmark challenges, remote attestation, signed metering, anomaly detection, and periodic re-verification. Failed or stale verification reduces eligibility automatically.

## Reputation

Reputation is derived from attributable observations such as availability, accepted-versus-completed leases, latency, correctness challenges, policy violations, and dispute outcomes. It must not be purchasable or transferable between identities.

## Revocation

Credentials, provider status, and model eligibility can be revoked independently. Emergency revocation takes effect before queued work is assigned; running work follows the workload's termination policy.

## Privacy boundary

FACF metadata must avoid prompts and outputs by default. Operators should retain only the minimum identity, scheduling, metering, audit, and dispute data required by policy and contract.
