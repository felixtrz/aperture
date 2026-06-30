// Runs the full headless validation suite for this app — the kind of single
// entry point you'd wire into CI. Each child is a self-contained headless check
// (no browser). Exits nonzero if any fails.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const checks = [
  ["game invariants", "game.test.mjs"],
  ["boids invariants", "boids.test.mjs"],
  ["physics capability probe", "../edge/physics-capability-probe.mjs"],
  ["physics simulation probe", "../edge/physics-sim-probe.mjs"],
  ["session snapshot/restore probe", "../edge/session-snapshot-probe.mjs"],
];

let failed = 0;
for (const [name, file] of checks) {
  process.stdout.write(`\n=== ${name} (${file}) ===\n`);
  const r = spawnSync("node", [path.join(dir, file)], { stdio: "inherit", cwd: path.join(dir, "..") });
  if (r.status !== 0) {
    failed += 1;
    process.stdout.write(`!! ${name} exited ${r.status}\n`);
  }
}

process.stdout.write(`\n${checks.length - failed}/${checks.length} headless checks passed\n`);
process.exit(failed === 0 ? 0 : 1);
