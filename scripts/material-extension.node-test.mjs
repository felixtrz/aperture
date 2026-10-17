import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  createNodeDevice,
  createOffscreenOutput,
} from "../packages/adapter-node/dist/index.js";
import { renderPortableBundle } from "../packages/app/dist/render-bundle.js";
import { FULLSCREEN_VERTEX_WGSL } from "../packages/gpu/dist/index.js";
import { encodeRenderPng } from "../packages/cli/dist/render/png.js";

let native, bundle, temporary;
const width = 385,
  height = 257;
const root = path.resolve(import.meta.dirname, "..");
const evidence = process.env.APERTURE_GPU_EVIDENCE;
before(async () => {
  await mkdir(path.join(root, "tmp"), { recursive: true });
  temporary = await mkdtemp(path.join(root, "tmp/material-extension-"));
  await cp(path.join(root, "examples/material-shaders"), temporary, {
    recursive: true,
  });
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "packages/cli/dist/bin/aperture.js"),
      "headless",
      path.join(temporary, "aperture.headless.config.ts"),
      "--out",
      path.join(temporary, "scene.bundle.json"),
      "--render-width",
      String(width),
      "--render-height",
      String(height),
      "--asset-mode",
      "strict",
      "--json",
    ],
    { encoding: "utf8", timeout: 240000 },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  bundle = JSON.parse(
    await readFile(path.join(temporary, "scene.bundle.json"), "utf8"),
  );
  native = await createNodeDevice({ adapter: "software" });
  if (evidence) await mkdir(evidence, { recursive: true });
});
after(async () => {
  await native?.dispose();
  if (temporary) await rm(temporary, { recursive: true, force: true });
});
function variant(parameters, previous = parameters) {
  const value = structuredClone(bundle);
  const material = value.assets.entries.find(
    (entry) => entry.handle.id === "study.surface",
  ).asset;
  material.extension.parameters = parameters;
  material.extension.previousParameters = previous;
  return value;
}
async function render(value, label, options = {}) {
  const output = createOffscreenOutput(native.device, { width, height });
  let rendered;
  try {
    rendered = await renderPortableBundle(value, {
      deviceContext: native,
      output,
      ...options,
    });
    assert.equal(rendered.status.ok, true, JSON.stringify(rendered.status));
    native.assertHealthy();
    const pixels = await output.readRgba();
    if (evidence) {
      await writeFile(
        path.join(evidence, `${label}.png`),
        encodeRenderPng(width, height, pixels),
      );
      await writeFile(
        path.join(evidence, `${label}.json`),
        JSON.stringify(rendered.status, null, 2),
      );
    }
    return pixels;
  } finally {
    await rendered?.app.dispose();
    await output.dispose();
  }
}
const changed = (a, b, threshold = 3) => {
  let count = 0;
  for (let i = 0; i < a.length; i += 4)
    if (
      Math.max(...[0, 1, 2].map((c) => Math.abs(a[i + c] - b[i + c]))) >
      threshold
    )
      count++;
  return count;
};
function shadowMask(lit, unshadowed) {
  const mask = new Uint8Array(width * height);
  for (let y = 125; y < height; y++)
    for (let x = 40; x < width - 40; x++) {
      const index = y * width + x,
        offset = index * 4;
      if ([0, 1, 2].some((c) => unshadowed[offset + c] - lit[offset + c] > 3))
        mask[index] = 1;
    }
  return mask;
}
test("ECS material deformation and cutout alter real cast shadows under daylight, HDR and MSAA", async () => {
  const masks = [];
  for (const [name, parameters] of [
    ["rigid", [0, 0, 0.1, 0]],
    ["deformed", [1.2, 0.4, 0.1, 0]],
    ["cutout", [1.2, 0.4, 0.1, 0.3]],
  ]) {
    const value = variant(parameters),
      lit = await render(value, `${name}-lit`);
    const noShadow = structuredClone(value);
    for (const request of noShadow.snapshot.value.shadowRequests)
      request.strength = 0;
    const plain = await render(noShadow, `${name}-no-shadow`);
    const mask = shadowMask(lit, plain);
    assert.ok(
      mask.reduce((a, b) => a + b, 0) > 20,
      `${name} has no ground shadow`,
    );
    masks.push(mask);
  }
  const deform = masks[0].reduce(
    (sum, value, index) => sum + (value !== masks[1][index] ? 1 : 0),
    0,
  );
  const cutout = masks[1].reduce(
    (sum, value, index) => sum + (value !== masks[2][index] ? 1 : 0),
    0,
  );
  assert.ok(deform > 10, `Deformation did not move ground shadow: ${deform}`);
  assert.ok(cutout > 10, `Cutout did not change ground shadow: ${cutout}`);
  if (evidence)
    await writeFile(
      path.join(evidence, "shadow-semantics.json"),
      JSON.stringify({ deform, cutout }),
    );
});
function motionDisplay() {
  let pipeline;
  return {
    id: "motion-inspection",
    requiresMotionVectors: true,
    prepare(options) {
      assert.ok(
        options.motionVector,
        "Engine must provide the actual motion attachment",
      );
      const device = options.device;
      pipeline ??= device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: device.createShaderModule({ code: FULLSCREEN_VERTEX_WGSL }),
          entryPoint: "apertureFullscreen",
        },
        fragment: {
          module: device.createShaderModule({
            code: "@group(0) @binding(0) var motion:texture_2d<f32>; @fragment fn main(@builtin(position) pixel:vec4f)->@location(0) vec4f{return textureLoad(motion,vec2i(pixel.xy),0);}",
          }),
          entryPoint: "main",
          targets: [{ format: options.outputFormat }],
        },
      });
      const bind = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: options.motionVector.texture.createView() },
        ],
      });
      return {
        effectId: "motion-inspection",
        label: "Motion evidence",
        diagnostics: [],
        commands: [
          {
            kind: "setPipeline",
            renderId: 0,
            pipelineKey: "motion-inspection",
            pipeline,
          },
          {
            kind: "setBindGroup",
            renderId: 0,
            index: 0,
            resourceKey: "motion",
            bindGroup: bind,
          },
          {
            kind: "draw",
            renderId: 0,
            vertexCount: 3,
            instanceCount: 1,
            firstVertex: 0,
            firstInstance: 0,
          },
        ],
      };
    },
  };
}
test("motion vectors include previous deformation parameters while static parameters stay still", async () => {
  const still = variant([1.2, 0.4, 0.1, 0]),
    moving = variant([1.2, 0.4, 0.1, 0], [0, 0.4, 0.1, 0]);
  for (const value of [still, moving]) {
    value.snapshot.value.proceduralSkies = [];
    value.snapshot.value.skyboxes = [];
    value.renderTarget.sampleCount = 1;
    value.renderTarget.toneMapping = "none";
    delete value.renderTarget.exposure;
    delete value.renderTarget.bloom;
  }
  const a = await render(still, "motion-still", {
      postEffects: [motionDisplay()],
    }),
    b = await render(moving, "motion-deformed", {
      postEffects: [motionDisplay()],
    });
  assert.ok(
    changed(a, b) > 50,
    "Previous deformation did not affect the actual motion attachment",
  );
});
