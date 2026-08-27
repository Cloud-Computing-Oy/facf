import test from "node:test";
import assert from "node:assert/strict";
import { NatsEventPublisher, createEventPublisherFromEnv } from "../../src/persistence/nats-event-publisher.js";

function fakeConnection() {
  const calls = [];
  return {
    calls,
    closed: false,
    publish(subject, data) { calls.push({ subject, data }); },
    async close() { this.closed = true; }
  };
}

function decode(data) {
  return JSON.parse(new TextDecoder().decode(data));
}

test("publishLease publishes to facf.leases.<state> with the lease as JSON", async () => {
  const connection = fakeConnection();
  const publisher = new NatsEventPublisher({ connection });
  const lease = {
    leaseId: "lease-1", workloadId: "workload-1", offerId: "offer-1", providerId: "provider-1",
    state: "completed", issuedAt: "2026-08-27T08:00:00.000Z", expiresAt: "2026-08-27T08:00:30.000Z", attempt: 1
  };
  await publisher.publishLease(lease);
  assert.equal(connection.calls.length, 1);
  assert.equal(connection.calls[0].subject, "facf.leases.completed");
  assert.deepEqual(decode(connection.calls[0].data), lease);
});

test("publishLease uses the lease's own state in the subject, not a hardcoded one", async () => {
  const connection = fakeConnection();
  const publisher = new NatsEventPublisher({ connection });
  await publisher.publishLease({ leaseId: "lease-2", state: "released" });
  assert.equal(connection.calls[0].subject, "facf.leases.released");
});

test("publishMeter publishes every meter to the single facf.meters.recorded subject", async () => {
  const connection = fakeConnection();
  const publisher = new NatsEventPublisher({ connection });
  const meter = {
    meterId: "meter-1", workloadId: "workload-1", leaseId: "lease-1", providerId: "provider-1",
    startedAt: "2026-08-27T08:00:00.000Z", completedAt: "2026-08-27T08:00:01.000Z", durationMs: 1000,
    inputTokens: 4, outputTokens: 3, priceEur: 0.01, outcome: "completed", metadata: { route: "facf" }
  };
  await publisher.publishMeter(meter);
  assert.equal(connection.calls.length, 1);
  assert.equal(connection.calls[0].subject, "facf.meters.recorded");
  assert.deepEqual(decode(connection.calls[0].data), meter);
});

test("publishMeter uses the same subject regardless of outcome", async () => {
  const connection = fakeConnection();
  const publisher = new NatsEventPublisher({ connection });
  await publisher.publishMeter({ meterId: "meter-2", outcome: "fallback" });
  assert.equal(connection.calls[0].subject, "facf.meters.recorded");
});

test("NatsEventPublisher requires a connection", () => {
  assert.throws(() => new NatsEventPublisher({}), TypeError);
});

test("createEventPublisherFromEnv returns null when NATS_URL is not set", async () => {
  const publisher = await createEventPublisherFromEnv({});
  assert.equal(publisher, null);
});

test("createEventPublisherFromEnv connects with the plain URL when no credentials are configured", async () => {
  const connectCalls = [];
  const loadNatsImpl = async () => ({
    async connect(options) { connectCalls.push(options); return fakeConnection(); }
  });
  const publisher = await createEventPublisherFromEnv({ NATS_URL: "tls://nats.example.com:4222" }, { loadNatsImpl });
  assert.ok(publisher instanceof NatsEventPublisher);
  assert.equal(connectCalls.length, 1);
  assert.equal(connectCalls[0].servers, "tls://nats.example.com:4222");
  assert.equal(connectCalls[0].authenticator, undefined);
  assert.equal(connectCalls[0].tls, undefined);
});

test("createEventPublisherFromEnv rejects (fail-loud) when the connection attempt fails", async () => {
  const loadNatsImpl = async () => ({
    async connect() { throw new Error("connection refused"); }
  });
  await assert.rejects(
    () => createEventPublisherFromEnv({ NATS_URL: "tls://nats.example.com:4222" }, { loadNatsImpl }),
    /connection refused/
  );
});
