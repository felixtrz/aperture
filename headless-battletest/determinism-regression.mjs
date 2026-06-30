#!/usr/bin/env node
// Determinism regression: run each headless app twice (same seed, same fixed
// step schedule, no input) and assert bit-identical render-bundle digests.
// A drop-in CI guarantee that the headless sim is reproducible. Run from the
// battletest dir: node determinism-regression.mjs
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import path from "node:path";

const APPS = [
  { name: "game", config: "aperture.headless.config.ts", seed: 1, frames: 120 },
  { name: "boids", config: "boids/boids.config.ts", seed: 1, frames: 200 },
  { name: "life", config: "life/life.config.ts", seed: 1, frames: 30 },
  { name: "platformer", config: "platformer/platformer.config.ts", seed: 1, frames: 80 },
];

const appAbs = path.resolve("app");
const bin = path.join(appAbs, "node_modules/.bin/aperture");

function runOnce(config, seed, frames, outFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["headless", "serve", config, "--root", appAbs, "--seed", String(seed)], { cwd: appAbs });
    const rl = createInterface({ input: child.stdout });
    let ready = false;
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let m;
      try { m = JSON.parse(line); } catch { return; }
      if (m.ready && !ready) {
        ready = true;
        child.stdin.write(`${JSON.stringify({ id: 1, cmd: "step", params: { frames } })}\n`);
        child.stdin.write(`${JSON.stringify({ id: 2, cmd: "bundle", params: { out: outFile, digest: true } })}\n`);
        child.stdin.write(`${JSON.stringify({ id: 3, cmd: "shutdown" })}\n`);
      }
    });
    child.on("exit", () => {
      try {
        resolve(JSON.parse(readFileSync(path.join(appAbs, outFile), "utf8")).digest.hash);
      } catch (e) { reject(e); }
    });
  });
}

let failed = 0;
for (const app of APPS) {
  const a = await runOnce(app.config, app.seed, app.frames, `artifacts/det.${app.name}.a.json`);
  const b = await runOnce(app.config, app.seed, app.frames, `artifacts/det.${app.name}.b.json`);
  const ok = a === b;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${app.name.padEnd(11)} seed ${app.seed}, ${app.frames} frames -> ${a}${ok ? "" : ` != ${b}`}`);
}
console.log(`\n${APPS.length - failed}/${APPS.length} apps bit-identical across runs`);
process.exit(failed === 0 ? 0 : 1);
