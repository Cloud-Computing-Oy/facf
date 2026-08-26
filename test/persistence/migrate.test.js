import test from "node:test";
import assert from "node:assert/strict";
import { runMigrations } from "../../scripts/migrate.mjs";

const migrationsDir = new URL("../../db/migrations/", import.meta.url);

function createFakePool({ appliedIds = [], failOn } = {}) {
  const applied = new Set(appliedIds);
  const executed = [];
  const client = {
    async query(sql, params) {
      const text = sql.trim();
      executed.push(text);
      if (failOn && text.includes(failOn)) throw new Error("boom");
      if (text.startsWith("INSERT INTO schema_migrations")) applied.add(params[0]);
      return { rows: [] };
    },
    release() {}
  };
  return {
    executed,
    applied,
    async connect() { return client; },
    async query(sql) {
      const text = sql.trim();
      executed.push(text);
      if (text.startsWith("SELECT id FROM schema_migrations")) return { rows: [...applied].map((id) => ({ id })) };
      return { rows: [] };
    }
  };
}

test("runMigrations applies pending migration files in order inside a transaction", async () => {
  const pool = createFakePool();
  const applied = await runMigrations({ pool, migrationsDir });
  assert.deepEqual(applied, ["0001_init.sql"]);
  assert.ok(pool.executed.includes("BEGIN"));
  assert.ok(pool.executed.includes("COMMIT"));
  assert.ok(pool.executed.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS leases")));
  assert.ok(pool.applied.has("0001_init.sql"));
});

test("runMigrations is idempotent once a migration is already recorded", async () => {
  const pool = createFakePool({ appliedIds: ["0001_init.sql"] });
  const applied = await runMigrations({ pool, migrationsDir });
  assert.deepEqual(applied, []);
});

test("runMigrations rolls back and rethrows when a migration file fails", async () => {
  const pool = createFakePool({ failOn: "CREATE TABLE IF NOT EXISTS leases" });
  await assert.rejects(() => runMigrations({ pool, migrationsDir }), /boom/);
  assert.ok(pool.executed.includes("ROLLBACK"));
  assert.equal(pool.applied.has("0001_init.sql"), false);
});
