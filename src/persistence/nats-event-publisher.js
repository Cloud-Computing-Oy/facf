import { readFile } from "node:fs/promises";
import { loadNats } from "./load-nats.js";

export class NatsEventPublisher {
  constructor({ connection }) {
    if (!connection) throw new TypeError("connection is required");
    this.connection = connection;
  }

  async publishLease(lease) {
    this.connection.publish(`facf.leases.${lease.state}`, new TextEncoder().encode(JSON.stringify(lease)));
  }

  async publishMeter(meter) {
    this.connection.publish("facf.meters.recorded", new TextEncoder().encode(JSON.stringify(meter)));
  }
}

export async function createEventPublisherFromEnv(env = process.env, { loadNatsImpl = loadNats } = {}) {
  const natsUrl = env.NATS_URL;
  if (!natsUrl) return null;
  const nats = await loadNatsImpl();
  const connectOptions = { servers: natsUrl, timeout: 5000, maxReconnectAttempts: -1 };
  if (env.NATS_CREDS_FILE) {
    connectOptions.authenticator = nats.credsAuthenticator(await readFile(env.NATS_CREDS_FILE));
  } else if (env.NATS_CLIENT_CERT_FILE || env.NATS_CLIENT_KEY_FILE || env.NATS_CA_FILE) {
    connectOptions.tls = {
      certFile: env.NATS_CLIENT_CERT_FILE,
      keyFile: env.NATS_CLIENT_KEY_FILE,
      caFile: env.NATS_CA_FILE
    };
  }
  const connection = await nats.connect(connectOptions);
  return new NatsEventPublisher({ connection });
}
