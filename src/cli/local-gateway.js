#!/usr/bin/env node
import { createLocalOllamaGateway, localGatewayConfig } from "../gateway/local-ollama.js";
import { listenLocal } from "../gateway/server.js";

try {
  const config = localGatewayConfig();
  const server = createLocalOllamaGateway(config, {
    logger: ({ event, requestId, route, providerId, code }) => console.log(JSON.stringify({ event, requestId, route, providerId, code }))
  });
  const address = await listenLocal(server, { host: config.host, port: config.port });
  console.log(`FACF local gateway listening on http://${address.address}:${address.port}`);
  const shutdown = () => server.close(() => process.exit(0));
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : "FACF gateway startup failed");
  process.exitCode = 2;
}
