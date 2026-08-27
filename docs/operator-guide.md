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

## Persistence

The reference implementation's Postgres audit log
(`src/persistence/postgres-audit-log.js`) writes leases that complete, fail, or
are released, and meter events, to two tables — `leases` and `meters` — for
reconciliation and incident review. Writes are best-effort: a database failure
is logged without failing or delaying the workload. Operators must not treat
these tables as an immutable or exactly-once audit trail. The broker allows at
most 1,000 pending audit writes by default; further events are dropped with an
`audit_write_dropped` log entry until capacity becomes available. Persistence
is optional and inert until configured:

1. Provision a Postgres instance and set `DATABASE_URL` (e.g.
   `postgres://user:password@host:5432/facf`) in the gateway process's
   environment.
2. Run `npm run db:migrate` once against that `DATABASE_URL` to create the
   schema.
3. Start the gateway as usual (`npm run gateway:local` or your own
   process). It logs `FACF audit persistence enabled (DATABASE_URL set).`
   on startup when configured.

Without `DATABASE_URL`, the gateway runs exactly as before with no
persistence and no new dependency installed.

## Event publishing (NATS)

The reference implementation can also publish completed/failed leases, and
every meter event, to NATS subjects
(`src/persistence/nats-event-publisher.js`) for live consumption by other
systems — dashboards, billing pipelines, alerting. This is independent of
and additional to the Postgres audit log above: NATS publishing is
best-effort, live-only (no replay for a consumer that was offline), and a
NATS outage never affects Postgres persistence or vice versa, since the two
sinks have separate bounded queues.

Subjects: `facf.leases.<state>` (e.g. `facf.leases.completed`,
`facf.leases.failed`, `facf.leases.released`) and `facf.meters.recorded`
for every meter event regardless of route. Payloads are the same JSON
objects written to the audit log.

Publishing is optional and inert until configured:

1. Provision a NATS server and set `NATS_URL` (e.g.
   `tls://host:4222`) in the gateway process's environment.
2. Configure authentication with either `NATS_CREDS_FILE` (a NATS
   credentials file) or the `NATS_CLIENT_CERT_FILE` / `NATS_CLIENT_KEY_FILE`
   / `NATS_CA_FILE` trio for mutual TLS — pick one, both are optional.
3. Start the gateway as usual (`npm run gateway:local` or your own
   process). It logs `FACF event publishing enabled (NATS_URL set).` on
   startup when configured.

A misconfigured `NATS_URL` fails gateway startup immediately, the same as a
bad `DATABASE_URL`. Once connected, a publish failure is logged and never
blocks or fails a workload. Without `NATS_URL`, the gateway runs exactly as
before with no publishing and no new dependency installed.

## Operating safeguards

- Never route by price alone.
- Fail closed when policy, identity, or trust evidence is missing.
- Keep prompt and output content out of routine logs.
- Reconcile signed meter events before settlement.
- Separate enrollment approval, financial operations, and incident authority.
- Publish status and material policy changes for managed-network participants.

## Service levels

The open-source components carry no managed-service SLA. An operator may contract availability, response times, data location, support, and service credits for its own network.
