import { loadPg } from "./load-pg.js";

export class PostgresAuditLog {
  constructor({ pool }) {
    if (!pool) throw new TypeError("pool is required");
    this.pool = pool;
    // An unhandled 'error' on an idle pooled client otherwise crashes the
    // process on a transient DB blip — same failure class fixed for the
    // mTLS control socket in PR #8.
    this.pool.on("error", () => {});
  }

  async recordLease(lease) {
    await this.pool.query(
      `INSERT INTO leases (lease_id, workload_id, offer_id, provider_id, state, issued_at, expires_at, attempt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (lease_id) DO NOTHING`,
      [lease.leaseId, lease.workloadId, lease.offerId, lease.providerId, lease.state, lease.issuedAt, lease.expiresAt, lease.attempt]
    );
  }

  async recordMeter(meter) {
    await this.pool.query(
      `INSERT INTO meters (meter_id, workload_id, lease_id, provider_id, started_at, completed_at, duration_ms, input_tokens, output_tokens, price_eur, outcome, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (meter_id) DO NOTHING`,
      [
        meter.meterId, meter.workloadId, meter.leaseId, meter.providerId,
        meter.startedAt, meter.completedAt, meter.durationMs,
        meter.inputTokens, meter.outputTokens, meter.priceEur, meter.outcome,
        JSON.stringify(meter.metadata)
      ]
    );
  }
}

export async function createAuditLogFromEnv(env = process.env) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return null;
  const pg = await loadPg();
  const pool = new pg.Pool({ connectionString: databaseUrl });
  return new PostgresAuditLog({ pool });
}
