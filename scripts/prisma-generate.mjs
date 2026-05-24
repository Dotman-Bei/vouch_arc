import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const requireFromWorkspace = createRequire(path.join(cwd, "package.json"));
const prismaCli = requireFromWorkspace.resolve("prisma/build/index.js");
const maxAttempts = process.platform === "win32" ? 3 : 1;

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function generatedClientExists() {
  try {
    const clientPkg = requireFromWorkspace.resolve("@prisma/client/package.json");
    const clientDir = path.dirname(clientPkg);
    const generatedDir = path.resolve(clientDir, "../../.prisma/client");
    return fs.existsSync(path.join(generatedDir, "default.js")) || fs.existsSync(path.join(generatedDir, "index.js"));
  } catch {
    return false;
  }
}

function runGenerate() {
  return spawnSync(process.execPath, [prismaCli, "generate"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...parseEnv(path.resolve(cwd, "../.env")) },
  });
}

let last = null;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  last = runGenerate();
  if (last.status === 0) process.exit(0);

  const output = `${last.stdout ?? ""}\n${last.stderr ?? ""}`;
  const prismaClientLocked =
    process.platform === "win32" &&
    output.includes("EPERM") &&
    output.includes("unlink") &&
    output.includes(".prisma\\client");

  if (!prismaClientLocked) {
    if (last.stdout) process.stdout.write(last.stdout);
    if (last.stderr) process.stderr.write(last.stderr);
    if (last.error) console.error(last.error.message);
    break;
  }

  if (attempt === maxAttempts) break;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
}

const output = `${last?.stdout ?? ""}\n${last?.stderr ?? ""}`;
const prismaClientLocked =
  process.platform === "win32" &&
  output.includes("EPERM") &&
  output.includes("unlink") &&
  output.includes(".prisma\\client");

if (prismaClientLocked && generatedClientExists()) {
  console.warn(
    "Prisma generate hit a Windows file lock, but an existing generated client is present. " +
    "Continuing so the build can use the current client; stop running Node/Next processes and rerun pnpm db:generate for a clean regenerate.",
  );
  process.exit(0);
}

if (last?.stdout) process.stdout.write(last.stdout);
if (last?.stderr) process.stderr.write(last.stderr);
if (last?.error) console.error(last.error.message);
process.exit(last?.status ?? 1);
