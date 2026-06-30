// A small reusable client for `aperture headless serve`, plus assertion helpers.
// This is the kind of thin harness a developer would build to run gameplay
// invariants in CI without a browser.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";

export function openHeadlessSession(appDir, configRel, flags = []) {
  const appAbs = path.resolve(appDir);
  const bin = path.join(appAbs, "node_modules/.bin/aperture");
  const child = spawn(bin, ["headless", "serve", configRel, "--root", appAbs, ...flags], { cwd: appAbs });
  const pending = new Map();
  let nextId = 1;
  let readyResolve;
  const ready = new Promise((r) => (readyResolve = r));
  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let m;
    try { m = JSON.parse(line); } catch { return; }
    if (m.ready) { readyResolve(m); return; }
    if (m.id !== undefined && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const rpc = (cmd, params) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ id, cmd, ...(params ? { params } : {}) })}\n`);
  });
  return {
    ready,
    step: (frames = 1) => rpc("step", { frames }),
    status: () => rpc("get-status").then((r) => r.result),
    inject: (params) => rpc("inject", params),
    tool: (name, args) => rpc("tool", { name, ...(args ? { arguments: args } : {}) }),
    bundle: (out, extra = {}) => rpc("bundle", { out, ...extra }),
    async close() { await rpc("shutdown"); child.stdin.end(); },
  };
}

let passed = 0;
let failed = 0;
const failures = [];
export function assert(name, cond, detail = "") {
  if (cond) { passed += 1; console.log(`  PASS ${name}`); }
  else { failed += 1; failures.push(`${name} ${detail}`); console.log(`  FAIL ${name} ${detail}`); }
}
export function approx(a, b, eps = 1e-6) { return Math.abs(a - b) <= eps; }
export function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log("Failures:\n - " + failures.join("\n - ")); process.exitCode = 1; }
}
