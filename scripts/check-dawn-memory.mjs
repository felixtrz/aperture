#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const directory = path.resolve(
  process.env.APERTURE_GPU_EVIDENCE ?? ".aperture-env/dawn-evidence/memory",
);
const result = spawnSync(
  process.execPath,
  [path.join(import.meta.dirname, "bench-dawn.mjs")],
  {
    env: {
      ...process.env,
      APERTURE_GPU_EVIDENCE: directory,
      APERTURE_BENCH_FRAMES: "1200",
    },
    encoding: "utf8",
    timeout: 180000,
  },
);
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(
  await readFile(path.join(directory, "native.json"), "utf8"),
);
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const earlier = report.samples.slice(600, 900),
  last = report.samples.slice(900, 1200);
const rssGrowth =
  median(last.map((s) => s.rss)) - median(earlier.map((s) => s.rss));
const heapGrowth =
  median(last.map((s) => s.heapUsed)) - median(earlier.map((s) => s.heapUsed));
// Absolute catastrophic-regression budgets, not relative speed claims. Native
// compiler/cache growth during warm-up is retained in the raw evidence.
const gate = {
  frames: 1200,
  rssGrowth,
  heapGrowth,
  peakRss: report.peakRss,
  budgets: {
    peakRss: 1024 * 1024 * 1024,
    rssGrowth: 64 * 1024 * 1024,
    heapGrowth: 48 * 1024 * 1024,
  },
};
await writeFile(
  path.join(directory, "memory-gate.json"),
  JSON.stringify(gate, null, 2) + "\n",
);
assert.ok(gate.peakRss < gate.budgets.peakRss, JSON.stringify(gate));
assert.ok(rssGrowth < gate.budgets.rssGrowth, JSON.stringify(gate));
assert.ok(heapGrowth < gate.budgets.heapGrowth, JSON.stringify(gate));
console.log(JSON.stringify(gate));
