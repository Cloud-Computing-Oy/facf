export async function loadNats() {
  try {
    const imported = await import("nats");
    return imported.default ?? imported;
  } catch {
    throw new Error("NATS_URL is set but the optional 'nats' dependency is not installed — run npm install nats");
  }
}
