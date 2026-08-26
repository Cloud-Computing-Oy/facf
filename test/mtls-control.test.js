import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { connectControlAgent, createMtlsControlServer } from "../src/control/mtls-control.js";
import { ProviderRegistry } from "../src/control/provider-registry.js";

test("outbound mTLS agent heartbeat is authenticated and enrolled", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const address = server.address();
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-1", capabilityId: "cap-1", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const socket = connectControlAgent({ host: "127.0.0.1", port: address.port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-1", capability, heartbeatMs: 10000, idFactory: () => "message-1" });
  t.after(() => socket.destroy());
  const reply = await nextLine(socket);
  assert.deepEqual(reply, { protocolVersion: "v0alpha1", type: "ack", messageId: "message-1" });
  assert.equal(registry.getActive()[0].capability.providerId, "provider-1");
});

test("CA-valid agent still fails closed when it is not enrolled", async (t) => {
  const certificates = testCertificates();
  t.after(() => rmSync(certificates.root, { recursive: true, force: true }));
  const registry = new ProviderRegistry({ enrollments: [{ agentId: "agent-1", providerId: "provider-1" }] });
  const server = createMtlsControlServer({ key: certificates.serverKey, cert: certificates.serverCert, ca: certificates.ca, registry });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => server.close());
  const capability = { protocolVersion: "v0alpha1", providerId: "provider-2", capabilityId: "cap-2", models: ["qwen2.5:7b"], runtime: "ollama", region: "FI", trustTier: "community", slots: 1, expiresAt: new Date().toISOString() };
  const socket = connectControlAgent({ host: "127.0.0.1", port: server.address().port, servername: "broker.test", key: certificates.clientKey, cert: certificates.clientCert, ca: certificates.ca, agentId: "agent-2", capability, heartbeatMs: 10000 });
  t.after(() => socket.destroy());
  const reply = await nextLine(socket);
  assert.equal(reply.type, "error");
  assert.equal(reply.code, "agent_not_enrolled");
  assert.deepEqual(registry.getActive(), []);
});

function nextLine(socket) {
  return new Promise((resolve, reject) => {
    let data = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      data += chunk;
      const newline = data.indexOf("\n");
      if (newline >= 0) resolve(JSON.parse(data.slice(0, newline)));
    });
    socket.once("error", reject);
  });
}

function testCertificates() {
  const root = mkdtempSync(join(tmpdir(), "facf-mtls-"));
  const path = (name) => join(root, name);
  run(root, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.crt", "-subj", "/CN=FACF Test CA", "-days", "1"]);
  run(root, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "server.key", "-out", "server.csr", "-subj", "/CN=broker.test"]);
  writeFileSync(path("server.ext"), "subjectAltName=DNS:broker.test\nextendedKeyUsage=serverAuth\n");
  run(root, ["x509", "-req", "-in", "server.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "server.crt", "-days", "1", "-extfile", "server.ext"]);
  run(root, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "client.key", "-out", "client.csr", "-subj", "/CN=agent-1"]);
  writeFileSync(path("client.ext"), "extendedKeyUsage=clientAuth\n");
  run(root, ["x509", "-req", "-in", "client.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-out", "client.crt", "-days", "1", "-extfile", "client.ext"]);
  return { root, ca: readFileSync(path("ca.crt")), serverKey: readFileSync(path("server.key")), serverCert: readFileSync(path("server.crt")), clientKey: readFileSync(path("client.key")), clientCert: readFileSync(path("client.crt")) };
}

function run(cwd, args) {
  execFileSync("openssl", args, { cwd, stdio: "ignore" });
}
