#!/usr/bin/env node
// Non-gating timings. RSS plateau is reported with samples, never inferred from
// one process snapshot or presented as a native-versus-browser speed claim.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApertureRenderSession } from "../packages/cli/dist/render/driver.js";
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../test/e2e/fixtures/procedural-cube.bundle.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const directory = path.resolve(
  process.env.APERTURE_GPU_EVIDENCE ?? ".aperture-env/dawn-evidence/benchmark",
);
await mkdir(directory, { recursive: true });
const started = performance.now();
const session = await createApertureRenderSession({
  backend: "dawn",
  adapter: process.env.APERTURE_DAWN_TEST_ADAPTER ?? "software",
});
const coldInitializationMs = performance.now() - started;
const samples = [];
try {
  for (
    let index = 0;
    index < Number(process.env.APERTURE_BENCH_FRAMES ?? 240);
    index++
  ) {
    const width = index % 2 === 0 ? 321 : 385,
      height = index % 2 === 0 ? 201 : 257;
    const before = performance.now();
    const result = await session.render({ bundle: fixture, width, height });
    samples.push({
      index,
      width,
      height,
      roundTripMs: performance.now() - before,
      ...result.metadata.cpuTimings,
      ...result.metadata.processMemory,
    });
  }
} finally {
  await session.dispose();
}
const warm = samples.slice(10);
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = {
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  adapter: session.dawn,
  coldInitializationMs,
  firstRender: samples[0],
  warmMedianMs: median(warm.map((sample) => sample.roundTripMs)),
  peakRss: Math.max(...samples.map((sample) => sample.rss)),
  lastTenMedianRss: median(samples.slice(-10).map((sample) => sample.rss)),
  warmStartMedianRss: median(samples.slice(10, 20).map((sample) => sample.rss)),
  samples,
};
await writeFile(
  path.join(directory, "native.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify({ ...report, samples: undefined }));
