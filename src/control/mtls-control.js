import tls from "node:tls";
import { createHash, randomUUID } from "node:crypto";
import { ControlMessageError } from "./provider-registry.js";
import { AgentLeaseError } from "./agent-lease-authority.js";
import { validateExecutionGrant, validateExecutionRequest, validateLeaseRequest, validateMeter, validateResult } from "../protocol/validate.js";

export class LeaseNegotiationError extends Error {
  constructor(code, message) { super(message); this.name = "LeaseNegotiationError"; this.code = code; }
}

export class RemoteExecutionError extends Error {
  constructor(code, message, { noFallback = false } = {}) {
    super(message);
    this.name = "RemoteExecutionError";
    this.code = code;
    this.noFallback = noFallback;
  }
}

export function createMtlsControlServer({ key, cert, ca, registry, maxMessageBytes = 262144, maxPendingRequests = 128, idleTimeoutMs = 30000, logger = () => {} } = {}) {
  if (!key || !cert || !ca || !registry) throw new TypeError("key, cert, ca, and registry are required");
  if (!Number.isInteger(maxMessageBytes) || maxMessageBytes < 1024) throw new RangeError("maxMessageBytes must be an integer >= 1024");
  if (!Number.isInteger(maxPendingRequests) || maxPendingRequests < 1) throw new RangeError("maxPendingRequests must be a positive integer");
  const connections = new Map();
  const pending = new Map();
  const server = tls.createServer({ key, cert, ca, requestCert: true, rejectUnauthorized: true, minVersion: "TLSv1.3" }, (socket) => {
    let connectedProviderId;
    // Without this listener, Node treats socket.destroy(err) (and any other socket
    // error) as an unhandled 'error' event and crashes the process — letting any
    // CA-trusted client take down the control server with one bad message.
    socket.on("error", (error) => {
      logger({ event: "control_socket_error", providerId: connectedProviderId, code: error.code ?? error.message });
      socket.destroy();
    });
    socket.setTimeout(idleTimeoutMs, () => socket.destroy());
    let buffered = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      buffered += chunk;
      let newline;
      while ((newline = buffered.indexOf("\n")) >= 0) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (!line) continue;
        if (Buffer.byteLength(line) > maxMessageBytes) return socket.destroy(new Error("control message too large"));
        try {
          const message = JSON.parse(line);
          if (message.type === "lease_decision") {
            handleLeaseDecision(message, connectedProviderId, pending);
            continue;
          }
          if (message.type === "execution_result") {
            handleExecutionResult(message, connectedProviderId, pending);
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
      if (Buffer.byteLength(buffered) > maxMessageBytes) socket.destroy(new Error("control message too large"));
    });
    socket.once("close", () => {
      if (connectedProviderId && connections.get(connectedProviderId) === socket) connections.delete(connectedProviderId);
      for (const [messageId, entry] of pending) if (entry.providerId === connectedProviderId) {
        clearTimeout(entry.timer);
        pending.delete(messageId);
        entry.reject(entry.kind === "execution"
          ? new RemoteExecutionError("execution_outcome_unknown", "provider disconnected after execution dispatch", { noFallback: true })
          : new LeaseNegotiationError("provider_disconnected", "provider disconnected during lease negotiation"));
      }
    });
  });
  server.requestLease = (providerId, value, { timeoutMs = 5000, idFactory = randomUUID } = {}) => {
    const request = validateLeaseRequest(structuredClone(value));
    if (request.providerId !== providerId) return Promise.reject(new LeaseNegotiationError("provider_mismatch", "lease request targets another provider"));
    if (!registry.getActive().some((entry) => entry.capability.providerId === providerId)) return Promise.reject(new LeaseNegotiationError("provider_inactive", "provider is not active"));
    const socket = connections.get(providerId);
    if (!socket || socket.destroyed) return Promise.reject(new LeaseNegotiationError("provider_disconnected", "provider control connection is unavailable"));
    if (pending.size >= maxPendingRequests) return Promise.reject(new LeaseNegotiationError("control_capacity_exceeded", "too many pending control requests"));
    const messageId = idFactory();
    const encoded = `${JSON.stringify({ protocolVersion: "v0alpha1", type: "lease_request", messageId, payload: request })}\n`;
    if (Buffer.byteLength(encoded) - 1 > maxMessageBytes) return Promise.reject(new LeaseNegotiationError("control_message_too_large", "lease request exceeds the message limit"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(messageId); reject(new LeaseNegotiationError("lease_timeout", "provider did not answer the lease request")); }, timeoutMs);
      timer.unref();
      pending.set(messageId, { kind: "lease", providerId, request, resolve, reject, timer });
      socket.write(encoded);
    });
  };
  server.requestExecution = (providerId, value, { timeoutMs = 30000, idFactory = randomUUID } = {}) => {
    const request = validateExecutionRequest(structuredClone(value));
    if (request.grant.providerId !== providerId) return Promise.reject(new RemoteExecutionError("provider_mismatch", "execution targets another provider"));
    if (!registry.getActive().some((entry) => entry.capability.providerId === providerId)) return Promise.reject(new RemoteExecutionError("provider_inactive", "provider is not active"));
    const socket = connections.get(providerId);
    if (!socket || socket.destroyed) return Promise.reject(new RemoteExecutionError("provider_disconnected", "provider control connection is unavailable"));
    if (pending.size >= maxPendingRequests) return Promise.reject(new RemoteExecutionError("control_capacity_exceeded", "too many pending control requests"));
    const messageId = idFactory();
    const encoded = `${JSON.stringify({ protocolVersion: "v0alpha1", type: "execution_request", messageId, payload: request })}\n`;
    if (Buffer.byteLength(encoded) - 1 > maxMessageBytes) return Promise.reject(new RemoteExecutionError("control_message_too_large", "execution request exceeds the message limit"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(messageId);
        reject(new RemoteExecutionError("execution_outcome_unknown", "provider did not return a terminal execution result", { noFallback: true }));
      }, timeoutMs);
      timer.unref();
      pending.set(messageId, { kind: "execution", providerId, request, resolve, reject, timer });
      socket.write(encoded);
    });
  };
  return server;
}

export function connectControlAgent({ host, port, servername, key, cert, ca, agentId, capability, leaseAuthority = null, executor = null, heartbeatMs = 10000, maxMessageBytes = 262144, maxExecutionCache = 128, clock = () => new Date(), idFactory = randomUUID, logger = () => {} } = {}) {
  if (!host || !port || !servername || !key || !cert || !ca || !agentId || !capability) throw new TypeError("complete mTLS agent configuration is required");
  if (!Number.isInteger(maxMessageBytes) || maxMessageBytes < 1024) throw new RangeError("maxMessageBytes must be an integer >= 1024");
  if (!Number.isInteger(maxExecutionCache) || maxExecutionCache < 1) throw new RangeError("maxExecutionCache must be a positive integer");
  const socket = tls.connect({ host, port, servername, key, cert, ca, rejectUnauthorized: true, minVersion: "TLSv1.3" });
  // Same crash risk as the server's accepted socket: without this listener, an
  // unhandled 'error' event (including our own socket.destroy(err) below on a
  // malformed broker message) takes down the whole agent process.
  socket.on("error", (error) => {
    logger({ event: "control_socket_error", code: error.code ?? error.message });
    socket.destroy();
  });
  const send = () => socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", messageId: idFactory(), sentAt: clock().toISOString(), agentId, type: "capability", payload: { ...capability, expiresAt: new Date(clock().getTime() + Math.min(heartbeatMs * 2, 30000)).toISOString() } })}\n`);
  const executions = new Map();
  socket.once("secureConnect", send);
  let buffered = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffered += chunk;
    let newline;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline); buffered = buffered.slice(newline + 1);
      if (!line) continue;
      if (Buffer.byteLength(line) > maxMessageBytes) { socket.destroy(new Error("broker control message too large")); return; }
      let message;
      try { message = JSON.parse(line); } catch { socket.destroy(new Error("broker sent invalid JSON")); return; }
      if (message.type === "execution_request") {
        void handleAgentExecution({ message, socket, leaseAuthority, executor, executions, maxExecutionCache, maxMessageBytes, clock });
        continue;
      }
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
    if (Buffer.byteLength(buffered) > maxMessageBytes) socket.destroy(new Error("broker control message too large"));
  });
  const timer = setInterval(() => { if (!socket.destroyed) send(); }, heartbeatMs);
  timer.unref();
  socket.once("close", () => clearInterval(timer));
  return socket;
}

async function handleAgentExecution({ message, socket, leaseAuthority, executor, executions, maxExecutionCache, maxMessageBytes, clock }) {
  const respond = (value) => {
    if (socket.destroyed) return;
    const encoded = `${JSON.stringify(value)}\n`;
    if (Buffer.byteLength(encoded) - 1 <= maxMessageBytes) socket.write(encoded);
    else socket.write(`${JSON.stringify({ protocolVersion: "v0alpha1", type: "execution_result", inReplyTo: value.inReplyTo, status: "rejected", code: "execution_result_too_large" })}\n`);
  };
  try {
    if (!leaseAuthority || !executor) throw new RemoteExecutionError("execution_unavailable", "remote execution is unavailable");
    const request = validateExecutionRequest(structuredClone(message.payload));
    const fingerprint = createHash("sha256").update(JSON.stringify(request)).digest("base64url");
    const existing = executions.get(request.executionId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new RemoteExecutionError("idempotency_conflict", "executionId was reused with different request data");
      const execution = await existing.promise;
      respond({ protocolVersion: "v0alpha1", type: "execution_result", inReplyTo: message.messageId, status: "completed", ...execution });
      return;
    }
    if (executions.size >= maxExecutionCache) throw new RemoteExecutionError("execution_cache_full", "execution replay cache is full");
    if (!leaseAuthority.authorize({ leaseId: request.grant.leaseId, token: request.grant.token, model: request.grant.model })) throw new RemoteExecutionError("grant_unauthorized", "execution grant is invalid or expired");
    const promise = (async () => {
      try {
        const execution = await executor.execute({ workload: request.workload, lease: request.lease });
        const result = validateResult(structuredClone(execution.result));
        const meter = validateMeter(structuredClone(execution.meter));
        validateTerminalBinding(request, result, meter);
        if (result.status !== "completed") throw new RemoteExecutionError(result.errorCode ?? "execution_failed", "provider execution failed");
        if (Date.parse(result.completedAt) > Date.parse(request.grant.expiresAt)) throw new RemoteExecutionError("execution_deadline_exceeded", "provider completed execution after the grant deadline");
        return { result, meter };
      } finally {
        leaseAuthority.release(request.lease.leaseId);
      }
    })();
    executions.set(request.executionId, { fingerprint, promise });
    const retentionMs = Math.max(1, Date.parse(request.grant.expiresAt) - clock().getTime() + 1000);
    const expiry = setTimeout(() => executions.delete(request.executionId), retentionMs);
    expiry.unref();
    const execution = await promise;
    respond({ protocolVersion: "v0alpha1", type: "execution_result", inReplyTo: message.messageId, status: "completed", ...execution });
  } catch (error) {
    respond({ protocolVersion: "v0alpha1", type: "execution_result", inReplyTo: message.messageId, status: "rejected", code: error?.code ?? "execution_failed" });
  }
}

function validateTerminalBinding(request, result, meter) {
  for (const value of [result, meter]) {
    if (value.leaseId !== request.lease.leaseId || value.workloadId !== request.workload.workloadId || value.providerId !== request.lease.providerId) {
      throw new RemoteExecutionError("terminal_binding_mismatch", "terminal evidence does not match execution request");
    }
  }
}

function handleLeaseDecision(message, connectedProviderId, pending) {
  const entry = pending.get(message.inReplyTo);
  if (!entry || entry.kind !== "lease") throw new LeaseNegotiationError("unknown_correlation", "lease decision does not match a pending request");
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

function handleExecutionResult(message, connectedProviderId, pending) {
  const entry = pending.get(message.inReplyTo);
  if (!entry || entry.kind !== "execution") throw new RemoteExecutionError("unknown_correlation", "execution result does not match a pending request");
  pending.delete(message.inReplyTo); clearTimeout(entry.timer);
  if (entry.providerId !== connectedProviderId) { entry.reject(new RemoteExecutionError("provider_identity_mismatch", "execution result came from another provider")); return; }
  if (message.status === "rejected") {
    const code = typeof message.code === "string" ? message.code : "execution_rejected";
    entry.reject(new RemoteExecutionError(code, "provider rejected execution", { noFallback: ["execution_result_too_large", "execution_deadline_exceeded"].includes(code) }));
    return;
  }
  if (message.status !== "completed") { entry.reject(new RemoteExecutionError("invalid_execution_result", "provider returned an invalid execution status")); return; }
  try {
    const result = validateResult(structuredClone(message.result));
    const meter = validateMeter(structuredClone(message.meter));
    validateTerminalBinding(entry.request, result, meter);
    entry.resolve({ result, meter });
  } catch {
    entry.reject(new RemoteExecutionError("invalid_execution_result", "provider returned invalid terminal evidence"));
  }
}
