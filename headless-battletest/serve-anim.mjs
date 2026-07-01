#!/usr/bin/env node
// Drives the anim.headless.config in serve mode: steps past the poll frames and
// reads back diagnostics to see whether the animation mixer clock advances.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "app");
const cli = path.join(appDir, "node_modules/@aperture-engine/cli/dist/bin/aperture.js");

const child = spawn("node", [cli, "headless", "serve", "anim.headless.config.ts", "--seed", "1", "--asset-mode", "strict"], { cwd: appDir });
const rl = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1;
let readyResolve;
const ready = new Promise((r) => (readyResolve = r));
rl.on("line", (line) => {
  if (!line.trim()) return;
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (m.ready === true && m.id === undefined) return readyResolve(m);
  const res = pending.get(m.id);
  if (res) { pending.delete(m.id); res(m); }
});
child.stderr.on("data", (d) => process.stderr.write(`[serve] ${d}`));
const send = (cmd, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ id, cmd, params }) + "\n");
});

await ready;
console.log("=== anim mixer clock probe ===");
await send("step", { frames: 1 });   // init + play
await send("step", { frames: 4 });   // -> frame 5 poll
await send("step", { frames: 35 });  // -> frame 40 poll
await send("step", { frames: 40 });  // -> frame 80 poll

let r = await send("tool", { name: "logs_read", arguments: { limit: 60 } });
const logs = r.result?.logs ?? r.result?.entries ?? r.result?.diagnostics ?? [];
console.log("logs_read ok=", r.ok, "count=", Array.isArray(logs) ? logs.length : logs);
for (const l of (Array.isArray(logs) ? logs : [])) {
  const code = l.code ?? l.event ?? "";
  if (String(code).includes("anim")) console.log("  ", code, JSON.stringify(l.data ?? l.fields ?? l.message ?? {}));
}

await send("shutdown");
child.stdin.end();
setTimeout(() => process.exit(0), 300);
