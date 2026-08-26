import test from "node:test";
import assert from "node:assert/strict";
import { LeaseConflictError, LeaseStore } from "../src/core/lease-store.js";
import { offer, workload } from "../test-support/helpers.js";

test("one offer cannot be double leased", () => {
  const store = new LeaseStore({ clock: () => new Date("2026-08-26T08:00:00.000Z"), idFactory: () => "lease-1" });
  store.acquire(workload(), offer());
  assert.throws(() => store.acquire(workload({ workloadId: "workload-2" }), offer()), LeaseConflictError);
});

test("lease state machine rejects invalid transitions and releases capacity", () => {
  let id = 0;
  const store = new LeaseStore({ clock: () => new Date("2026-08-26T08:00:00.000Z"), idFactory: () => `lease-${++id}` });
  const lease = store.acquire(workload(), offer());
  assert.throws(() => store.transition(lease.leaseId, "completed"), /invalid lease transition/);
  store.transition(lease.leaseId, "accepted");
  store.transition(lease.leaseId, "running");
  store.transition(lease.leaseId, "completed");
  assert.equal(store.acquire(workload({ workloadId: "workload-2" }), offer()).state, "offered");
});

test("expired lease frees the slot", () => {
  let now = new Date("2026-08-26T08:00:00.000Z");
  let id = 0;
  const store = new LeaseStore({ clock: () => now, idFactory: () => `lease-${++id}`, ttlMs: 1000 });
  const first = store.acquire(workload(), offer());
  now = new Date("2026-08-26T08:00:02.000Z");
  const second = store.acquire(workload({ workloadId: "workload-2" }), offer());
  assert.equal(store.get(first.leaseId).state, "expired");
  assert.equal(second.state, "offered");
});
