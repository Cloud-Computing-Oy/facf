import test from "node:test";
import assert from "node:assert/strict";
import { createEventPublisherFromEnv } from "../../src/persistence/nats-event-publisher.js";

const testNatsUrl = process.env.FACF_TEST_NATS_URL;
const skip = testNatsUrl ? false : "FACF_TEST_NATS_URL is not set; skipping live NATS integration test";

test("NatsEventPublisher's published lease and meter events reach a live subscriber", { skip }, async (t) => {
  const publisher = await createEventPublisherFromEnv({ NATS_URL: testNatsUrl });
  t.after(() => publisher.connection.close());

  const subscription = publisher.connection.subscribe("facf.>");
  await publisher.connection.flush(); // ensure the SUB has reached the server before we publish

  const received = [];
  const drained = (async () => {
    for await (const message of subscription) {
      received.push({ subject: message.subject, data: JSON.parse(new TextDecoder().decode(message.data)) });
      if (received.length === 2) break;
    }
  })();

  const lease = {
    leaseId: `it-lease-${Date.now()}`, workloadId: "workload-it", offerId: "offer-it", providerId: "provider-it",
    state: "completed", issuedAt: "2026-08-27T08:00:00.000Z", expiresAt: "2026-08-27T08:00:30.000Z", attempt: 1
  };
  const meter = {
    meterId: `it-meter-${Date.now()}`, workloadId: "workload-it", leaseId: lease.leaseId, providerId: "provider-it",
    startedAt: "2026-08-27T08:00:00.000Z", completedAt: "2026-08-27T08:00:01.000Z", durationMs: 1000,
    inputTokens: 4, outputTokens: 3, priceEur: 0.01, outcome: "completed", metadata: { route: "facf" }
  };
  await publisher.publishLease(lease);
  await publisher.publishMeter(meter);
  await drained;

  assert.equal(received.length, 2);
  assert.equal(received[0].subject, "facf.leases.completed");
  assert.deepEqual(received[0].data, lease);
  assert.equal(received[1].subject, "facf.meters.recorded");
  assert.deepEqual(received[1].data, meter);
});
