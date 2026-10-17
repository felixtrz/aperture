#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApertureRenderSession } from "../packages/cli/dist/render/driver.js";
import { renderHarnessHtml } from "../packages/cli/dist/render/harness.js";
import { resolveEnginePackages } from "../packages/cli/dist/render/resolve-engine-packages.js";
import { startApertureStaticServer } from "../packages/cli/dist/render/static-server.js";
import { readPngImage } from "../test/e2e/png.ts";
import { runVerifiedScene } from "./verified-webgpu.mjs";

// Run inside the documented runtime-pressure wrapper. This script never launches
// a browser itself; each browser capture must pass the existing proof gate.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = process.env.APERTURE_GPU_EVIDENCE;
assert.ok(
  output && path.isAbsolute(output),
  "Set APERTURE_GPU_EVIDENCE to an absolute retained evidence directory.",
);
assert.ok(
  process.env.APERTURE_TMP_RUN,
  "The cleanup lifecycle wrapper must provide APERTURE_TMP_RUN.",
);
await mkdir(output, { recursive: true });
await mkdir(path.join(root, "tmp"), { recursive: true });
const temporary = await mkdtemp(path.join(root, "tmp/dawn-parity-"));
const width = 385,
  height = 257;
const engine = resolveEnginePackages();
let session, server;
const images = new Map();
const evidence = {
  width,
  height,
  tolerances: { mean: 0.5, max: 12 },
  variants: {},
};
try {
  session = await createApertureRenderSession({
    backend: "dawn",
    adapter: "software",
  });
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
  for (const variant of ["lit", "no-shadow", "no-sun"]) {
    const fixture = path.join(temporary, variant);
    await cp(
      path.join(
        root,
        process.env.APERTURE_PARITY_FIXTURE ?? "test/fixtures/dawn-render",
      ),
      fixture,
      {
        recursive: true,
      },
    );
    const scenePath = path.join(fixture, "src/systems/scene.system.ts");
    let source = await readFile(scenePath, "utf8");
    if (variant === "no-shadow")
      source = source.replace("strength: 0.8", "strength: 0");
    if (variant === "no-sun")
      source = source.replace("intensity: 4", "intensity: 0");
    await writeFile(scenePath, source);
    const bundlePath = path.join(output, `${variant}.bundle.json`);
    const generate = spawnSync(
      process.execPath,
      [
        path.join(root, "packages/cli/dist/bin/aperture.js"),
        "headless",
        path.join(fixture, "aperture.headless.config.ts"),
        "--out",
        bundlePath,
        "--render-width",
        String(width),
        "--render-height",
        String(height),
        "--asset-mode",
        "strict",
        "--json",
      ],
      { encoding: "utf8" },
    );
    assert.equal(generate.status, 0, generate.stderr);
    await writeFile(
      path.join(output, `${variant}.headless.json`),
      generate.stdout,
    );
    const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
    const native = await session.render({ bundle, width, height });
    assert.equal(native.metadata.backend, "dawn");
    assert.equal(native.metadata.shadow.ready, true);
    assert.equal(native.metadata.diagnostics.length, 0);
    await writeFile(path.join(output, `${variant}.dawn.png`), native.png);
    await writeFile(
      path.join(output, `${variant}.dawn.json`),
      JSON.stringify(native.metadata, null, 2),
    );
    const screenshot = path.join(output, `${variant}.browser.png`);
    const browser = await runVerifiedScene({
      runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME,
      scratchRoot: process.env.APERTURE_TMP_RUN,
      url: server.url + "/",
      outputPath: path.join(output, `${variant}.browser.json`),
      screenshotPath: screenshot,
      bundlePath,
      viewport: { width, height },
    });
    assert.equal(browser.status, "passed");
    const a = readPngImage(native.png),
      b = readPngImage(await readFile(screenshot));
    const comparison = compare(a, b);
    evidence.variants[variant] = { comparison, dawn: native.metadata.dawn };
    assert.ok(
      comparison.mean <= evidence.tolerances.mean &&
        comparison.max <= evidence.tolerances.max,
      JSON.stringify(comparison),
    );
    images.set(variant, { dawn: a, browser: b });
  }
  evidence.semantics = {};
  for (const backend of ["dawn", "browser"]) {
    const lit = images.get("lit")[backend],
      noShadow = images.get("no-shadow")[backend],
      noSun = images.get("no-sun")[backend];
    const shadow = differencePixels(noShadow, lit, {
      x: 60,
      y: 120,
      width: 280,
      height: 110,
    });
    const light = differencePixels(lit, noSun, {
      x: 100,
      y: 70,
      width: 200,
      height: 140,
    });
    evidence.semantics[backend] = {
      shadowDarkenedPixels: shadow,
      sunBrightenedPixels: light,
    };
    assert.ok(
      shadow > 20,
      `${backend}: expected measurable ground shadow occlusion, found ${shadow} pixels`,
    );
    assert.ok(
      light > 100,
      `${backend}: expected measurable lighting, found ${light} pixels`,
    );
  }
  evidence.status = "passed";
} finally {
  await writeFile(
    path.join(output, "parity.json"),
    JSON.stringify(evidence, null, 2),
  );
  await session?.dispose();
  await server?.close();
  await rm(temporary, { recursive: true, force: true });
}
console.log(JSON.stringify(evidence));

function compare(a, b) {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let max = 0,
    total = 0;
  for (let p = 0; p < a.width * a.height; p++)
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(
        a.pixels[p * a.bytesPerPixel + c] - b.pixels[p * b.bytesPerPixel + c],
      );
      max = Math.max(max, d);
      total += d;
    }
  return { max, mean: total / (a.width * a.height * 3) };
}
function differencePixels(brighter, darker, region) {
  let count = 0;
  for (let y = region.y; y < region.y + region.height; y++)
    for (let x = region.x; x < region.x + region.width; x++) {
      const p = y * brighter.width + x;
      let difference = 0;
      for (let c = 0; c < 3; c++)
        difference +=
          brighter.pixels[p * brighter.bytesPerPixel + c] -
          darker.pixels[p * darker.bytesPerPixel + c];
      if (difference > 12) count++;
    }
  return count;
}
