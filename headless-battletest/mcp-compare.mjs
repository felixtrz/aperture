#!/usr/bin/env node
// Compares the HEADED (live browser dev session) slot against the HEADLESS
// (pure-Node) slot through one MCP server: authored entities, signals, tool
// behavior, and a rendered frame from each.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "app");
const cli = path.join(appDir, "node_modules/@aperture-engine/cli/dist/bin/aperture.js");
const child = spawn("node", [cli, "mcp", "stdio"], { cwd: appDir });
const rl = createInterface({ input: child.stdout });
const pending = new Map(); let nextId = 1;
rl.on("line", (l) => { if (!l.trim()) return; let m; try { m = JSON.parse(l); } catch { return; } if (m.id !== undefined && pending.has(m.id)) { const r = pending.get(m.id); pending.delete(m.id); r(m); } });
child.stderr.on("data", (d) => process.stderr.write(`[mcp] ${d}`));
const rpc = (method, params) => new Promise((res) => { const id = nextId++; pending.set(id, res); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
async function tool(name, args) {
  const res = await rpc("tools/call", { name, arguments: args });
  const content = res.result?.content ?? [];
  const t = content.find((c) => c.type === "text");
  const img = content.find((c) => c.type === "image");
  let p; try { p = t ? JSON.parse(t.text) : undefined; } catch { p = t?.text; }
  return { parsed: p, image: img, isError: res.result?.isError, error: res.error };
}
// MCP wraps the tool payload under `.result`; entity summaries live there.
const summariesOf = (r) => r.parsed?.result?.summaries ?? r.parsed?.summaries ?? [];
const authoredKeys = (r) => summariesOf(r).filter((e) => !String(e.key).startsWith("star.")).map((e) => e.key).sort();
const starCountOf = (r) => summariesOf(r).filter((e) => String(e.key).startsWith("star.")).length;
const totalOf = (r) => r.parsed?.result?.total ?? r.parsed?.total;
const saveImage = (img, file) => { if (img?.data) { writeFileSync(file, Buffer.from(img.data, "base64")); return file; } return null; };

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "cmp", version: "0" } });
notify("notifications/initialized", {});

console.log("========== HEADED (live browser) ==========");
let r = await tool("app_status", { target: "headed" });
console.log("app_status headed:", r.isError ? `ERR ${JSON.stringify(r.error)}` : JSON.stringify(r.parsed).slice(0, 130));

await tool("ecs_pause", { target: "headed" }); // freeze the rAF loop for a stable read
r = await tool("ecs_find_entities", { target: "headed", limit: 200 });
const headedAuthored = authoredKeys(r);
const headedStars = starCountOf(r);
console.log("headed authored entities:", JSON.stringify(headedAuthored));
console.log("headed star count (real-time):", headedStars, " total:", totalOf(r));

r = await tool("resource_get", { target: "headed", id: "starfall.director" });
console.log("headed resource director:", JSON.stringify(r.parsed?.values ?? r.parsed?.resource?.values ?? r.parsed).slice(0, 90));
r = await tool("input_get_state", { target: "headed" });
console.log("headed input actions:", JSON.stringify(Object.keys(r.parsed?.actions ?? {})));

r = await tool("frame_capture", { target: "headed", width: 480, height: 320 });
const headedFrame = saveImage(r.image, path.join(here, "artifacts/compare_headed.png"));
console.log("headed frame_capture:", r.isError ? `ERR ${JSON.stringify(r.parsed)}` : `${r.image ? "inline image saved " + headedFrame : "pngPath " + (r.parsed?.pngPath ?? "?")}`);
if (!headedFrame && r.parsed?.pngPath) console.log("  headed pngPath:", r.parsed.pngPath);
console.log("  webgpu/source:", JSON.stringify(r.parsed?.diagnostics?.renderer?.webgpu?.adapterInfo ?? r.parsed?.source ?? r.parsed?.webgpu ?? "?").slice(0,120));

console.log("\n========== HEADLESS (pure Node) ==========");
r = await tool("app_start", { target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" });
console.log("app_start headless:", JSON.stringify(r.parsed).slice(0, 80));
await tool("ecs_step", { target: "headless", frames: 200 });
r = await tool("ecs_find_entities", { target: "headless", limit: 200 });
const headlessAuthored = authoredKeys(r);
const headlessStars = starCountOf(r);
console.log("headless authored entities:", JSON.stringify(headlessAuthored));
console.log("headless star count (seed=1, 200 steps):", headlessStars, " total:", totalOf(r));

r = await tool("frame_capture", { target: "headless", width: 480, height: 320 });
const headlessFrame = saveImage(r.image, path.join(here, "artifacts/compare_headless.png"));
console.log("headless frame_capture:", r.image ? `inline image saved ${headlessFrame}` : `pngPath ${r.parsed?.pngPath ?? "?"}`);

console.log("\n========== PARITY ==========");
console.log("authored entities identical:", JSON.stringify(headedAuthored) === JSON.stringify(headlessAuthored));
console.log("headed:", JSON.stringify(headedAuthored));
console.log("headless:", JSON.stringify(headlessAuthored));

await tool("app_stop", { target: "headless" });
child.stdin.end();
setTimeout(() => process.exit(0), 500);
