#!/usr/bin/env node
// Minimal MCP (JSON-RPC over newline-delimited stdio) client that drives the
// agent-facing `aperture mcp stdio` headless surface end to end.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "app");
const cli = path.join(appDir, "node_modules/@aperture-engine/cli/dist/bin/aperture.js");

const child = spawn("node", [cli, "mcp", "stdio"], { cwd: appDir });
const rl = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 1;
rl.on("line", (line) => {
  if (!line.trim()) return;
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (m.id !== undefined && pending.has(m.id)) {
    const r = pending.get(m.id);
    pending.delete(m.id);
    r(m);
  }
});
child.stderr.on("data", (d) => process.stderr.write(`[mcp] ${d}`));

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}
async function callTool(name, args) {
  const res = await rpc("tools/call", { name, arguments: args });
  // Unwrap MCP tool result content (text json).
  const content = res.result?.content ?? [];
  const textItem = content.find((c) => c.type === "text");
  let parsed;
  try { parsed = textItem ? JSON.parse(textItem.text) : res.result; } catch { parsed = textItem?.text; }
  const imageItem = content.find((c) => c.type === "image");
  return { raw: res, parsed, image: imageItem, isError: res.result?.isError, error: res.error };
}
const short = (o, n = 90) => JSON.stringify(o).slice(0, n);

// 1. initialize handshake
const init = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "mcp-smoke", version: "0" },
});
console.log("initialize -> server:", short(init.result?.serverInfo), "protocol:", init.result?.protocolVersion);
notify("notifications/initialized", {});

// 2. tools/list
const list = await rpc("tools/list", {});
const tools = list.result?.tools ?? [];
console.log(`tools/list -> ${tools.length} tools`);
console.log("  names:", tools.map((t) => t.name).join(", "));

// 3. app_start headless
let r = await callTool("app_start", { target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" });
console.log("\napp_start(headless):", r.isError ? `ERROR ${short(r.parsed)}` : short(r.parsed));

// 4. app_status
r = await callTool("app_status", { target: "headless" });
console.log("app_status:", short(r.parsed, 120));

// 5. ecs_step 90
r = await callTool("ecs_step", { target: "headless", frames: 90 });
console.log("ecs_step(90):", short(r.parsed, 120));

// 6. ecs_find_entities stars
r = await callTool("ecs_find_entities", { target: "headless", tags: ["star"], limit: 100 });
const stars = r.parsed?.summaries ?? r.parsed?.result?.summaries ?? [];
console.log("ecs_find_entities(star):", Array.isArray(stars) ? `${stars.length} stars` : short(r.parsed, 100));

// 7. frame_capture
r = await callTool("frame_capture", { target: "headless", width: 320, height: 240 });
console.log("frame_capture:", r.image ? `image ${r.image.mimeType} ~${Math.round((r.image.data?.length ?? 0) * 0.75)}B decoded` : short(r.parsed, 140));

// 8. app_stop
r = await callTool("app_stop", { target: "headless" });
console.log("app_stop:", short(r.parsed, 80));

child.stdin.end();
setTimeout(() => process.exit(0), 300);
