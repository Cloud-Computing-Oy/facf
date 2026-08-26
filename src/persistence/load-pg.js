export async function loadPg() {
  try {
    const imported = await import("pg");
    return imported.default ?? imported;
  } catch {
    throw new Error("DATABASE_URL is set but the optional 'pg' dependency is not installed — run npm install pg");
  }
}
