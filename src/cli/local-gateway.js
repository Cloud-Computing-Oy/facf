#!/usr/bin/env node
import { createLocalOllamaGateway, localGatewayConfig } from "../gateway/local-ollama.js";
import { listenLocal } from "../gateway/server.js";
import { createAuditLogFromEnv } from "../persistence/postgres-audit-log.js";

try {
  const config = localGatewayConfig();
  const auditLog = await createAuditLogFromEnv();
  if (auditLog) console.log("FACF audit persistence enabled (DATABASE_URL set).");
  const server = createLocalOllamaGateway(config, {
    logger: ({ event, requestId, route, providerId, code, kind, leaseId, meterId }) =>
      console.log(JSON.stringify({ event, requestId, route, providerId, code, kind, leaseId, meterId })),
    auditLog
  });
  const address = await listenLocal(server, { host: config.host, port: config.port });
  console.log(`FACF local gateway listening on http://${address.address}:${address.port}`);
  const shutdown = () => server.close(async () => {
    await auditLog?.pool.end().catch(() => {});
    process.exit(0);
  });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : "FACF gateway startup failed");
  process.exitCode = 2;
}
