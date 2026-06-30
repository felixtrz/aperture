#!/usr/bin/env node
// A small client for `aperture headless serve`. Spawns the warm session,
// sends newline-delimited JSON commands, and resolves each response by id.
// Usage: node serve-driver.mjs <appDir> <configRelPath> [--seed N] [--asset-mode M] [--determinism D]
//        then pass a JSON array of commands on stdin, e.g.
//        echo '[{"cmd":"get-status"},{"cmd":"step"},{"cmd":"shutdown"}]' | node serve-driver.mjs app aperture.headless.config.ts
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";

const [appDir, configRel, ...flags] = process.argv.slice(2);
if (!appDir || !configRel) {
  console.error("usage: serve-driver.mjs <appDir> <configRel> [flags]");
  process.exit(2);
}
const abs = (p) => path.resolve(p);
const appAbs = abs(appDir);
const bin = path.join(appAbs, "node_modules/.bin/aperture");

const serveArgs = ["headless", "serve", configRel, "--root", appAbs, ...flags];
const child = spawn(bin, serveArgs, { cwd: appAbs });

const responses = [];
let ready = null;
const pending = new Map();
let nextId = 1;
const rl = createInterface({ input: child.stdout });
const stderrChunks = [];
child.stderr.on("data", (d) => stderrChunks.push(d.toString()));

rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    process.stderr.write(`[unparseable] ${line}\n`);
    return;
  }
  if (msg.ready === true && ready) {
    ready(msg);
    ready = null;
    return;
  }
  responses.push(msg);
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(cmd, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ id, cmd, ...(params ? { params } : {}) })}\n`);
  });
}

async function main() {
  const readyMsg = await new Promise((res) => {
    ready = res;
  });
  const raw = await new Promise((res) => {
    let s = "";
    process.stdin.on("data", (d) => (s += d));
    process.stdin.on("end", () => res(s));
  });
  const commands = JSON.parse(raw);
  const out = { ready: readyMsg, results: [] };
  for (const c of commands) {
    const resp = await send(c.cmd, c.params);
    out.results.push({ cmd: c.cmd, params: c.params ?? null, response: resp });
    if (c.cmd === "shutdown") break;
  }
  // ensure shutdown
  if (!commands.some((c) => c.cmd === "shutdown")) {
    out.results.push({ cmd: "shutdown", response: await send("shutdown") });
  }
  child.stdin.end();
  out.stderr = stderrChunks.join("");
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().then(() => {
  setTimeout(() => process.exit(0), 100);
});
