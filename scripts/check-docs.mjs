import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "TRADEMARKS.md",
  "agent-os/product/mission.md",
  "agent-os/product/roadmap.md",
  "agent-os/product/tech-stack.md",
  "docs/README.md",
  "docs/architecture.md",
  "docs/commercial-strategy.md",
  "docs/control-and-defensibility.md",
  "docs/economics.md",
  "docs/governance.md",
  "docs/ip-and-licensing.md",
  "docs/mvp-scope.md",
  "docs/operator-guide.md",
  "docs/protocol.md",
  "docs/provider-guide.md",
  "docs/scheduling.md",
  "docs/threat-model.md",
  "docs/trust-model.md",
];

const failures = [];

for (const path of required) {
  if (!existsSync(join(root, path))) failures.push(`Missing required file: ${path}`);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git") return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

for (const file of walk(root).filter((path) => extname(path) === ".md")) {
  const source = readFileSync(file, "utf8");
  const links = source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g);

  for (const match of links) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (/^(https?:|mailto:|#)/.test(rawTarget)) continue;
    const pathPart = decodeURIComponent(rawTarget.split("#", 1)[0]);
    if (!pathPart) continue;
    const target = normalize(resolve(dirname(file), pathPart));
    const display = relative(root, file);
    if (!target.startsWith(`${root}${sep}`) && target !== root) {
      failures.push(`${display}: link escapes repository: ${rawTarget}`);
    } else if (!existsSync(target)) {
      failures.push(`${display}: missing link target: ${rawTarget}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Documentation validation passed (${required.length} required files).`);
