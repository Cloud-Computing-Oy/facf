#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { loadPg } from "../src/persistence/load-pg.js";

export async function ensureMigrationsTable(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  );
}

export async function appliedMigrationIds(pool) {
  const { rows } = await pool.query("SELECT id FROM schema_migrations");
  return new Set(rows.map((row) => row.id));
}

export async function pendingMigrationFiles(migrationsDir, appliedIds) {
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  return files.filter((name) => !appliedIds.has(name));
}

export async function runMigrations({ pool, migrationsDir = new URL("../db/migrations/", import.meta.url) } = {}) {
  await ensureMigrationsTable(pool);
  const applied = await appliedMigrationIds(pool);
  const pending = await pendingMigrationFiles(migrationsDir, applied);
  const results = [];
  for (const file of pending) {
    const sql = await readFile(new URL(file, migrationsDir), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      results.push(file);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return results;
}

if (import.meta.filename === process.argv[1]) {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations");
    const pg = await loadPg();
    const pool = new pg.Pool({ connectionString: databaseUrl });
    pool.on("error", () => {});
    try {
      const applied = await runMigrations({ pool });
      console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "No pending migrations.");
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "FACF migration run failed");
    process.exitCode = 2;
  }
}
