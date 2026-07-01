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
child.stderr.on("data", (d) => process.stderr.write(`[mcp] ${d}`));
const rpc = (method, params) => new Promise((res) => { const id = nextId++; pending.set(id, res); child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
async function tool(name, args) { const res = await rpc("tools/call", { name, arguments: args }); const t = (res.result?.content ?? []).find((c) => c.type === "text"); let p; try { p = t ? JSON.parse(t.text) : res.result; } catch { p = t?.text; } return { parsed: p, isError: res.result?.isError, raw: res }; }

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "0" } });
notify("notifications/initialized", {});
await tool("app_start", { target: "headless", config: "aperture.headless.config.ts", seed: 1, assetMode: "hybrid" });
await tool("ecs_step", { target: "headless", frames: 30 });
const reset = await tool("app_reset", { target: "headless" });
console.log("app_reset isError:", reset.isError);
console.log("app_reset parsed:", JSON.stringify(reset.parsed));
console.log("app_reset RAW:", JSON.stringify(reset.raw).slice(0, 400));
// Follow-up: is the session still usable after reset?
const after = await tool("app_status", { target: "headless" });
console.log("app_status after reset:", JSON.stringify(after.parsed).slice(0, 160));
child.stdin.end();
setTimeout(() => process.exit(0), 300);
