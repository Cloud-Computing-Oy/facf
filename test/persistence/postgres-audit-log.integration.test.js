import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations } from "../../scripts/migrate.mjs";
import { createAuditLogFromEnv } from "../../src/persistence/postgres-audit-log.js";

const databaseUrl = process.env.DATABASE_URL;
const skip = databaseUrl ? false : "DATABASE_URL is not set; skipping live Postgres integration test";

test("PostgresAuditLog persists a lease and meter against a real Postgres schema", { skip }, async (t) => {
  const auditLog = await createAuditLogFromEnv({ DATABASE_URL: databaseUrl });
  const pool = auditLog.pool;
  await runMigrations({ pool });
  t.after(() => pool.end());

  const leaseId = `it-lease-${Date.now()}`;
  const lease = {
    leaseId, workloadId: "workload-it", offerId: "offer-it", providerId: "provider-it",
    state: "completed", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:30.000Z", attempt: 1
  };
  await auditLog.recordLease(lease);
  await auditLog.recordLease(lease); // ON CONFLICT DO NOTHING must not throw on a repeat write

  const leaseRows = await pool.query("SELECT lease_id, state, attempt FROM leases WHERE lease_id = $1", [leaseId]);
  assert.equal(leaseRows.rows.length, 1);
  assert.equal(leaseRows.rows[0].state, "completed");
  assert.equal(leaseRows.rows[0].attempt, 1);

  const meterId = `it-meter-${Date.now()}`;
  const meter = {
    meterId, workloadId: "workload-it", leaseId, providerId: "provider-it",
    startedAt: "2026-08-26T08:00:00.000Z", completedAt: "2026-08-26T08:00:01.000Z", durationMs: 1000,
    inputTokens: 4, outputTokens: 3, priceEur: 0.01, outcome: "completed", metadata: { route: "facf" }
  };
  await auditLog.recordMeter(meter);
  const meterRows = await pool.query("SELECT outcome, metadata FROM meters WHERE meter_id = $1", [meterId]);
  assert.equal(meterRows.rows.length, 1);
  assert.equal(meterRows.rows[0].outcome, "completed");
  assert.deepEqual(meterRows.rows[0].metadata, { route: "facf" });
});
