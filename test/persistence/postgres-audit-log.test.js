import test from "node:test";
import assert from "node:assert/strict";
import { PostgresAuditLog, createAuditLogFromEnv } from "../../src/persistence/postgres-audit-log.js";

function fakePool() {
  const calls = [];
  const errorHandlers = [];
  return {
    calls,
    errorHandlers,
    on(event, handler) { if (event === "error") errorHandlers.push(handler); },
    async query(sql, params) { calls.push({ sql: sql.trim(), params }); return { rows: [] }; }
  };
}

test("recordLease inserts all lease fields with ON CONFLICT (lease_id) DO NOTHING", async () => {
  const pool = fakePool();
  const auditLog = new PostgresAuditLog({ pool });
  const lease = {
    leaseId: "lease-1", workloadId: "workload-1", offerId: "offer-1", providerId: "provider-1",
    state: "completed", issuedAt: "2026-08-26T08:00:00.000Z", expiresAt: "2026-08-26T08:00:30.000Z", attempt: 1
  };
  await auditLog.recordLease(lease);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /INSERT INTO leases/);
  assert.match(pool.calls[0].sql, /ON CONFLICT \(lease_id\) DO NOTHING/);
  assert.deepEqual(pool.calls[0].params, [
    "lease-1", "workload-1", "offer-1", "provider-1", "completed",
    "2026-08-26T08:00:00.000Z", "2026-08-26T08:00:30.000Z", 1
  ]);
});

test("recordMeter inserts all meter fields with metadata serialized as JSON text", async () => {
  const pool = fakePool();
  const auditLog = new PostgresAuditLog({ pool });
  const meter = {
    meterId: "meter-1", workloadId: "workload-1", leaseId: "lease-1", providerId: "provider-1",
    startedAt: "2026-08-26T08:00:00.000Z", completedAt: "2026-08-26T08:00:01.000Z", durationMs: 1000,
    inputTokens: 4, outputTokens: 3, priceEur: 0.01, outcome: "completed", metadata: { route: "facf" }
  };
  await auditLog.recordMeter(meter);
  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /INSERT INTO meters/);
  assert.match(pool.calls[0].sql, /ON CONFLICT \(meter_id\) DO NOTHING/);
  assert.deepEqual(pool.calls[0].params, [
    "meter-1", "workload-1", "lease-1", "provider-1",
    "2026-08-26T08:00:00.000Z", "2026-08-26T08:00:01.000Z", 1000, 4, 3, 0.01, "completed",
    JSON.stringify({ route: "facf" })
  ]);
});

test("PostgresAuditLog registers a pool error handler so a transient error cannot crash the process", () => {
  const pool = fakePool();
  new PostgresAuditLog({ pool });
  assert.equal(pool.errorHandlers.length, 1);
});

test("PostgresAuditLog requires a pool", () => {
  assert.throws(() => new PostgresAuditLog({}), TypeError);
});

test("createAuditLogFromEnv returns null when DATABASE_URL is not set", async () => {
  const auditLog = await createAuditLogFromEnv({});
  assert.equal(auditLog, null);
});
