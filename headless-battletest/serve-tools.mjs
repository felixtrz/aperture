#!/usr/bin/env node
// Exercises the headless serve tool surface against Starfall and prints a
// compact pass/fail line per tool call.
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

const line = (label, ok, extra = "") =>
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(42)} ${extra}`);

await ready;
console.log("=== headless serve tool surface ===");

// Advance to spawn stars.
await send("step", { frames: 90 });

let r;
r = await send("tool", { name: "ecs_list_systems" });
line("ecs_list_systems", r.ok, `systems=${r.result?.systems?.length ?? r.result?.systems ?? "?"}`);

r = await send("tool", { name: "ecs_find_entities", arguments: { tags: ["star"], limit: 100 } });
const starList = r.result?.entities ?? r.result?.results ?? r.result ?? [];
const starCount = Array.isArray(starList) ? starList.length : (r.result?.count ?? "?");
line("ecs_find_entities tag=star", r.ok, `stars=${starCount}`);

r = await send("tool", { name: "ecs_find_entities", arguments: { withComponents: ["starfall.star"], limit: 100 } });
const byComp = r.result?.entities ?? r.result?.results ?? [];
line("ecs_find_entities withComponents=Star", r.ok, `matches=${Array.isArray(byComp) ? byComp.length : "?"}`);

// Pull one entity ref to inspect.
const firstStar = (Array.isArray(byComp) && byComp[0]) || (Array.isArray(starList) && starList[0]);
const entityRef = firstStar?.entity ?? firstStar?.ref ?? firstStar;
r = await send("tool", { name: "ecs_get_entity", arguments: { entity: entityRef } });
line("ecs_get_entity", r.ok, `components=${r.result?.componentIds?.length ?? r.result?.entity?.componentIds?.length ?? "?"}`);

r = await send("tool", { name: "resource_get" });
line("resource_get (list)", r.ok, `resources=${JSON.stringify(r.result?.resources?.map?.((x) => x.id) ?? r.result?.entries?.map?.((x) => x.id) ?? r.result)}`.slice(0, 90));

r = await send("tool", { name: "resource_get", arguments: { id: "starfall.director" } });
line("resource_get director", r.ok, `values=${JSON.stringify(r.result?.values ?? r.result)}`.slice(0, 80));

r = await send("tool", { name: "asset_list" });
line("asset_list", r.ok, `total=${r.result?.total ?? r.result?.assets?.length ?? "?"}`);

r = await send("tool", { name: "camera_list" });
line("camera_list", r.ok, `cameras=${r.result?.cameras?.length ?? JSON.stringify(r.result).slice(0, 40)}`);

r = await send("tool", { name: "camera_get" });
line("camera_get", r.ok, `${JSON.stringify(r.result?.camera?.translation ?? r.result?.translation ?? r.result).slice(0, 60)}`);

r = await send("tool", { name: "input_get_state" });
line("input_get_state", r.ok, `actions=${JSON.stringify(Object.keys(r.result?.actions ?? {}))}`);

// Mutate a star's fallSpeed via the field-set tool, then read it back.
r = await send("tool", { name: "ecs_set_component_field", arguments: { entity: entityRef, component: "starfall.star", field: "fallSpeed", value: 9.5 } });
line("ecs_set_component_field", r.ok, JSON.stringify(r.result ?? r.error ?? r.diagnostics).slice(0, 70));

r = await send("bundle", { out: "../artifacts/serve.bundle.json", digest: true });
line("bundle", r.ok, `digest=${r.result?.digest?.hash ?? r.result?.digest ?? "?"}`);

r = await send("snapshot", { out: "../artifacts/serve.session.json" });
line("snapshot (session save)", r.ok, JSON.stringify(r.result ?? r.error).slice(0, 70));

r = await send("restore", { in: "../artifacts/serve.session.json" });
line("restore (session load)", r.ok, JSON.stringify(r.result ?? r.error).slice(0, 70));

r = await send("determinism");
line("determinism report", r.ok, JSON.stringify(r.result ?? r.error).slice(0, 70));

r = await send("reset", { seed: 7 });
line("reset seed=7", r.ok, JSON.stringify(r.result ?? r.error).slice(0, 60));

await send("shutdown");
child.stdin.end();
