#!/usr/bin/env node
// Broad coverage sweep of MCP tools I haven't yet exercised, on the headless
// slot (plus logs_read on the live headed slot). Prints PASS/FAIL per tool.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "app");
const cli = path.join(appDir, "node_modules/@aperture-engine/cli/dist/bin/aperture.js");
const child = spawn("node", [cli, "mcp", "stdio"], { cwd: appDir });
const rl = createInterface({ input: child.stdout });
const pending = new Map(); let nextId = 1;
rl.on("line", (l) => { if (!l.trim()) return; let m; try { m = JSON.parse(l); } catch { return; } if (m.id !== undefined && pending.has(m.id)) { const r = pending.get(m.id); pending.delete(m.id); r(m); } });
child.stderr.on("data", () => {});
const rpc = (method, params) => new Promise((res) => { const id = nextId++; pending.set(id, res); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
const notify = (m, p) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: m, params: p }) + "\n");
async function tool(name, args) {
  const res = await rpc("tools/call", { name, arguments: args });
  const t = (res.result?.content ?? []).find((c) => c.type === "text");
  let p; try { p = JSON.parse(t?.text ?? "{}"); } catch { p = t?.text; }
  // isError, or an ok:false anywhere in the (possibly nested) payload.
  const inner = p?.result ?? p;
  const failed = res.result?.isError === true || res.error !== undefined || inner?.ok === false || p?.ok === false;
  return { p, inner, failed, error: res.error };
}
const line = (label, r, extra = "") => console.log(`${r.failed ? "FAIL" : "PASS"}  ${label.padEnd(34)} ${extra || JSON.stringify(r.inner).slice(0, 80)}`);

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "sweep", version: "0" } });
notify("notifications/initialized", {});
await tool("app_start", { target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" });
await tool("ecs_step", { target: "headless", frames: 120 });
const T = "headless";

console.log("=== ECS inspection tools ===");
line("ecs_snapshot", await tool("ecs_snapshot", { target: T }), "");
let r = await tool("ecs_query", { target: T, withComponents: ["starfall.star"], limit: 3 });
line("ecs_query withComponents=Star", r, `matches=${(r.inner?.summaries ?? r.inner?.results ?? []).length ?? "?"}`);
line("ecs_get_component_schema Star", await tool("ecs_get_component_schema", { target: T, component: "starfall.star" }));
line("ecs_get_hierarchy", await tool("ecs_get_hierarchy", { target: T }));
line("ecs_list_systems", await tool("ecs_list_systems", { target: T }), "");
// ecs_diff: snapshot, step, diff
const snapA = await tool("ecs_snapshot", { target: T });
await tool("ecs_step", { target: T, frames: 30 });
line("ecs_diff", await tool("ecs_diff", { target: T, ...(snapA.inner?.snapshotId ? { from: snapA.inner.snapshotId } : {}) }));

console.log("=== camera tools ===");
line("camera_list", await tool("camera_list", { target: T }));
line("camera_look_at", await tool("camera_look_at", { target: T, target_position: [0, 0, 0] }));
line("camera_orbit", await tool("camera_orbit", { target: T, yaw: 15, pitch: 10 }));
line("camera_save mySlot", await tool("camera_save", { target: T, name: "mySlot" }));
line("camera_restore mySlot", await tool("camera_restore", { target: T, name: "mySlot" }));

console.log("=== artifact tools ===");
line("render_bundle", await tool("render_bundle", { target: T, out: "../artifacts/mcp.bundle.json" }));
line("determinism_report", await tool("determinism_report", { target: T }));
line("session_snapshot_save", await tool("session_snapshot_save", { target: T, out: "../artifacts/mcp.session.json" }));
line("session_snapshot_restore", await tool("session_snapshot_restore", { target: T, in: "../artifacts/mcp.session.json" }));
line("logs_read (headless)", await tool("logs_read", { target: T, lines: 5 }));

console.log("=== headed slot ===");
line("logs_read (headed)", await tool("logs_read", { target: "headed", lines: 5 }));

await tool("app_stop", { target: "headless" });
child.stdin.end(); setTimeout(() => process.exit(0), 400);
