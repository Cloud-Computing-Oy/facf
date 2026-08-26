import tls from "node:tls";
import { randomUUID } from "node:crypto";
import { ControlMessageError } from "./provider-registry.js";
import { AgentLeaseError } from "./agent-lease-authority.js";
import { validateExecutionGrant, validateLeaseRequest } from "../protocol/validate.js";

export class LeaseNegotiationError extends Error {
  constructor(code, message) { super(message); this.name = "LeaseNegotiationError"; this.code = code; }
}

export function createMtlsControlServer({ key, cert, ca, registry, maxMessageBytes = 65536, idleTimeoutMs = 30000, logger = () => {} } = {}) {
  if (!key || !cert || !ca || !registry) throw new TypeError("key, cert, ca, and registry are required");
  const connections = new Map();
  const pending = new Map();
  const server = tls.createServer({ key, cert, ca, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.3" }, (socket) => {
    let connectedProviderId;
    // Without this listener, Node treats socket.destroy(err) (and any other socket
    // error) as an unhandled 'error' event and crashes the process — letting any
    // CA-trusted client take down the control server with one bad message.
    socket.on("error", (error) => logger({ event: "control_socket_error", providerId: connectedProviderId, code: error.code ?? error.message }));
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
          const message = JSON.parse(line);
          if (message.type === "lease_decision") {
            handleLeaseDecision(message, connectedProviderId, pending);
            continue;
          }
          const certificate = socket.getPeerCertificate();
          const accepted = registry.accept({ authorized: socket.authorized, commonName: certificate.subject?.CN, fingerprint256: certificate.fingerprint256 }, message);
          connectedProviderId = accepted.capability.providerId;
          connections.set(connectedProviderId, socket);
          socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "ack", messageId: accepted.lastMessageId })}\n`);
          logger({ event: "capability_accepted", providerId: accepted.capability.providerId, agentId: accepted.agentId });
        } catch (error) {
          const code = error instanceof ControlMessageError ? error.code : "invalid_message";
          logger({ event: "control_rejected", code });
          socket.end(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "error", code })}\n`);
        }
      }
    });
    socket.once("close", () => {
      if (connectedProviderId && connections.get(connectedProviderId) === socket) connections.delete(connectedProviderId);
      for (const [messageId, entry] of pending) if (entry.providerId === connectedProviderId) { clearTimeout(entry.timer); pending.delete(messageId); entry.reject(new LeaseNegotiationError("provider_disconnected", "provider disconnected during lease negotiation")); }
    });
  });
  server.requestLease = (providerId, value, { timeoutMs = 5000, idFactory = randomUUID } = {}) => {
    const request = validateLeaseRequest(structuredClone(value));
    if (request.providerId !== providerId) return Promise.reject(new LeaseNegotiationError("provider_mismatch", "lease request targets another provider"));
    if (!registry.getActive().some((entry) => entry.capability.providerId === providerId)) return Promise.reject(new LeaseNegotiationError("provider_inactive", "provider is not active"));
    const socket = connections.get(providerId);
    if (!socket || socket.destroyed) return Promise.reject(new LeaseNegotiationError("provider_disconnected", "provider control connection is unavailable"));
    const messageId = idFactory();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(messageId); reject(new LeaseNegotiationError("lease_timeout", "provider did not answer the lease request")); }, timeoutMs);
      timer.unref();
      pending.set(messageId, { providerId, request, resolve, reject, timer });
      socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "lease_request", messageId, payload: request })}\n`);
    });
  };
  return server;
}

export function connectControlAgent({ host, port, servername, key, cert, ca, agentId, capability, leaseAuthority = null, heartbeatMs = 10000, clock = () => new Date(), idFactory = randomUUID } = {}) {
  if (!host || !port || !servername || !key || !cert || !ca || !agentId || !capability) throw new TypeError("complete mTLS agent configuration is required");
  const socket = tls.connect({ host, port, servername, key, cert, ca, rejectUnauthorized: true, minVersion: "TLSv1.3" });
  const send = () => socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", messageId: idFactory(), sentAt: clock().toISOString(), agentId, type: "capability", payload: { ...capability, expiresAt: new Date(clock().getTime() + Math.min(heartbeatMs * 2, 30000)).toISOString() } })}\n`);
  socket.once("secureConnect", send);
  let buffered = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffered += chunk;
    let newline;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline); buffered = buffered.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { socket.destroy(new Error("broker sent invalid JSON")); return; }
      if (message.type !== "lease_request") continue;
      if (!leaseAuthority) { socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "lease_decision", messageId: idFactory(), inReplyTo: message.messageId, status: "rejected", code: "lease_authority_unavailable" })}\n`); continue; }
      try {
        const grant = leaseAuthority.request(message.payload);
        socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "lease_decision", messageId: idFactory(), inReplyTo: message.messageId, status: "accepted", grant })}\n`);
      } catch (error) {
        const code = error instanceof AgentLeaseError ? error.code : "invalid_lease_request";
        socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "lease_decision", messageId: idFactory(), inReplyTo: message.messageId, status: "rejected", code })}\n`);
      }
    }
  });
  const timer = setInterval(() => { if (!socket.destroyed) send(); }, heartbeatMs);
  timer.unref();
  socket.once("close", () => clearInterval(timer));
  return socket;
}

function handleLeaseDecision(message, connectedProviderId, pending) {
  const entry = pending.get(message.inReplyTo);
  if (!entry) throw new LeaseNegotiationError("unknown_correlation", "lease decision does not match a pending request");
  pending.delete(message.inReplyTo); clearTimeout(entry.timer);
  if (entry.providerId !== connectedProviderId) { entry.reject(new LeaseNegotiationError("provider_identity_mismatch", "lease decision came from another provider")); return; }
  if (message.status === "rejected") { entry.reject(new LeaseNegotiationError(typeof message.code === "string" ? message.code : "lease_rejected", "provider rejected the lease request")); return; }
  if (message.status !== "accepted") { entry.reject(new LeaseNegotiationError("invalid_decision", "provider returned an invalid lease decision")); return; }
  try {
    const grant = validateExecutionGrant(structuredClone(message.grant));
    const request = entry.request;
    if (grant.leaseId !== request.leaseId || grant.workloadId !== request.workloadId || grant.providerId !== request.providerId || grant.model !== request.model || Date.parse(grant.expiresAt) > Date.parse(request.expiresAt)) throw new LeaseNegotiationError("grant_binding_mismatch", "execution grant does not match the lease request");
    entry.resolve(grant);
  } catch (error) { entry.reject(error instanceof LeaseNegotiationError ? error : new LeaseNegotiationError("invalid_grant", "provider returned an invalid execution grant")); }
}
