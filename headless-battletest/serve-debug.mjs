#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "app");
const cli = path.join(appDir, "node_modules/@aperture-engine/cli/dist/bin/aperture.js");
const child = spawn("node", [cli, "headless", "serve", "aperture.headless.config.ts", "--seed", "1"], { cwd: appDir });
const rl = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1, readyResolve;
const ready = new Promise((r) => (readyResolve = r));
rl.on("line", (line) => {
  if (!line.trim()) return;
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.ready === true && m.id === undefined) return readyResolve(m);
  const res = pending.get(m.id); if (res) { pending.delete(m.id); res(m); }
});
child.stderr.on("data", (d) => process.stderr.write(`[serve] ${d}`));
const send = (cmd, params = {}) => new Promise((resolve) => {
  const id = nextId++; pending.set(id, resolve);
  child.stdin.write(JSON.stringify({ id, cmd, params }) + "\n");
});
const dump = (label, r) => console.log(`\n### ${label}\n` + JSON.stringify(r, null, 1).slice(0, 1400));

await ready;
await send("step", { frames: 90 });

dump("ecs_find_entities tag=star", await send("tool", { name: "ecs_find_entities", arguments: { tags: ["star"], limit: 3 } }));
dump("ecs_find_entities withComponents=[starfall.star]", await send("tool", { name: "ecs_find_entities", arguments: { withComponents: ["starfall.star"], limit: 3 } }));
dump("ecs_find_entities withComponents=[Star]", await send("tool", { name: "ecs_find_entities", arguments: { withComponents: ["Star"], limit: 3 } }));
dump("reset seed=7", await send("reset", { seed: 7 }));
await send("shutdown");
child.stdin.end();
