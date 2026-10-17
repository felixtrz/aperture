#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createNodeDevice,
  createOffscreenOutput,
} from "../packages/adapter-node/dist/index.js";
import { createGpuContext } from "../packages/gpu/dist/index.js";
import { compileShader } from "../packages/shader/dist/compiler.js";
import { encodeRenderPng } from "../packages/cli/dist/render/png.js";
const artifact = compileShader({
  entry: "benchmark.wgsl",
  modules: {
    "benchmark.wgsl":
      "@fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f {return vec4f(0.2+0.2*sin(p.x*0.02),0.5,0.7,1);}",
  },
});
const start = performance.now(),
  native = await createNodeDevice({ adapter: "software" });
const initializationMs = performance.now() - start;
const output = createOffscreenOutput(native.device, {
  width: 385,
  height: 257,
});
const gpu = createGpuContext({ device: native.device, output });
const measurements = [];
try {
  const pipelineStart = performance.now();
  await gpu.effect({ name: "effect", shader: artifact });
  const firstPipelinePreparationMs = performance.now() - pipelineStart;
  for (let frame = 0; frame < 120; frame++) {
    const start = performance.now(),
      report = await gpu.frame({ time: frame / 60, delta: 1 / 60 });
    await native.device.queue.onSubmittedWorkDone();
    const frameComplete = performance.now(),
      pixels = await output.readRgba(),
      readbackComplete = performance.now();
    encodeRenderPng(output.width, output.height, pixels);
    measurements.push({
      frame,
      cpuEncodeMs: report.cpuEncodeMs,
      frameAndDrainMs: frameComplete - start,
      readbackMs: readbackComplete - frameComplete,
      pngMs: performance.now() - readbackComplete,
      rss: process.memoryUsage().rss,
    });
  }
  native.assertHealthy();
  const median = (key) =>
    measurements
      .slice(10)
      .map((m) => m[key])
      .sort((a, b) => a - b)[55];
  const report = {
    node: process.version,
    adapter: native.metadata,
    initializationMs,
    firstPipelinePreparationMs,
    firstFrame: measurements[0],
    warm: {
      frameAndDrainMs: median("frameAndDrainMs"),
      cpuEncodeMs: median("cpuEncodeMs"),
      readbackMs: median("readbackMs"),
      pngMs: median("pngMs"),
    },
    peakRss: Math.max(...measurements.map((m) => m.rss)),
    note: "Non-gating CPU/end-to-end timings; no GPU timestamp or relative speed claim.",
    measurements,
  };
  const directory = path.resolve(
    process.env.APERTURE_GPU_EVIDENCE ??
      ".aperture-env/dawn-evidence/shader-benchmark",
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "shader.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify({ ...report, measurements: undefined }));
} finally {
  await gpu.dispose();
  await output.dispose();
  await native.dispose();
}
