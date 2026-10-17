#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileShaderFile } from "../packages/shader/dist/compiler.js";
import { encodeShaderJob } from "../packages/shader/dist/index.js";
import { createDemoJob } from "../examples/shader-workbench/programs.mjs";
import { createApertureRenderSession } from "../packages/cli/dist/render/driver.js";
import { renderHarnessHtml } from "../packages/cli/dist/render/harness.js";
import { resolveEnginePackages } from "../packages/cli/dist/render/resolve-engine-packages.js";
import { startApertureStaticServer } from "../packages/cli/dist/render/static-server.js";
import { readPngImage } from "../test/e2e/png.ts";
import { runVerifiedScene } from "./verified-webgpu.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = process.env.APERTURE_GPU_EVIDENCE;
assert.ok(
  output && path.isAbsolute(output),
  "Set APERTURE_GPU_EVIDENCE to an absolute evidence directory.",
);
assert.ok(process.env.APERTURE_TMP_RUN, "Use the cleanup lifecycle wrapper.");
await mkdir(output, { recursive: true });
const shaders = Object.fromEntries(
  await Promise.all(
    [
      "procedural",
      "compute",
      "draw",
      "history",
      "present",
      "mrt",
      "combine",
    ].map(async (name) => [
      name,
      await compileShaderFile(
        path.join(root, "examples/shader-workbench/shaders", `${name}.wgsl`),
      ),
    ]),
  ),
);
const width = 385,
  height = 257,
  engine = resolveEnginePackages();
const session = await createApertureRenderSession({
  backend: "dawn",
  adapter: "software",
});
let server;
const evidence = {
  width,
  height,
  tolerances: { max: 12, mean: 0.5 },
  modes: {},
};
try {
  server = await startApertureStaticServer({
    mounts: [
      ...engine.mounts,
      {
        prefix: "/_harness/",
        dir: path.join(root, "packages/cli/assets/render-harness"),
      },
    ],
    index: () => renderHarnessHtml(engine.importMap, { width, height }),
  });
  for (const mode of ["procedural", "compute", "history", "mrt"]) {
    const bundle = encodeShaderJob(
      createDemoJob(shaders, mode, width, height, mode === "history" ? 12 : 1),
    );
    const bundlePath = path.join(output, `${mode}.job.json`);
    await writeFile(bundlePath, JSON.stringify(bundle));
    const native = await session.render({ bundle, width, height });
    await writeFile(path.join(output, `${mode}.dawn.png`), native.png);
    await writeFile(
      path.join(output, `${mode}.dawn.json`),
      JSON.stringify(native.metadata, null, 2),
    );
    const screenshot = path.join(output, `${mode}.browser.png`);
    const browser = await runVerifiedScene({
      runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME,
      scratchRoot: process.env.APERTURE_TMP_RUN,
      url: server.url + "/",
      outputPath: path.join(output, `${mode}.browser.json`),
      screenshotPath: screenshot,
      bundlePath,
      viewport: { width, height },
    });
    assert.equal(browser.status, "passed");
    const a = readPngImage(native.png),
      b = readPngImage(await readFile(screenshot));
    let max = 0,
      total = 0,
      colored = 0;
    for (let p = 0; p < width * height; p++) {
      let magnitude = 0;
      for (let c = 0; c < 3; c++) {
        const value = a.pixels[p * a.bytesPerPixel + c];
        magnitude += value;
        const error = Math.abs(value - b.pixels[p * b.bytesPerPixel + c]);
        max = Math.max(max, error);
        total += error;
      }
      if (magnitude > 40) colored++;
    }
    const mean = total / (width * height * 3);
    assert.ok(colored > 100, `${mode}: no meaningful shader output`);
    evidence.modes[mode] = {
      max,
      mean,
      colored,
      frames: native.metadata.shader.reports.length,
      adapter: native.metadata.dawn,
    };
    assert.ok(
      max <= evidence.tolerances.max && mean <= evidence.tolerances.mean,
      `${mode}: ${JSON.stringify({ max, mean })}`,
    );
  }
  evidence.status = "passed";
} finally {
  await writeFile(
    path.join(output, "shader-parity.json"),
    JSON.stringify(evidence, null, 2),
  );
  await session.dispose();
  await server?.close();
}
console.log(JSON.stringify(evidence));
