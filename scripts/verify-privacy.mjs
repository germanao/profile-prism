import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const targets = ["chrome", "edge", "firefox", "safari"];
const failures = [];

for (const target of targets) {
  const directory = path.join(root, "dist", target);
  const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
  const permissions = manifest.permissions ?? [];
  if (JSON.stringify(permissions) !== JSON.stringify(["storage"])) {
    failures.push(`${target}: permissions must be exactly [\"storage\"]`);
  }
  for (const forbiddenKey of [
    "host_permissions",
    "optional_permissions",
    "optional_host_permissions",
    "background",
    "externally_connectable",
    "web_accessible_resources"
  ]) {
    if (manifest[forbiddenKey]) {
      failures.push(`${target}: manifest key ${forbiddenKey} is not allowed in v0.3`);
    }
  }
  const csp = manifest.content_security_policy?.extension_pages ?? "";
  if (!csp.includes("connect-src 'none'") || !csp.includes("script-src 'self'")) {
    failures.push(`${target}: extension CSP must prohibit connections and remote scripts`);
  }
  const matches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
  if (JSON.stringify(matches) !== JSON.stringify(["https://www.linkedin.com/*"])) {
    failures.push(`${target}: content script scope is broader or different than declared`);
  }

  for (const file of await listFiles(directory)) {
    if (!file.endsWith(".js")) continue;
    const source = await readFile(file, "utf8");
    const forbidden = [
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\bsendBeacon\b/,
      /linkedin\.com\/(?:voyager|graphql|api)\//i,
      /\bcookies\b/,
      /\bwebRequest\b/,
      /\beval\s*\(/,
      /\bnew\s+Function\b/
    ];
    for (const pattern of forbidden) {
      if (pattern.test(source)) failures.push(`${target}: forbidden runtime capability ${pattern} in ${path.basename(file)}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Privacy verification failed:\n- ${failures.join("\n- ")}`);
}

process.stdout.write("Privacy verification passed: profile processing is local, narrowly scoped, and network-free.\n");

async function listFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(entryPath));
    else if ((await stat(entryPath)).isFile()) result.push(entryPath);
  }
  return result;
}
