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
      `INSERT INTO leases (lease_id, protocol_version, workload_id, offer_id, provider_id, state, issued_at, expires_at, attempt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (lease_id) DO NOTHING`,
      [lease.leaseId, lease.protocolVersion, lease.workloadId, lease.offerId, lease.providerId, lease.state, lease.issuedAt, lease.expiresAt, lease.attempt]
    );
  }

  async recordMeter(meter) {
    await this.pool.query(
      `INSERT INTO meters (meter_id, protocol_version, workload_id, lease_id, provider_id, started_at, completed_at, duration_ms, input_tokens, output_tokens, price_eur, outcome, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (meter_id) DO NOTHING`,
      [
        meter.meterId, meter.protocolVersion, meter.workloadId, meter.leaseId, meter.providerId,
        meter.startedAt, meter.completedAt, meter.durationMs,
        meter.inputTokens, meter.outputTokens, meter.priceEur, meter.outcome,
        JSON.stringify(meter.metadata)
      ]
    );
  }
}

export async function createAuditLogFromEnv(env = process.env, { loadPgImpl = loadPg } = {}) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) return null;
  const pg = await loadPgImpl();
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query("SELECT 1");
    return new PostgresAuditLog({ pool });
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }
}
