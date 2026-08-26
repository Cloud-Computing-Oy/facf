import tls from "node:tls";
import { randomUUID } from "node:crypto";
import { ControlMessageError } from "./provider-registry.js";

export function createMtlsControlServer({ key, cert, ca, registry, maxMessageBytes = 65536, idleTimeoutMs = 30000, logger = () => {} } = {}) {
  if (!key || !cert || !ca || !registry) throw new TypeError("key, cert, ca, and registry are required");
  return tls.createServer({ key, cert, ca, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.3" }, (socket) => {
    socket.setTimeout(idleTimeoutMs, () => socket.destroy());
    let buffered = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffered += chunk;
      if (Buffer.byteLength(buffered) > maxMessageBytes) return socket.destroy(new Error("control message too large"));
      let newline;
      while ((newline = buffered.indexOf("\n")) >= 0) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (!line) continue;
        try {
          const certificate = socket.getPeerCertificate();
          const accepted = registry.accept({ authorized: socket.authorized, commonName: certificate.subject?.CN, fingerprint256: certificate.fingerprint256 }, JSON.parse(line));
          socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "ack", messageId: accepted.lastMessageId })}\n`);
          logger({ event: "capability_accepted", providerId: accepted.capability.providerId, agentId: accepted.agentId });
        } catch (error) {
          const code = error instanceof ControlMessageError ? error.code : "invalid_message";
          logger({ event: "control_rejected", code });
          socket.end(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "error", code })}\n`);
        }
      }
    });
  });
}

export function connectControlAgent({ host, port, servername, key, cert, ca, agentId, capability, heartbeatMs = 10000, clock = () => new Date(), idFactory = randomUUID } = {}) {
  if (!host || !port || !servername || !key || !cert || !ca || !agentId || !capability) throw new TypeError("complete mTLS agent configuration is required");
  const socket = tls.connect({ host, port, servername, key, cert, ca, rejectUnauthorized: true, minVersion: "TLSv1.3" });
  const send = () => socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", messageId: idFactory(), sentAt: clock().toISOString(), agentId, type: "capability", payload: { ...capability, expiresAt: new Date(clock().getTime() + Math.min(heartbeatMs * 2, 30000)).toISOString() } })}\n`);
  socket.once("secureConnect", send);
  const timer = setInterval(() => { if (!socket.destroyed) send(); }, heartbeatMs);
  timer.unref();
  socket.once("close", () => clearInterval(timer));
  return socket;
}
