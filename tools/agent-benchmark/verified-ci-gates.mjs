import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCases as buildFamilyCompileCases,
  MESH_MODULES,
  STRING_FAMILIES,
} from "../../scripts/webgpu-shader-compile-check.mjs";
import {
  INPUTS,
  EXPECTED,
  OPERATORS,
  TOLERANCE,
  buildComputeShader,
} from "../../scripts/webgpu-tonemap-numeric-check.mjs";
import {
  applyOutputStageToBuiltInShader,
  applyOutputStageToFragmentWgsl,
  applyOutputTonemapToStandardShader,
} from "../../packages/webgpu/dist/output/output-stage-tonemap.js";
import { createMotionVectorBuiltInShaderVariant } from "../../packages/webgpu/dist/render/motion/motion-vector-shader.js";
import { createStandardTextureVariantShader } from "../../packages/webgpu/dist/materials/standard/standard-shader.js";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";
import { verifyLifecycle } from "./run.mjs";
import { sha256, writeImmutable } from "./recorder.mjs";

const schema = "aperture.verified-ci-gate.v1";
const directory = dirname(fileURLToPath(import.meta.url));
const standardBase = {
  baseColorTexture: false,
  metallicRoughnessTexture: false,
  normalTexture: false,
  occlusionTexture: false,
  emissiveTexture: false,
};

export function buildVerifiedGateConfig(kind) {
  assert(
    ["shader", "tonemap"].includes(kind),
    "Gate must be shader or tonemap",
  );
  const cases =
    kind === "shader"
      ? buildFamilyCompileCases()
      : OPERATORS.map((operator) => ({
          name: operator,
          code: buildComputeShader(operator),
        }));
  const originalCaseCount = cases.length;
  const noOpChecks = [];
  const recordNoOp = (name, before, after) => {
    assert.equal(
      before,
      after,
      `${name}: none/linear must preserve exact bytes`,
    );
    noOpChecks.push({
      name,
      beforeSha256: sha256(Buffer.from(before)),
      afterSha256: sha256(Buffer.from(after)),
      byteIdentity: true,
    });
  };
  if (kind === "shader") {
    for (const [name, module] of Object.entries(MESH_MODULES))
      recordNoOp(
        name,
        module.code,
        applyOutputStageToBuiltInShader(module, "none", "linear").code,
      );
    for (const [name, code] of Object.entries(STRING_FAMILIES))
      recordNoOp(
        name,
        code,
        applyOutputStageToFragmentWgsl(code, "none", "linear", name),
      );
    const variants = {
      standard: {},
      "standard-normal": { normalTexture: true },
      "standard-normal-skinned": { normalTexture: true, skinned: true },
      "standard-normal-morphed": { normalTexture: true, morphed: true },
      "standard-normal-skinned-morphed": {
        normalTexture: true,
        skinned: true,
        morphed: true,
      },
      "standard-shadow-ibl": {
        shadowMap: true,
        iblDiffuse: true,
        iblSpecularBrdf: true,
      },
      "standard-clearcoat-spot": {
        clearcoat: true,
        shadowMap: true,
        spotShadowMap: true,
      },
      "standard-sheen-spot": {
        sheen: true,
        shadowMap: true,
        spotShadowMap: true,
      },
      "standard-clearcoat-clustered": {
        clearcoat: true,
        clusteredLocalLights: true,
      },
      "standard-sheen-clustered": { sheen: true, clusteredLocalLights: true },
      "standard-iridescence-clustered": {
        iridescence: true,
        clusteredLocalLights: true,
      },
      "standard-clearcoat-sheen": { clearcoat: true, sheen: true },
      "standard-clearcoat-sheen-textured": {
        clearcoat: true,
        clearcoatTexture: true,
        clearcoatRoughnessTexture: true,
        sheen: true,
        sheenColorTexture: true,
        sheenRoughnessTexture: true,
      },
      "standard-clearcoat-sheen-shadow": {
        clearcoat: true,
        sheen: true,
        shadowMap: true,
      },
      "standard-clearcoat-sheen-spot": {
        clearcoat: true,
        sheen: true,
        shadowMap: true,
        spotShadowMap: true,
      },
      "standard-clearcoat-sheen-cascaded": {
        clearcoat: true,
        sheen: true,
        shadowMap: true,
        cascadedShadowMap: true,
      },
      "standard-clearcoat-sheen-clustered": {
        clearcoat: true,
        sheen: true,
        clusteredLocalLights: true,
      },
      "standard-clearcoat-sheen-clustered-spot": {
        clearcoat: true,
        sheen: true,
        shadowMap: true,
        spotShadowMap: true,
        clusteredLocalLights: true,
      },
      "standard-clearcoat-sheen-clustered-directional-point": {
        clearcoat: true,
        sheen: true,
        shadowMap: true,
        pointShadowMap: true,
        directionalPointShadowMap: true,
        clusteredLocalLights: true,
        clusteredLocalLightPointArrayShadows: true,
      },
      "standard-combined-lobes-shadow": {
        normalTexture: true,
        clearcoat: true,
        clearcoatTexture: true,
        clearcoatRoughnessTexture: true,
        sheen: true,
        sheenColorTexture: true,
        sheenRoughnessTexture: true,
        iridescence: true,
        iridescenceTexture: true,
        iridescenceThicknessTexture: true,
        transmission: true,
        transmissionTexture: true,
        shadowMap: true,
      },
      "standard-directional-point": {
        shadowMap: true,
        pointShadowMap: true,
        directionalPointShadowMap: true,
        clusteredLocalLightPointArrayShadows: true,
      },
      "standard-clearcoat-directional-point": {
        clearcoat: true,
        shadowMap: true,
        pointShadowMap: true,
        directionalPointShadowMap: true,
        clusteredLocalLightPointArrayShadows: true,
      },
      "standard-sheen-directional-point": {
        sheen: true,
        shadowMap: true,
        pointShadowMap: true,
        directionalPointShadowMap: true,
        clusteredLocalLightPointArrayShadows: true,
      },
      "standard-iridescence-directional-point": {
        iridescence: true,
        shadowMap: true,
        pointShadowMap: true,
        directionalPointShadowMap: true,
        clusteredLocalLightPointArrayShadows: true,
      },
      "standard-clearcoat-sheen-directional-point": {
        clearcoat: true,
        sheen: true,
        shadowMap: true,
        pointShadowMap: true,
        directionalPointShadowMap: true,
        clusteredLocalLightPointArrayShadows: true,
      },
      "standard-combined-lobes-directional-point": {
        normalTexture: true,
        clearcoat: true,
        clearcoatTexture: true,
        clearcoatRoughnessTexture: true,
        sheen: true,
        sheenColorTexture: true,
        sheenRoughnessTexture: true,
        iridescence: true,
        iridescenceTexture: true,
        iridescenceThicknessTexture: true,
        transmission: true,
        transmissionTexture: true,
        shadowMap: true,
        pointShadowMap: true,
        directionalPointShadowMap: true,
        clusteredLocalLightPointArrayShadows: true,
      },
    };
    for (const [name, features] of Object.entries(variants)) {
      const shader = createStandardTextureVariantShader({
        ...standardBase,
        ...features,
      });
      recordNoOp(
        name,
        shader.code,
        applyOutputTonemapToStandardShader(shader, "none", "linear").code,
      );
      const wrapped = applyOutputTonemapToStandardShader(
        shader,
        "aces",
        "srgb",
      );
      cases.push({ name: `${name} aces/srgb`, code: wrapped.code });
      cases.push({
        name: `${name} aces/srgb + motion-vector`,
        code: createMotionVectorBuiltInShaderVariant(wrapped).code,
      });
    }
  }
  return {
    schema,
    kind,
    scope:
      kind === "shader"
        ? "native module compilation; family pipelines are not drawn"
        : "native compute/readback of exact pinned CI tonemap cases",
    originalCaseCount,
    noOpChecks,
    cases: cases.map((entry, index) => ({
      ...entry,
      index,
      sha256: sha256(Buffer.from(entry.code)),
    })),
    inputs: kind === "tonemap" ? INPUTS : null,
    expected: kind === "tonemap" ? EXPECTED : null,
    tolerance: kind === "tonemap" ? TOLERANCE : null,
  };
}

export function validateVerifiedGateResult(config, result) {
  assert.equal(result?.schema, schema);
  assert.equal(result.kind, config.kind);
  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
  assert(
    config.noOpChecks.every(
      (entry) => entry.byteIdentity && entry.beforeSha256 === entry.afterSha256,
    ),
  );
  assert.equal(result.compiledCases.length, config.cases.length);
  for (const [index, entry] of result.compiledCases.entries()) {
    assert.equal(entry.name, config.cases[index].name);
    assert.equal(entry.sha256, config.cases[index].sha256);
    assert.equal(entry.validationError, null);
    assert.equal(
      entry.messages.filter((message) => message.type === "error").length,
      0,
    );
  }
  if (config.kind === "shader")
    return {
      compiledCaseCount: result.compiledCases.length,
      familyCaseCount: config.originalCaseCount,
      additionalStandardCases:
        result.compiledCases.length - config.originalCaseCount,
    };
  assert.deepEqual(Object.keys(result.readbacks), OPERATORS);
  const numerical = [];
  for (const operator of OPERATORS) {
    const raw = result.readbacks[operator];
    assert.equal(raw.bytes.length, INPUTS.length * 16);
    assert.equal(raw.rgba.length, INPUTS.length * 4);
    assert(
      raw.bytes.every(
        (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
      ),
    );
    const bytes = Buffer.from(raw.bytes);
    for (let row = 0; row < INPUTS.length; row++)
      for (let channel = 0; channel < 4; channel++) {
        const index = row * 4 + channel,
          got = raw.rgba[index],
          want = channel === 3 ? 1 : EXPECTED[operator][row][channel];
        assert.equal(
          got,
          bytes.readFloatLE(index * 4),
          "Readback float and actual byte streams differ",
        );
        assert(Number.isFinite(got), `${operator}: non-finite readback`);
        const difference = Math.abs(got - want);
        assert(
          difference <= TOLERANCE,
          `${operator}[${row}][${channel}]: ${got} != ${want}`,
        );
        numerical.push({
          operator,
          input: INPUTS[row],
          channel,
          got,
          want,
          absoluteError: difference,
        });
      }
  }
  return {
    operatorCount: OPERATORS.length,
    inputCount: INPUTS.length,
    tolerance: TOLERANCE,
    maxAbsoluteError: Math.max(
      ...numerical.map((entry) => entry.absoluteError),
    ),
    channels: numerical,
  };
}

// Browser function is serialized into the retained scene. Every WebGPU call
// forwards to the native API observed by the unchanged approved verifier.
export async function executeNativeCiGate(config) {
  const result = {
    schema: config.schema,
    kind: config.kind,
    ok: false,
    compiledCases: [],
    readbacks: {},
    failures: [],
  };
  try {
    const { GPUBufferUsage, GPUMapMode } = globalThis;
    const adapter = await globalThis.navigator.gpu.requestAdapter();
    if (!adapter)
      throw new Error("A native WebGPU adapter is required; no skip route");
    const device = await adapter.requestDevice();
    const modules = [];
    for (const test of config.cases) {
      device.pushErrorScope("validation");
      const module = device.createShaderModule({
        label: test.name,
        code: test.code,
      });
      const info = await module.getCompilationInfo();
      const scopeError = await device.popErrorScope();
      const record = {
        name: test.name,
        sha256: test.sha256,
        messages: Array.from(info.messages, (message) => ({
          type: message.type,
          message: message.message,
          lineNum: message.lineNum,
          linePos: message.linePos,
          offset: message.offset,
          length: message.length,
        })),
        validationError: scopeError?.message ?? null,
      };
      result.compiledCases.push(record);
      modules.push(module);
      if (
        scopeError ||
        record.messages.some((message) => message.type === "error")
      )
        result.failures.push({ phase: "module-compilation", ...record });
    }
    let visibleBuffer;
    const visibleCount =
      config.kind === "tonemap"
        ? config.inputs.length * config.cases.length
        : 0;
    if (config.kind === "tonemap" && result.failures.length === 0) {
      const values = new Float32Array(
        config.inputs.flatMap((row) => [...row, 1]),
      );
      visibleBuffer = device.createBuffer({
        label: "tonemap-visible-native-results",
        size: visibleCount * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      for (const test of config.cases) {
        device.pushErrorScope("validation");
        const input = device.createBuffer({
          label: test.name + "-input",
          size: values.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const output = device.createBuffer({
          label: test.name + "-output",
          size: values.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });
        const readback = device.createBuffer({
          label: test.name + "-readback",
          size: values.byteLength,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        device.queue.writeBuffer(input, 0, values);
        const pipeline = device.createComputePipeline({
          layout: "auto",
          compute: { module: modules[test.index], entryPoint: "main" },
        });
        const group = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: input } },
            { binding: 1, resource: { buffer: output } },
          ],
        });
        const encoder = device.createCommandEncoder(),
          pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(config.inputs.length);
        pass.end();
        encoder.copyBufferToBuffer(output, 0, readback, 0, values.byteLength);
        encoder.copyBufferToBuffer(
          output,
          0,
          visibleBuffer,
          test.index * values.byteLength,
          values.byteLength,
        );
        device.queue.submit([encoder.finish()]);
        const scopeError = await device.popErrorScope();
        if (scopeError) {
          result.failures.push({
            phase: "compute",
            name: test.name,
            validationError: scopeError.message,
          });
          continue;
        }
        await device.queue.onSubmittedWorkDone();
        await readback.mapAsync(GPUMapMode.READ);
        const bytes = new Uint8Array(readback.getMappedRange()).slice();
        result.readbacks[test.name] = {
          bytes: Array.from(bytes),
          rgba: Array.from(new Float32Array(bytes.buffer)),
        };
        readback.unmap();
        input.destroy();
        output.destroy();
        readback.destroy();
      }
    }
    const canvas = globalThis.document.getElementById("proof"),
      context = canvas.getContext("webgpu"),
      format = globalThis.navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "opaque" });
    const displayCode = `${visibleBuffer ? "@group(0) @binding(0) var<storage,read> colors:array<vec4f>;" : ""}
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f { let p=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0)); return vec4f(p[i],0.0,1.0); }
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
${visibleBuffer ? "let index=min(u32(p.x/1024.0*f32(arrayLength(&colors))),arrayLength(&colors)-1u); return colors[index];" : "return vec4f(p.x/1024.0,p.y/768.0,0.35,1.0);"}
}`;
    const display = device.createShaderModule({
      label: "CI gate native canvas proof",
      code: displayCode,
    });
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: display, entryPoint: "vs" },
      fragment: { module: display, entryPoint: "fs", targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
    const encoder = device.createCommandEncoder(),
      pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          },
        ],
      });
    pass.setPipeline(pipeline);
    if (visibleBuffer)
      pass.setBindGroup(
        0,
        device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: visibleBuffer } }],
        }),
      );
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    result.ok = result.failures.length === 0;
  } catch (error) {
    result.failures.push({
      phase: "native-gate",
      message: error.message,
      stack: error.stack,
    });
  }
  globalThis.__VERIFIED_CI_GATE_STATUS__ = result;
}

export function verifiedCiGateHtml(config) {
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Verified ${config.kind} CI gate</title></head><body style="margin:0"><canvas id="proof" width="1024" height="768"></canvas><script type="module">(${executeNativeCiGate.toString()})(${JSON.stringify(config)});</script></body></html>`;
}

async function preserveNativeResults(outputRoot, result) {
  await writeImmutable(
    resolve(outputRoot, "native-results.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  for (const [operator, readback] of Object.entries(result.readbacks ?? {})) {
    assert(
      OPERATORS.includes(operator),
      "Unexpected tonemap readback operator",
    );
    await writeImmutable(
      resolve(outputRoot, `${operator}-readback.bin`),
      Buffer.from(readback.bytes),
    );
  }
}

export async function runVerifiedCiGate(kind, outputRoot) {
  assert(
    isAbsolute(outputRoot),
    "Provide an absolute create-only output directory",
  );
  const lifecycle = await verifyLifecycle(),
    config = buildVerifiedGateConfig(kind),
    html = verifiedCiGateHtml(config);
  assert(
    !resolve(outputRoot).startsWith(resolve(lifecycle.root) + "/"),
    "Retained gate evidence must be outside disposable scratch",
  );
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot);
  await mkdir(resolve(outputRoot, "wgsl"));
  const cases = [];
  for (const entry of config.cases) {
    const path = `wgsl/${String(entry.index).padStart(2, "0")}.wgsl`;
    await writeImmutable(resolve(outputRoot, path), entry.code);
    cases.push({
      name: entry.name,
      path,
      bytes: Buffer.byteLength(entry.code),
      sha256: entry.sha256,
    });
  }
  await writeImmutable(
    resolve(outputRoot, "cases.json"),
    JSON.stringify(config, null, 2) + "\n",
  );
  await writeImmutable(resolve(outputRoot, "scene.html"), html);
  const sources = {};
  for (const path of [
    resolve(directory, "verified-ci-gates.mjs"),
    resolve(directory, "../../scripts/webgpu-shader-compile-check.mjs"),
    resolve(directory, "../../scripts/webgpu-tonemap-numeric-check.mjs"),
  ]) {
    const bytes = await readFile(path),
      key = path.split("/").at(-1);
    await writeImmutable(resolve(outputRoot, key), bytes);
    sources[key] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  await writeImmutable(
    resolve(outputRoot, "inputs.json"),
    JSON.stringify(
      {
        schema,
        kind,
        lifecycleRun: lifecycle.run,
        cases,
        sources,
        sceneSha256: sha256(Buffer.from(html)),
        caseConfigSha256: sha256(
          Buffer.from(JSON.stringify(config, null, 2) + "\n"),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  const server = createServer((request, response) => {
    if (request.url !== "/") {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    });
    response.end(html);
  });
  let report;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      report = await runVerifiedScene({
        runtimeRoot: lifecycle.runtimeRoot,
        scratchRoot: lifecycle.scratch,
        url: `http://127.0.0.1:${server.address().port}/`,
        outputPath: resolve(outputRoot, "verified-runner.json"),
        screenshotPath: resolve(outputRoot, "native-canvas.png"),
        readyGlobal: "__VERIFIED_CI_GATE_STATUS__",
        viewport: { width: 1024, height: 768 },
      });
    } catch (error) {
      const failed = JSON.parse(
        await readFile(resolve(outputRoot, "verified-runner.json"), "utf8"),
      );
      if (failed.sceneStatus)
        await preserveNativeResults(outputRoot, failed.sceneStatus);
      throw error;
    }
    await preserveNativeResults(outputRoot, report.sceneStatus);
    const validation = validateVerifiedGateResult(config, report.sceneStatus);
    await writeImmutable(
      resolve(outputRoot, "validation.json"),
      JSON.stringify(
        { schema, kind, status: "passed", ...validation },
        null,
        2,
      ) + "\n",
    );
    return validation;
  } catch (error) {
    await writeImmutable(
      resolve(outputRoot, "failure.json"),
      JSON.stringify(
        {
          schema,
          kind,
          status: "failed",
          error: { message: error.message, stack: error.stack },
        },
        null,
        2,
      ) + "\n",
    );
    throw error;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await runVerifiedCiGate(process.argv[2], process.argv[3]);
    console.log(
      JSON.stringify({
        schema,
        kind: process.argv[2],
        status: "passed",
        compiledCaseCount: result.compiledCaseCount,
        operatorCount: result.operatorCount,
        inputCount: result.inputCount,
        maxAbsoluteError: result.maxAbsoluteError,
      }),
    );
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
