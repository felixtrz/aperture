#!/usr/bin/env node
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
async function tool(name, args) { const res = await rpc("tools/call", { name, arguments: args }); const t = (res.result?.content ?? []).find((c) => c.type === "text"); let p; try { p = JSON.parse(t?.text ?? "{}"); } catch { p = t?.text; } return { p, isErr: res.result?.isError, err: res.error }; }
const line = (label, r, extra) => console.log(`${r.isErr || r.err ? "FAIL" : "PASS"}  ${label.padEnd(32)} ${extra}`);

await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "ref", version: "0" } });
notify("notifications/initialized", {});

let r = await tool("reference_list_components", {});
const comps = r.p?.components ?? r.p?.result?.components ?? r.p?.entries ?? [];
line("reference_list_components", r, `count=${Array.isArray(comps) ? comps.length : JSON.stringify(r.p).slice(0, 60)}`);

r = await tool("reference_list_systems", {});
const sys = r.p?.systems ?? r.p?.result?.systems ?? [];
line("reference_list_systems", r, `count=${Array.isArray(sys) ? sys.length : JSON.stringify(r.p).slice(0, 60)}`);

r = await tool("reference_api_lookup", { symbol: "createSystem" });
line("reference_api_lookup createSystem", r, JSON.stringify(r.p).slice(0, 80));

r = await tool("reference_find_examples", { query: "input action axis2d" });
line("reference_find_examples", r, JSON.stringify(r.p).slice(0, 80));

r = await tool("reference_explain_diagnostic", { code: "aperture.render.blankFrame" });
line("reference_explain_diagnostic", r, JSON.stringify(r.p).slice(0, 90));

r = await tool("reference_search", { query: "despawn an entity and its children" });
const hits = r.p?.results ?? r.p?.matches ?? r.p?.hits ?? [];
line("reference_search", r, `hits=${Array.isArray(hits) ? hits.length : JSON.stringify(r.p).slice(0, 60)}`);

child.stdin.end(); setTimeout(() => process.exit(0), 400);
