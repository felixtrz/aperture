#!/usr/bin/env node
// Minimal MCP stdio client for `aperture mcp stdio`. Speaks newline-delimited
// JSON-RPC 2.0. Reads a JSON array of {method, params} calls from stdin and
// prints each response. initialize + notifications/initialized are sent first.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";

const [appDir] = process.argv.slice(2);
const appAbs = path.resolve(appDir);
const bin = path.join(appAbs, "node_modules/.bin/aperture");
const child = spawn(bin, ["mcp", "stdio"], { cwd: appAbs });

const pending = new Map();
let nextId = 1;
const rl = createInterface({ input: child.stdout });
const stderrChunks = [];
child.stderr.on("data", (d) => stderrChunks.push(d.toString()));
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}
function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

async function main() {
  const raw = await new Promise((res) => {
    let s = ""; process.stdin.on("data", (d) => (s += d)); process.stdin.on("end", () => res(s));
  });
  const calls = JSON.parse(raw);
  const out = { results: [] };

  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "battletest-mcp-driver", version: "1.0.0" },
  });
  out.initialize = { serverInfo: init.result?.serverInfo, protocolVersion: init.result?.protocolVersion };
  notify("notifications/initialized", {});

  for (const c of calls) {
    const resp = await rpc(c.method, c.params);
    out.results.push({ method: c.method, params: c.params ?? null, response: resp });
  }
  child.stdin.end();
  out.stderr = stderrChunks.join("").slice(0, 2000);
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  setTimeout(() => process.exit(0), 100);
}
main();
