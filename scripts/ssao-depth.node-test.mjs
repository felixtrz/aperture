import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createNodeDevice,
  createOffscreenOutput,
} from "../packages/adapter-node/dist/index.js";
import {
  makeOrthographic,
  makePerspective,
  transformPoint,
} from "../packages/simulation/dist/index.js";
import { createWebGpuSsaoPostEffect } from "../packages/webgpu/dist/post/post-ssao.js";
import { executeRenderPassCommands } from "../packages/gpu/dist/render/passes/render-pass-command-executor.js";
import { encodeRenderPng } from "../packages/cli/dist/render/png.js";

const width = 128,
  height = 96;
const evidence = process.env.APERTURE_GPU_EVIDENCE;
let native;
before(async () => {
  native = await createNodeDevice({ adapter: "software" });
  if (evidence) await mkdir(evidence, { recursive: true });
});
after(async () => {
  await native?.dispose();
});

// Render real depth attachments, including partially covered MSAA edge pixels.
// White input makes any erroneous silhouette darkening directly measurable.
async function render(projection, samples, geometry, indirect = false) {
  const device = native.device;
  const output = createOffscreenOutput(device, { width, height });
  const depth = device.createTexture({
    size: [width, height],
    format: "depth32float",
    sampleCount: samples,
    usage: 0x10 | 0x04,
  });
  const color = device.createTexture({
    size: [width, height],
    format: "rgba8unorm",
    usage: 0x10 | 0x04,
  });
  const fill = indirect
    ? device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: 0x10 | 0x04,
      })
    : null;
  try {
    const encoder = device.createCommandEncoder();
    for (const [texture, value] of [
      [color, 1],
      ...(fill ? [[fill, 0.25]] : []),
    ]) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: texture.createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: value, g: value, b: value, a: 1 },
          },
        ],
      });
      pass.end();
    }
    const depthPass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: depth.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1,
      },
    });
    function quad(x0, y0, x1, y1, z) {
      const points = [
        [x0, y0, z],
        [x1, y0, z],
        [x0, y1, z],
        [x0, y1, z],
        [x1, y0, z],
        [x1, y1, z],
      ];
      const vertices = points
        .map(
          (p) =>
            `vec3f(${Array.from(transformPoint(projection, p))
              .map((v) => v.toFixed(8))
              .join(",")})`,
        )
        .join(",");
      const module = device.createShaderModule({
        code: `
        @vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {
          let p=array<vec3f,6>(${vertices}); return vec4f(p[i],1.0);
        }`,
      });
      depthPass.setPipeline(
        device.createRenderPipeline({
          layout: "auto",
          vertex: { module, entryPoint: "vs" },
          primitive: { topology: "triangle-list" },
          depthStencil: {
            format: "depth32float",
            depthWriteEnabled: true,
            depthCompare: "less",
          },
          multisample: { count: samples },
        }),
      );
      depthPass.draw(6);
    }
    if (geometry === "isolated") {
      quad(-100, -100, 100, 100, -10);
      quad(-0.731, -0.683, 0.719, 0.707, -3);
    } else if (geometry === "contact") {
      quad(-100, -100, 100, 100, -3.15);
      quad(-100, -100, 0, 100, -3);
    } else {
      quad(-100, -100, 100, 100, -3);
    }
    depthPass.end();
    const resource = (texture) => ({
      texture,
      width,
      height,
      format: "rgba8unorm",
      label: "input",
    });
    const effect = createWebGpuSsaoPostEffect({
      radiusPixels: 12,
      intensity: 0.7,
      power: 1.3,
      sampleCount: 8,
    });
    const prepared = effect.prepare({
      device,
      input: resource(color),
      depth: {
        texture: depth,
        width,
        height,
        format: "depth32float",
        sampleCount: samples,
        label: "depth",
      },
      ...(fill ? { indirectColor: resource(fill) } : {}),
      projectionMatrix: new Float32Array(projection),
      outputFormat: "rgba8unorm",
      width,
      height,
      frame: 1,
      passIndex: 0,
      isLast: true,
      label: "depth-regression",
    });
    assert.deepEqual(prepared.diagnostics, []);
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: output.acquire().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    const execution = executeRenderPassCommands({
      pass,
      commands: prepared.commands,
    });
    assert.deepEqual(execution.diagnostics, []);
    pass.end();
    device.queue.submit([encoder.finish()]);
    const rgba = await output.readRgba();
    native.assertHealthy();
    return rgba;
  } finally {
    depth.destroy();
    color.destroy();
    fill?.destroy();
    await output.dispose();
  }
}

for (const [camera, projection] of [
  ["orthographic", makeOrthographic(-8 / 3, 8 / 3, -2, 2, 0.2, 120)],
  ["perspective", makePerspective(Math.PI / 3, width / height, 0.3, 75)],
]) {
  for (const samples of [1, 4]) {
    test(`${camera}, ${samples}x: flat surfaces and distant silhouettes stay clean; contacts retain AO`, async () => {
      const metrics = {};
      for (const geometry of ["flat", "isolated", "contact"]) {
        const rgba = await render(projection, samples, geometry);
        let dark = 0,
          foregroundDark = 0,
          minimum = 255;
        for (let y = 2; y < height - 2; y++)
          for (let x = 2; x < width - 2; x++) {
            const red = rgba[(y * width + x) * 4];
            minimum = Math.min(minimum, red);
            if (red < 252) {
              dark++;
              if (x < width / 2) foregroundDark++;
            }
          }
        metrics[geometry] = { dark, foregroundDark, minimum };
        if (evidence)
          await writeFile(
            path.join(evidence, `${camera}-${samples}-${geometry}.png`),
            encodeRenderPng(width, height, rgba),
          );
        if (geometry === "contact") {
          assert.ok(
            dark > 50,
            `Contact shading disappeared: ${JSON.stringify(metrics)}`,
          );
          assert.equal(
            foregroundDark,
            0,
            `Foreground acquired an outline: ${JSON.stringify(metrics)}`,
          );
        } else {
          assert.equal(
            dark,
            0,
            `Unoccluded surface acquired AO: ${JSON.stringify(metrics)}`,
          );
        }
      }
      if (evidence)
        await writeFile(
          path.join(evidence, `${camera}-${samples}.json`),
          JSON.stringify(metrics, null, 2),
        );
    });
  }
  test(`${camera}: indirect-only AO preserves direct/emissive contribution`, async () => {
    const rgba = await render(projection, 1, "contact", true);
    let min = 255;
    for (let i = 0; i < rgba.length; i += 4) min = Math.min(min, rgba[i]);
    assert.ok(
      min >= 191 && min < 252,
      `Expected AO to affect only 25% indirect light, got ${min}`,
    );
  });
}
