// WebGPU tonemap numeric gate (AI-90): evaluate the output-stage tonemap
// operators' real WGSL on the GPU (Dawn, via headless Chrome) and assert the
// results match values pinned from the named references.
//
// Why this exists: the shader-compile gate only proves the operator WGSL
// *compiles*; it cannot catch a numerically wrong operator (e.g. an AgX that
// drops the inset/outset matrices, or a neutral that drops the desaturation
// mix). This check runs `apertureOutputTonemap` in a compute shader over a few
// fixed inputs and compares the read-back colors against values computed from
// the three.js reference (src/nodes/display/ToneMappingFunctions.js), so a
// fidelity regression fails loudly.
//
// Like webgpu-shader-compile-check.mjs it SKIPS (exit 0) when no WebGPU adapter
// is available, unless APERTURE_REQUIRE_WEBGPU=1 (CI) turns the skip into a hard
// failure.
//
// Usage: node scripts/webgpu-tonemap-numeric-check.mjs
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createOutputTonemapWgsl } from "../packages/webgpu/dist/output/output-stage-tonemap.js";

// Inputs are linear-sRGB colors (exposure already folded in == 1.0). Expected
// outputs are pinned from a faithful JS port of the three.js operators; the GPU
// runs f32 + SwiftShader, so compare with a tolerance well below the gap to the
// old (unfaithful) implementations.
const TOLERANCE = 5e-3;

const INPUTS = [
  [0.18, 0.18, 0.18],
  [1.0, 0.0, 0.0],
  [3.0, 1.5, 0.3],
  [0.5, 0.2, 0.05],
  [5.0, 5.0, 5.0],
  [0.04, 0.02, 0.01],
];

// Pinned references — see scripts/ comment above. Index-aligned with INPUTS.
const EXPECTED = {
  agx: [
    [0.214549, 0.214502, 0.214499],
    [0.723276, 0.105847, 0.066736],
    [0.849271, 0.679243, 0.449166],
    [0.444816, 0.233057, 0.101035],
    [0.889548, 0.889442, 0.889365],
    [0.045145, 0.017587, 0.006629],
  ],
  neutral: [
    [0.14, 0.14, 0.14],
    [0.88, 0.01556, 0.01556],
    [0.976393, 0.595061, 0.289996],
    [0.465625, 0.165625, 0.015625],
    [0.987027, 0.987027, 0.987027],
    [0.030625, 0.010625, 0.000625],
  ],
  reinhard: [
    [0.152542, 0.152542, 0.152542],
    [0.5, 0.0, 0.0],
    [0.75, 0.6, 0.230769],
    [0.333333, 0.166667, 0.047619],
    [0.833333, 0.833333, 0.833333],
    [0.038462, 0.019608, 0.009901],
  ],
};

const OPERATORS = Object.keys(EXPECTED);

function buildComputeShader(operator) {
  // vec4f IO (xyz = color) sidesteps the 16-byte stride rules of vec3f storage
  // arrays. The operator WGSL defines `apertureOutputTonemap(color: vec3f)`.
  return `${createOutputTonemapWgsl(operator)}

@group(0) @binding(0) var<storage, read> inputs: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> outputs: array<vec4f>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  outputs[i] = vec4f(apertureOutputTonemap(inputs[i].xyz), 1.0);
}
`;
}

const REQUIRE_WEBGPU = process.env.APERTURE_REQUIRE_WEBGPU === "1";
const WEBGPU_CHANNEL = process.env.APERTURE_WEBGPU_CHANNEL;

async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch (error) {
    console.error(
      `[webgpu-tonemap-numeric-check] @playwright/test import failed: ${error?.message ?? error}`,
    );
    return null;
  }
  try {
    if (WEBGPU_CHANNEL) {
      return await chromium.launch({
        channel: WEBGPU_CHANNEL,
        headless: false,
        args: [
          "--enable-unsafe-webgpu",
          "--use-vulkan=swiftshader",
          "--enable-features=Vulkan",
          "--enable-unsafe-swiftshader",
        ],
      });
    }
    return await chromium.launch({
      executablePath: chromium.executablePath(),
      args: [
        "--headless=new",
        "--enable-unsafe-webgpu",
        "--enable-features=WebGPU,Vulkan",
        "--use-angle=swiftshader",
      ],
    });
  } catch (error) {
    console.error(
      `[webgpu-tonemap-numeric-check] Chrome launch failed (channel=${WEBGPU_CHANNEL ?? "bundled"}): ${error?.message ?? error}`,
    );
    return null;
  }
}

function reportUnavailable(reason) {
  if (REQUIRE_WEBGPU) {
    console.error(
      `[webgpu-tonemap-numeric-check] FAIL: ${reason}, but APERTURE_REQUIRE_WEBGPU=1 ` +
        "requires a real Dawn evaluation of the tonemap operators.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`[webgpu-tonemap-numeric-check] SKIP: ${reason}.`);
}

async function main() {
  const cases = OPERATORS.map((operator) => ({
    operator,
    code: buildComputeShader(operator),
  }));
  const browser = await launchBrowser();
  if (!browser) {
    reportUnavailable("no WebGPU-capable Chrome available");
    return;
  }

  try {
    const page = await browser.newPage();
    const htmlPath = join(tmpdir(), "aperture-wgsl-tonemap-check.html");
    writeFileSync(htmlPath, "<!doctype html><title>wgsl-tonemap</title>");
    await page.goto(`file://${htmlPath}`);

    const result = await page.evaluate(
      async ({ cases, inputs }) => {
        if (!navigator.gpu) return { skip: "navigator.gpu unavailable" };
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return { skip: "no WebGPU adapter" };
        const device = await adapter.requestDevice();

        const count = inputs.length;
        const inputData = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
          inputData[i * 4 + 0] = inputs[i][0];
          inputData[i * 4 + 1] = inputs[i][1];
          inputData[i * 4 + 2] = inputs[i][2];
          inputData[i * 4 + 3] = 1;
        }
        const byteLength = inputData.byteLength;

        // Browser WebGPU globals via globalThis so the Node-context lint of
        // this .mjs does not flag them as undefined (they exist in the page).
        const { GPUBufferUsage, GPUMapMode } = globalThis;

        const outputs = {};
        const failures = [];

        for (const testCase of cases) {
          device.pushErrorScope("validation");
          const module = device.createShaderModule({ code: testCase.code });
          const inputBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          });
          device.queue.writeBuffer(inputBuffer, 0, inputData);
          const outputBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
          });
          const readBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          });

          const pipeline = device.createComputePipeline({
            layout: "auto",
            compute: { module, entryPoint: "main" },
          });
          const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: inputBuffer } },
              { binding: 1, resource: { buffer: outputBuffer } },
            ],
          });

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginComputePass();
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.dispatchWorkgroups(count);
          pass.end();
          encoder.copyBufferToBuffer(
            outputBuffer,
            0,
            readBuffer,
            0,
            byteLength,
          );
          device.queue.submit([encoder.finish()]);

          const scopeError = await device.popErrorScope();
          if (scopeError) {
            failures.push({
              operator: testCase.operator,
              error: scopeError.message.split("\n")[0],
            });
            continue;
          }

          await readBuffer.mapAsync(GPUMapMode.READ);
          const mapped = new Float32Array(readBuffer.getMappedRange().slice(0));
          readBuffer.unmap();

          const rows = [];
          for (let i = 0; i < count; i++) {
            rows.push([
              mapped[i * 4 + 0],
              mapped[i * 4 + 1],
              mapped[i * 4 + 2],
            ]);
          }
          outputs[testCase.operator] = rows;
        }

        return { outputs, failures };
      },
      { cases, inputs: INPUTS },
    );

    if (result.skip) {
      reportUnavailable(result.skip);
      return;
    }

    const mismatches = [...(result.failures ?? [])];
    for (const operator of OPERATORS) {
      const rows = result.outputs?.[operator];
      if (!rows) {
        mismatches.push({ operator, error: "no output produced" });
        continue;
      }
      for (let i = 0; i < INPUTS.length; i++) {
        for (let c = 0; c < 3; c++) {
          const got = rows[i][c];
          const want = EXPECTED[operator][i][c];
          if (Math.abs(got - want) > TOLERANCE) {
            mismatches.push({
              operator,
              input: INPUTS[i],
              channel: c,
              got,
              want,
            });
          }
        }
      }
    }

    if (mismatches.length > 0) {
      console.error(
        `[webgpu-tonemap-numeric-check] ${mismatches.length} tonemap value(s) off reference:`,
      );
      for (const m of mismatches) {
        if (m.error) {
          console.error(`  ✗ ${m.operator}: ${m.error}`);
        } else {
          console.error(
            `  ✗ ${m.operator} in=[${m.input.join(", ")}] ch${m.channel}: got ${m.got.toFixed(6)} want ${m.want.toFixed(6)}`,
          );
        }
      }
      process.exitCode = 1;
      return;
    }

    console.log(
      `[webgpu-tonemap-numeric-check] OK: ${OPERATORS.length} operators × ${INPUTS.length} inputs matched reference (tol ${TOLERANCE}).`,
    );
  } finally {
    await browser.close();
  }
}

await main();
