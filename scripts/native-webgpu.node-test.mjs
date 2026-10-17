import path from "node:path";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  createNodeDevice,
  createOffscreenOutput,
} from "../packages/adapter-node/dist/index.js";
import { renderPortableBundle } from "../packages/app/dist/render-bundle.js";
import { createApertureRenderSession } from "../packages/cli/dist/render/driver.js";
import {
  readPngDimensions,
  readPngSamples,
} from "../packages/cli/dist/tools/png-readback.js";
import { compileShader } from "../packages/shader/dist/compiler.js";
import {
  mapShaderDiagnostic,
  packShaderBuffer,
} from "../packages/shader/dist/index.js";
import { createFrameGraph } from "../packages/webgpu/dist/render/graph/frame-graph.js";
import { compileFrameGraph } from "../packages/webgpu/dist/render/graph/frame-graph-compile.js";
import { executeFrameGraph } from "../packages/webgpu/dist/render/graph/frame-graph-execute.js";

// A required real-device lane: a missing binding/driver fails, never skips.
let native;
before(async () => {
  native = await createNodeDevice({
    adapter: process.env.APERTURE_DAWN_TEST_ADAPTER ?? "software",
  });
});
after(async () => {
  await native?.dispose();
});
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../test/e2e/fixtures/procedural-cube.bundle.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function clear(output, color) {
  const encoder = native.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: output.acquire().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: color,
      },
    ],
  });
  pass.end();
  native.device.queue.submit([encoder.finish()]);
}

test("Dawn readback handles odd-width rows, RGBA/BGRA, resize and straight alpha", async () => {
  for (const format of ["rgba8unorm", "bgra8unorm"]) {
    const output = createOffscreenOutput(native.device, {
      width: 65,
      height: 3,
      format,
      alphaMode: "premultiplied",
    });
    try {
      clear(output, { r: 0.25, g: 0.125, b: 0, a: 0.5 });
      const data = await output.readRgba();
      assert.equal(data.length, 65 * 3 * 4);
      for (const offset of [0, 64 * 4, 65 * 4, data.length - 4])
        assert.deepEqual(
          [...data.slice(offset, offset + 4)],
          [128, 64, 0, 128],
        );
      output.resize(17, 2);
      clear(output, { r: 0, g: 0, b: 0, a: 0 });
      assert.equal(
        (await output.readRgba()).every((value) => value === 0),
        true,
      );
      native.assertHealthy();
    } finally {
      await output.dispose();
    }
    assert.throws(() => output.acquire(), /disposed/);
  }
});

test("Dawn output rejects over-budget dimensions and overlapping reads", async () => {
  assert.throws(
    () =>
      createOffscreenOutput(native.device, {
        width: 100,
        height: 100,
        maxBytes: 20,
      }),
    /budget/,
  );
  assert.throws(
    () => createOffscreenOutput(native.device, { width: 0, height: 1 }),
    /dimensions/,
  );
  const output = createOffscreenOutput(native.device, { width: 65, height: 2 });
  try {
    clear(output, { r: 1, g: 0, b: 0, a: 0 });
    const first = output.readRgba();
    assert.throws(() => output.resize(10, 10), /readback/);
    await assert.rejects(output.readRgba(), /one output readback/);
    assert.equal((await first)[3], 255);
  } finally {
    await output.dispose();
  }
});

test("Dawn output preserves the old texture and dimensions when resize allocation fails", async () => {
  let rejectTexture = false;
  const device = new Proxy(native.device, {
    get(target, property) {
      if (property === "createTexture")
        return (...args) => {
          if (rejectTexture)
            throw new Error("injected texture allocation failure");
          return target.createTexture(...args);
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const output = createOffscreenOutput(device, { width: 17, height: 9 });
  try {
    clear(output, { r: 1, g: 0, b: 0, a: 1 });
    const before = await output.readRgba();
    const texture = output.acquire();
    rejectTexture = true;
    assert.throws(() => output.resize(33, 17), /injected texture allocation/);
    rejectTexture = false;
    assert.equal(output.width, 17);
    assert.equal(output.height, 9);
    assert.equal(output.acquire(), texture);
    assert.deepEqual(await output.readRgba(), before);
    output.resize(33, 17);
    clear(output, { r: 0, g: 1, b: 0, a: 1 });
    assert.deepEqual(
      [...(await output.readRgba()).slice(0, 4)],
      [0, 255, 0, 255],
    );
    native.assertHealthy();
  } finally {
    await output.dispose();
  }
});

test("Dawn validates WGSL and executes compute with actual readback", async () => {
  const device = native.device;
  device.pushErrorScope("validation");
  const invalid = device.createShaderModule({
    code: "@compute @workgroup_size(1) fn broken() { missing = 1; }",
  });
  const info = await invalid.getCompilationInfo();
  assert.ok(
    info.messages.some(
      (message) => message.type === "error" && message.lineNum === 1,
    ),
  );
  assert.ok(await device.popErrorScope());
  const buffer = device.createBuffer({ size: 16, usage: 0x80 | 0x04 });
  const readback = device.createBuffer({ size: 16, usage: 0x01 | 0x08 });
  try {
    const module = device.createShaderModule({
      code: "@group(0) @binding(0) var<storage,read_write> data: array<u32>; @compute @workgroup_size(4) fn main(@builtin(global_invocation_id) id: vec3u) { data[id.x] = id.x * 7u + 3u; }",
    });
    const pipeline = await device.createComputePipelineAsync({
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
    const bindings = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindings);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(buffer, 0, readback, 0, 16);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(1);
    assert.deepEqual(
      [...new Uint32Array(readback.getMappedRange())],
      [3, 10, 17, 24],
    );
    readback.unmap();
    native.assertHealthy();
  } finally {
    buffer.destroy();
    readback.destroy();
  }
});

test("Aperture renderer borrows Dawn device and preserves external resources", async () => {
  const output = createOffscreenOutput(native.device, {
    width: 321,
    height: 201,
  });
  let app;
  try {
    const rendered = await renderPortableBundle(fixture, {
      deviceContext: native,
      output,
    });
    app = rendered.app;
    assert.equal(rendered.status.ok, true);
    const pixels = await output.readRgba();
    assert.ok(pixels[(100 * 321 + 160) * 4] > 20);
    await app.dispose();
    await app.dispose();
    await assert.rejects(app.renderSnapshot({}), /disposed/);
    clear(output, { r: 0, g: 1, b: 0, a: 1 });
    assert.deepEqual(
      [...(await output.readRgba()).slice(0, 4)],
      [0, 255, 0, 255],
    );
    native.assertHealthy();
  } finally {
    await app?.dispose();
    await output.dispose();
  }
});

test(
  "native warm session drains accepted jobs, isolates sizes, and exits cleanly",
  { timeout: 60_000 },
  async () => {
    const session = await createApertureRenderSession({
      backend: "dawn",
      adapter: "software",
    });
    assert.equal(session.backend, "dawn");
    assert.equal(session.browser, undefined);
    try {
      const jobs = [
        [321, 201],
        [127, 93],
        [321, 201],
      ].map(([width, height]) =>
        session.render({ bundle: fixture, width, height }),
      );
      const disposal = session.dispose();
      await assert.rejects(
        session.render({ bundle: fixture, width: 10, height: 10 }),
        /disposed/,
      );
      const rendered = await Promise.all(jobs);
      assert.deepEqual(rendered[0].png, rendered[2].png);
      assert.deepEqual(readPngDimensions(rendered[1].png), {
        width: 127,
        height: 93,
      });
      assert.equal(rendered[0].metadata.backend, "dawn");
      assert.equal(rendered[0].metadata.browser, undefined);
      assert.ok(
        readPngSamples(rendered[0].png, { samples: [{ x: 0.5, y: 0.5 }] })
          .samples[0].pixel.r > 20,
      );
      await disposal;
    } finally {
      await session.dispose();
    }
  },
);

test(
  "native hard timeout invalidates the worker and rejects queued work",
  { timeout: 60_000 },
  async () => {
    const session = await createApertureRenderSession({
      backend: "dawn",
      adapter: "software",
    });
    try {
      const first = session.render({
        bundle: fixture,
        width: 960,
        height: 640,
        timeoutMs: 1,
      });
      const second = session.render({ bundle: fixture, width: 32, height: 32 });
      const results = await Promise.allSettled([first, second]);
      assert.ok(results.every((result) => result.status === "rejected"));
      assert.match(results[0].reason.message, /exceeded/);
    } finally {
      await session.dispose();
    }
  },
);

test("Dawn rejects incompatible adapter policy/features and reports actual device loss", async () => {
  await assert.rejects(
    createNodeDevice({ adapter: "hardware" }),
    /selected software adapter/,
  );
  await assert.rejects(
    createNodeDevice({ requiredFeatures: ["aperture-test-missing-feature"] }),
    /Required WebGPU feature/,
  );
  const other = await createNodeDevice({ adapter: "software" });
  other.device.destroy();
  await other.lost;
  assert.throws(
    () => other.assertHealthy(),
    (error) => error.code === "aperture.dawn.deviceLost",
  );
  await other.dispose();
  await other.dispose();
});

test("native preflight failure leaves a warm session usable", async () => {
  const session = await createApertureRenderSession({
    backend: "dawn",
    adapter: "software",
  });
  try {
    await assert.rejects(
      session.render({
        bundle: { format: "unsupported", version: 99 },
        width: 32,
        height: 32,
      }),
    );
    const recovered = await session.render({
      bundle: fixture,
      width: 65,
      height: 39,
    });
    assert.deepEqual(readPngDimensions(recovered.png), {
      width: 65,
      height: 39,
    });
  } finally {
    await session.dispose();
  }
});

test("real WGSL compute verifies reflected matrix/struct/array packing", async () => {
  const artifact = compileShader({
    entry: "entry.wgsl",
    modules: {
      "entry.wgsl": `// @import "./math.wgsl"
      struct Inner {xyz:vec3f,w:f32}; struct U { scalar:f32, vector:vec3f, matrix:mat3x3f, data:array<Inner,2> };
      @group(0) @binding(0) var<uniform> u:U;
      @group(0) @binding(1) var<storage,read_write> output:array<f32>;
      @compute @workgroup_size(1) fn main() { output[0]=sum(u.vector)+u.scalar; output[1]=u.matrix[2][1]; output[2]=sum(u.data[1].xyz)+u.data[1].w; }`,
      "math.wgsl": "fn sum(v:vec3f)->f32 {return v.x+v.y+v.z;}",
    },
  });
  const device = native.device;
  const bytes = packShaderBuffer(artifact.bindings[0].layout, {
    scalar: 2,
    vector: [3, 4, 5],
    matrix: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    data: [
      { xyz: [10, 11, 12], w: 13 },
      { xyz: [14, 15, 16], w: 17 },
    ],
  });
  const uniform = device.createBuffer({
    size: bytes.byteLength,
    usage: 0x40 | 0x08,
  });
  const output = device.createBuffer({ size: 12, usage: 0x80 | 0x04 });
  const readback = device.createBuffer({ size: 12, usage: 0x01 | 0x08 });
  try {
    device.queue.writeBuffer(uniform, 0, bytes);
    const module = device.createShaderModule({ code: artifact.code });
    assert.deepEqual((await module.getCompilationInfo()).messages, []);
    const pipeline = await device.createComputePipelineAsync({
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
    const group = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniform } },
        { binding: 1, resource: { buffer: output } },
      ],
    });
    const encoder = device.createCommandEncoder(),
      pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, 12);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(1);
    assert.deepEqual(
      [...new Float32Array(readback.getMappedRange())],
      [14, 8, 62],
    );
    readback.unmap();
    native.assertHealthy();
  } finally {
    uniform.destroy();
    output.destroy();
    readback.destroy();
  }
});

test("actual device diagnostics map invalid imported WGSL to the authored file", async () => {
  const artifact = compileShader({
    entry: "main.wgsl",
    modules: {
      "main.wgsl":
        '// @import "./lib.wgsl"\n@compute @workgroup_size(1) fn main() {let value=broken();}',
      "lib.wgsl": "fn broken()->f32 {\n  return missingFunction();\n}",
    },
  });
  native.device.pushErrorScope("validation");
  try {
    const info = await native.device
      .createShaderModule({ code: artifact.code })
      .getCompilationInfo();
    const diagnostic = info.messages
      .filter((message) => message.type === "error")
      .map((message) => mapShaderDiagnostic(artifact, message));
    assert.ok(
      diagnostic.some(
        (message) =>
          message.location?.file === "lib.wgsl" && message.location.line === 2,
      ),
    );
  } finally {
    assert.ok(await native.device.popErrorScope());
  }
});

test("existing graph executor runs standalone compute-to-draw with one submission and no readback between passes", async () => {
  const device = native.device;
  const output = createOffscreenOutput(device, { width: 65, height: 17 });
  const data = device.createBuffer({ size: 16, usage: 0x80 });
  try {
    const computeModule = device.createShaderModule({
      code: "@group(0) @binding(0) var<storage,read_write> data:vec4f; @compute @workgroup_size(1) fn main() {data=vec4f(0.25,0.5,0.75,1);}",
    });
    const renderModule = device.createShaderModule({
      code: `@group(0) @binding(0) var<storage,read> data:vec4f;
      @vertex fn vertex(@builtin(vertex_index) i:u32)->@builtin(position) vec4f {let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));return vec4f(p[i],0,1);}
      @fragment fn fragment()->@location(0) vec4f {return data;}`,
    });
    const compute = await device.createComputePipelineAsync({
      layout: "auto",
      compute: { module: computeModule, entryPoint: "main" },
    });
    const render = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vertex" },
      fragment: {
        module: renderModule,
        entryPoint: "fragment",
        targets: [{ format: output.format }],
      },
    });
    const makeGroup = (pipeline) =>
      device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: data } }],
      });
    const graph = createFrameGraph();
    graph.declareResource({
      id: "data",
      descriptor: { kind: "buffer", lifetime: "persistent" },
    });
    graph.importSwapchain("output");
    graph.addComputePass({
      name: "compute",
      reads: [],
      writes: [{ handle: "data", attachment: "load" }],
      commands: [
        {
          kind: "setComputePipeline",
          pipelineKey: "compute",
          pipeline: compute,
        },
        {
          kind: "setComputeBindGroup",
          index: 0,
          resourceKey: "data",
          bindGroup: makeGroup(compute),
        },
        {
          kind: "dispatchWorkgroups",
          workgroupCountX: 1,
          workgroupCountY: 1,
          workgroupCountZ: 1,
        },
      ],
    });
    graph.addRenderPass({
      name: "draw",
      reads: ["data"],
      writes: [{ handle: "output", attachment: "clear" }],
      commands: [
        {
          kind: "setPipeline",
          renderId: 0,
          pipelineKey: "render",
          pipeline: render,
        },
        {
          kind: "setBindGroup",
          renderId: 0,
          index: 0,
          resourceKey: "data",
          bindGroup: makeGroup(render),
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
    });
    let submissions = 0;
    const compiled = compileFrameGraph(graph);
    const report = executeFrameGraph({
      device,
      queue: {
        submit: (commands) => {
          submissions++;
          device.queue.submit(commands);
        },
      },
      compiled,
      resources: {
        resolveAttachment: (id) =>
          id === "output"
            ? { kind: "color", view: output.acquire().createView() }
            : null,
      },
    });
    assert.equal(report.valid, true, JSON.stringify(report.diagnostics));
    assert.deepEqual(compiled.report.order, ["compute", "draw"]);
    assert.equal(submissions, 1);
    assert.deepEqual(
      [...(await output.readRgba()).slice(0, 4)],
      [64, 128, 191, 255],
    );
    native.assertHealthy();
  } finally {
    data.destroy();
    await output.dispose();
  }
});

test("portable shader jobs render through the clean CLI route and warm session", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const { encodeShaderJob } = await import("../packages/shader/dist/index.js");
  const directory = await mkdtemp(join(tmpdir(), "aperture-shader-job-"));
  const source = compileShader({
    entry: "job.wgsl",
    modules: {
      "job.wgsl":
        "@fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f{return vec4f(p.x/65,p.y/33,0.5,1);}",
    },
  });
  const job = encodeShaderJob({
    format: "aperture.shader-job",
    version: 1,
    width: 65,
    height: 33,
    resources: [],
    frames: [
      {
        input: {},
        operations: [{ kind: "effect", name: "gradient", shader: source }],
        writes: [],
      },
    ],
  });
  const session = await createApertureRenderSession({
    adapter: "software",
  });
  try {
    const bundlePath = join(directory, "job.json"),
      outputPath = join(directory, "job.png");
    await writeFile(bundlePath, JSON.stringify(job));
    const result = spawnSync(
      process.execPath,
      [
        new URL("../packages/cli/dist/bin/aperture.js", import.meta.url)
          .pathname,
        "shader",
        "render",
        bundlePath,
        "--out",
        outputPath,
        "--adapter",
        "software",
        "--json",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DISPLAY: "",
          APERTURE_CHROME_PATH: "/nonexistent/browser",
        },
        timeout: 60000,
      },
    );
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.deepEqual(readPngDimensions(await readFile(outputPath)), {
      width: 65,
      height: 33,
    });
    const rendered = await session.render({
      bundle: job,
      width: 65,
      height: 33,
    });
    assert.equal(rendered.metadata.backend, "dawn");
    assert.equal(
      rendered.metadata.shader.reports[0].submittedCommandBuffers,
      1,
    );
    assert.equal(
      rendered.metadata.shader.inspection.operations[0].shader.hash,
      source.hash,
    );
    assert.ok(rendered.metadata.cpuTimings.pngMs >= 0);
    assert.equal("browser" in rendered.metadata, false);
  } finally {
    await session.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

test("native worker releases Dawn and exits after parent IPC disconnect", async () => {
  const { fork } = await import("node:child_process");
  const child = fork(
    new URL("../packages/cli/dist/render/dawn-worker.js", import.meta.url),
    [],
    {
      execArgv: [],
      serialization: "advanced",
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    },
  );
  let errors = "";
  child.stderr.on("data", (data) => {
    errors += data;
  });
  let deadline;
  const timeout = new Promise((_, reject) => {
    deadline = setTimeout(
      () => reject(new Error("Worker did not exit after IPC EOF: " + errors)),
      10000,
    );
  });
  try {
    const closed = new Promise((resolve) => child.once("exit", resolve));
    const response = new Promise((resolve, reject) => {
      child.once("message", resolve);
      child.once("error", reject);
    });
    child.send({ id: 1, kind: "initialize", options: { adapter: "software" } });
    const initialized = await Promise.race([response, timeout]);
    assert.equal(initialized.ok, true, initialized.error);
    child.disconnect();
    assert.equal(await Promise.race([closed, timeout]), 0);
  } finally {
    clearTimeout(deadline);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});

test("app user render passes honor declared targets and sample them on the shared graph", async () => {
  const { renderSnapshotFromJsonValue } =
    await import("../packages/render/dist/index.js");
  const { FULLSCREEN_VERTEX_WGSL } =
    await import("../packages/gpu/dist/index.js");
  const output = createOffscreenOutput(native.device, {
    width: 65,
    height: 33,
  });
  let rendered;
  try {
    rendered = await renderPortableBundle(fixture, {
      deviceContext: native,
      output,
      useFrameGraph: true,
    });
    const app = rendered.app,
      device = native.device;
    app.addGpuResource({
      kind: "texture",
      id: "custom-color",
      format: "rgba8unorm",
      usage: ["attachment", "sampled"],
      lifetime: "transient",
    });
    const vertex = device.createShaderModule({ code: FULLSCREEN_VERTEX_WGSL });
    const first = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: vertex, entryPoint: "apertureFullscreen" },
      fragment: {
        module: device.createShaderModule({
          code: "@fragment fn main()->@location(0) vec4f{return vec4f(0.25,0.75,0.5,1);}",
        }),
        entryPoint: "main",
        targets: [{ format: "rgba8unorm" }],
      },
    });
    const second = await device.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: vertex, entryPoint: "apertureFullscreen" },
      fragment: {
        module: device.createShaderModule({
          code: "@group(0) @binding(0) var image:texture_2d<f32>; @fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f{return textureLoad(image,vec2i(p.xy),0);}",
        }),
        entryPoint: "main",
        targets: [{ format: "rgba8unorm" }],
      },
      multisample: { count: app.msaa.sampleCount },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "always",
      },
    });
    app.addRenderPass({
      name: "custom-target",
      writes: [{ handle: "custom-color", attachment: "clear" }],
      encode(ctx) {
        ctx.setPipeline(first);
        ctx.draw(3);
      },
    });
    app.addRenderPass({
      name: "custom-present",
      reads: ["custom-color"],
      writes: ["scene-color"],
      after: "custom-target",
      encode(ctx) {
        const bind = device.createBindGroup({
          layout: second.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: ctx.view("custom-color") }],
        });
        ctx.setPipeline(second);
        ctx.setBindGroup(0, bind);
        ctx.draw(3);
      },
    });
    const report = await app.renderSnapshot(
      renderSnapshotFromJsonValue(fixture.snapshot.value),
    );
    assert.equal(report.ok, true, JSON.stringify(report.diagnostics));
    assert.deepEqual(
      [...(await output.readRgba()).slice(0, 4)],
      [64, 191, 128, 255],
    );
    native.assertHealthy();
  } finally {
    await rendered?.app.dispose();
    await output.dispose();
  }
});

test("portable source-buffer assets feed custom material storage bindings", async () => {
  const {
    createCustomWgslMaterialAsset,
    createSourceBufferAsset,
    encodeTypedArrayTree,
  } = await import("../packages/render/dist/index.js");
  const { createBufferHandle } =
    await import("../packages/simulation/dist/index.js");
  const buffer = createBufferHandle("colors");
  const material = createCustomWgslMaterialAsset({
    familyKey: "test/storage",
    label: "Storage material",
    shader: {
      kind: "inline-wgsl",
      code: "struct View {viewProjection:mat4x4f}; @group(0) @binding(0) var<uniform> view:View; @group(1) @binding(0) var<storage,read> transforms:array<mat4x4f>; @group(2) @binding(0) var<storage,read> color:vec4f; @vertex fn vs(@location(0) position:vec3f,@builtin(instance_index) index:u32)->@builtin(position) vec4f{return view.viewProjection*transforms[index]*vec4f(position,1);} @fragment fn fs()->@location(0) vec4f{return color;}",
    },
    entryPoints: { vertex: "vs", fragment: "fs" },
    bindings: [
      {
        name: "color",
        binding: 0,
        kind: "storage-buffer",
        visibility: ["fragment"],
        access: "read",
        buffer,
      },
    ],
  });
  const bundle = structuredClone(fixture);
  const source = bundle.assets.entries.find(
    (entry) => entry.handle.kind === "material",
  );
  source.asset = material;
  source.dependencies = [buffer];
  bundle.assets.entries.push({
    handle: buffer,
    label: "Colors",
    status: "ready",
    version: 1,
    asset: encodeTypedArrayTree(
      createSourceBufferAsset(new Float32Array([0.25, 0.5, 1, 1])),
    ),
    dependencies: [],
    diagnostics: [],
  });
  bundle.snapshot.value.meshDraws[0].batchKey.pipelineKey = "test/storage";
  const output = createOffscreenOutput(native.device, {
    width: 321,
    height: 201,
  });
  let rendered;
  try {
    rendered = await renderPortableBundle(bundle, {
      deviceContext: native,
      output,
    });
    assert.equal(
      rendered.status.ok,
      true,
      JSON.stringify(rendered.status.diagnostics),
    );
    const bytes = await output.readRgba(),
      center = (100 * 321 + 160) * 4;
    assert.deepEqual([...bytes.slice(center, center + 4)], [64, 128, 255, 255]);
    native.assertHealthy();
  } finally {
    await rendered?.app.dispose();
    await output.dispose();
  }
});

test("standard extension surface, deformation and procedural cutout agree with GPU picking", async () => {
  const { STANDARD_MATERIAL_EXTENSION_WGSL, standardMaterialExtensionKey } =
    await import("../packages/render/dist/index.js");
  const shader = compileShader({
    entry: "material.wgsl",
    modules: {
      "aperture-material.wgsl": STANDARD_MATERIAL_EXTENSION_WGSL,
      "material.wgsl": `// @import "./aperture-material.wgsl"
fn deform(v:ApertureVertex, uv:vec2f, p:vec4f)->ApertureVertex {return ApertureVertex(v.position+vec3f(p.x,0,0),v.normal);}
fn surface(s:ApertureSurface, uv:vec2f, world:vec3f,p:vec4f)->ApertureSurface {var result=s; result.baseColor=vec3f(0.1,0.8,0.2); result.metallic=0.0;return result;}
fn opacity(uv:vec2f,p:vec4f)->f32 {return p.y;}`,
    },
  });
  let stablePipelineMisses;
  for (const [offset, opacity, visible] of [
    [0, 1, true],
    [5, 1, false],
    [0, 0, false],
  ]) {
    const bundle = structuredClone(fixture);
    const material = bundle.assets.entries.find(
      (entry) => entry.handle.kind === "material",
    ).asset;
    material.extension = {
      shader,
      surface: "surface",
      deform: "deform",
      opacity: "opacity",
      parameters: [offset, opacity, 0, 0],
      previousParameters: [0, opacity, 0, 0],
    };
    material.renderState.alphaMode = "mask";
    bundle.snapshot.value.meshDraws[0].batchKey.pipelineKey = `standard|extension:${standardMaterialExtensionKey(material.extension)}|mask|back|less|none`;
    const output = createOffscreenOutput(native.device, {
      width: 321,
      height: 201,
    });
    let rendered;
    try {
      rendered = await renderPortableBundle(bundle, {
        deviceContext: native,
        output,
      });
      assert.equal(
        rendered.status.ok,
        true,
        JSON.stringify(rendered.status.diagnostics),
      );
      const bytes = await output.readRgba(),
        center = (100 * 321 + 160) * 4;
      if (visible)
        assert.ok(
          bytes[center + 1] > bytes[center] * 2,
          `surface color ${[...bytes.slice(center, center + 4)]}`,
        );
      const picked = await rendered.app.pick(160, 100);
      assert.equal(
        picked !== null,
        visible,
        JSON.stringify(rendered.app.getDiagnostics().lastPick),
      );
      if (stablePipelineMisses !== undefined)
        assert.equal(
          native.metadata.cache.misses,
          stablePipelineMisses,
          "Uniform changes must reuse immutable pipelines",
        );
      stablePipelineMisses = native.metadata.cache.misses;
      native.assertHealthy();
    } finally {
      await rendered?.app.dispose();
      await output.dispose();
    }
  }
});

test("compiled custom material reflects uniform offsets, remaps a vertex location, and rejects undeclared passes", async () => {
  const { createArtifactMaterialAsset } =
    await import("../packages/render/dist/index.js");
  const shader = compileShader({
    entry: "custom.wgsl",
    modules: {
      "custom.wgsl": `struct View {viewProjection:mat4x4f}; @group(0) @binding(0) var<uniform> view:View;
@group(1) @binding(0) var<storage,read> transforms:array<mat4x4f>;
struct Params {alpha:f32, tint:vec3f, zero:vec4f}; @group(2) @binding(0) var<uniform> params:Params;
@vertex fn vs(@location(5) position:vec3f,@builtin(instance_index) index:u32)->@builtin(position) vec4f{return view.viewProjection*transforms[index]*vec4f(position,1);}
@fragment fn fs()->@location(0) vec4f{return vec4f(params.tint,params.alpha)+params.zero;}`,
    },
  });
  const options = {
    familyKey: "test/artifact",
    label: "Reflected material",
    artifact: shader,
    entryPoints: { vertex: "vs", fragment: "fs" },
    vertexLayout: {
      arrayStride: 32,
      stepMode: "vertex",
      attributes: [{ offset: 0, format: "float32x3", shaderLocation: 5 }],
    },
    enginePasses: {
      color: true,
      shadow: "none",
      picking: "none",
      motion: "none",
    },
    bindings: [
      {
        name: "params",
        binding: 0,
        kind: "uniform-buffer",
        visibility: ["fragment"],
        fields: {
          tint: { type: "vec3", default: [0.2, 0.4, 0.6] },
          zero: { type: "vec4" },
          alpha: { type: "float32", default: 1 },
        },
      },
    ],
  };
  const material = createArtifactMaterialAsset(options);
  assert.throws(
    () =>
      createArtifactMaterialAsset({
        ...options,
        bindings: [{ ...options.bindings[0], name: "wrong" }],
      }),
    /reflected resource contract/,
  );
  assert.throws(
    () =>
      createArtifactMaterialAsset({
        ...options,
        enginePasses: { ...options.enginePasses, shadow: "auto" },
      }),
    /supports color/,
  );
  const bundle = structuredClone(fixture);
  bundle.assets.entries.find(
    (entry) => entry.handle.kind === "material",
  ).asset = material;
  bundle.snapshot.value.meshDraws[0].batchKey.pipelineKey = "test/artifact";
  bundle.snapshot.value.meshDraws[0].castsShadow = false;
  const output = createOffscreenOutput(native.device, {
    width: 321,
    height: 201,
  });
  let rendered;
  try {
    rendered = await renderPortableBundle(bundle, {
      deviceContext: native,
      output,
    });
    assert.equal(rendered.status.ok, true, JSON.stringify(rendered.status));
    const bytes = await output.readRgba(),
      center = (100 * 321 + 160) * 4;
    assert.deepEqual([...bytes.slice(center, center + 4)], [51, 102, 153, 255]);
    assert.equal(await rendered.app.pick(160, 100), null);
    assert.match(
      JSON.stringify(rendered.app.getDiagnostics().lastPick),
      /aperture.material.unsupportedPicking/,
    );
    native.assertHealthy();
  } finally {
    await rendered?.app.dispose();
    await output.dispose();
  }
});

test("MCP shader build, inspect and warm native render expose artifacts, graph and backend metadata", async () => {
  const { ApertureMcpSessionManager } =
    await import("../packages/cli/dist/mcp-session-manager.js");
  const { encodeShaderJob } = await import("../packages/shader/dist/index.js");
  const { mkdtemp, writeFile, rm, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const directory = await mkdtemp(path.join(tmpdir(), "aperture-mcp-shader-"));
  const manager = new ApertureMcpSessionManager({
    cwd: directory,
    renderer: { backend: "dawn", adapter: "software" },
  });
  try {
    await writeFile(
      path.join(directory, "shader.wgsl"),
      "@fragment fn main()->@location(0) vec4f{return vec4f(0.2,0.4,0.6,1); }",
    );
    const built = await manager.call({
      name: "shader_build",
      args: { path: "shader.wgsl", out: "artifact.json" },
    });
    assert.equal(built.ok, true);
    const inspected = await manager.call({
      name: "shader_inspect",
      args: { path: "artifact.json" },
    });
    assert.equal(inspected.artifact.hash, built.artifact.hash);
    const job = encodeShaderJob({
      format: "aperture.shader-job",
      version: 1,
      width: 65,
      height: 33,
      resources: [],
      frames: [
        {
          input: { time: 0, delta: 0 },
          writes: [],
          operations: [
            {
              kind: "effect",
              name: "effect",
              shader: built.artifact,
              fragmentEntry: "main",
            },
          ],
        },
      ],
    });
    await writeFile(path.join(directory, "job.json"), JSON.stringify(job));
    const jobReport = await manager.call({
      name: "shader_inspect",
      args: { path: "job.json" },
    });
    assert.equal(jobReport.job.format, "aperture.shader-job");
    for (let index = 0; index < 2; index++) {
      const result = await manager.call({
        name: "shader_render",
        args: { path: "job.json", out: "frame.png", includeData: true },
      });
      assert.equal(result.ok, true);
      assert.equal(result.renderer.backend, "dawn");
      assert.equal(
        result.renderer.shader.reports[0].submittedCommandBuffers,
        1,
      );
      assert.equal(
        result.renderer.shader.inspection.operations[0].shader.hash,
        built.artifact.hash,
      );
      assert.deepEqual(
        Buffer.from(result.pngBase64, "base64"),
        await readFile(path.join(directory, "frame.png")),
      );
    }
  } finally {
    await manager.dispose();
    await rm(directory, { recursive: true, force: true });
  }
});

for (const post of [false, true])
  test(`app MRT, depth, MSAA resolve and history run on ${post ? "post" : "forward"} graph`, async () => {
    const { renderSnapshotFromJsonValue } =
      await import("../packages/render/dist/index.js");
    const { FULLSCREEN_VERTEX_WGSL } =
      await import("../packages/gpu/dist/index.js");
    const bundle = structuredClone(fixture);
    if (post) {
      bundle.renderTarget.toneMapping = "aces";
      bundle.renderTarget.exposure = 1;
    }
    const output = createOffscreenOutput(native.device, {
      width: 65,
      height: 33,
    });
    let rendered;
    try {
      rendered = await renderPortableBundle(bundle, {
        deviceContext: native,
        output,
        useFrameGraph: true,
      });
      const app = rendered.app,
        device = native.device;
      for (const source of [
        {
          id: "history",
          lifetime: "history",
          usage: ["attachment", "sampled"],
        },
        { id: "resolved", usage: ["attachment", "sampled"] },
        { id: "msaa-a", sampleCount: 4, usage: ["attachment"] },
        { id: "msaa-b", sampleCount: 4, usage: ["attachment"] },
        {
          id: "custom-depth",
          sampleCount: 4,
          format: "depth24plus",
          usage: ["attachment"],
        },
      ])
        app.addGpuResource({
          kind: "texture",
          format: "rgba8unorm",
          ...source,
        });
      const vertex = device.createShaderModule({
        code: FULLSCREEN_VERTEX_WGSL,
      });
      const prepare = (code, targets, samples, depth) =>
        device.createRenderPipelineAsync({
          layout: "auto",
          vertex: { module: vertex, entryPoint: "apertureFullscreen" },
          fragment: {
            module: device.createShaderModule({ code }),
            entryPoint: "main",
            targets: targets.map((format) => ({ format })),
          },
          multisample: { count: samples },
          depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: depth,
            depthCompare: "always",
          },
        });
      const mrt = await prepare(
        "struct O {@location(0) a:vec4f,@location(1) b:vec4f}; @group(0) @binding(0) var previous:texture_2d<f32>; @fragment fn main(@builtin(position) p:vec4f)->O {var o:O; o.a=vec4f(textureLoad(previous,vec2i(p.xy),0).x+0.1,0.2,0.3,1);o.b=vec4f(0.1,0,0,1);return o;}",
        ["rgba8unorm", "rgba8unorm"],
        4,
        true,
      );
      const present = await prepare(
        "@group(0) @binding(0) var a:texture_2d<f32>; @group(0) @binding(1) var b:texture_2d<f32>; @fragment fn main(@builtin(position) p:vec4f)->@location(0) vec4f {return vec4f(textureLoad(a,vec2i(p.xy),0).rgb+textureLoad(b,vec2i(p.xy),0).rgb,1);}",
        [app.sceneRenderFormat],
        app.msaa.sampleCount,
        false,
      );
      const bind = (pipeline, refs, ctx) =>
        device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: refs.map((handle, binding) => ({
            binding,
            resource: ctx.view(handle),
          })),
        });
      app.addRenderPass({
        name: "mrt-history",
        reads: ["history@previous"],
        writes: [
          {
            handle: "msaa-a",
            attachment: "clear",
            resolveTarget: "history@current",
          },
          { handle: "msaa-b", attachment: "clear", resolveTarget: "resolved" },
          { handle: "custom-depth", attachment: "clear" },
        ],
        encode(ctx) {
          ctx.setPipeline(mrt);
          ctx.setBindGroup(0, bind(mrt, ["history@previous"], ctx));
          ctx.draw(3);
        },
      });
      app.addRenderPass({
        name: "present-mrt",
        reads: ["history@current", "resolved"],
        writes: ["scene-color"],
        after: "mrt-history",
        encode(ctx) {
          ctx.setPipeline(present);
          ctx.setBindGroup(
            0,
            bind(present, ["history@current", "resolved"], ctx),
          );
          ctx.draw(3);
        },
      });
      const pixels = [];
      for (let index = 0; index < 2; index++) {
        const report = await app.renderSnapshot(
          renderSnapshotFromJsonValue({
            ...bundle.snapshot.value,
            frame: index + 1,
          }),
        );
        assert.equal(report.ok, true, JSON.stringify(report.diagnostics));
        pixels.push([...(await output.readRgba()).slice(0, 4)]);
      }
      assert.ok(pixels[1][0] > pixels[0][0] + 8, JSON.stringify(pixels));
      assert.ok(Math.abs(pixels[0][1] - pixels[1][1]) <= 2);
      if (!post)
        assert.deepEqual(pixels, [
          [52, 51, 76, 255],
          [78, 51, 76, 255],
        ]);
      await app.resetGpuHistory();
      let replay = await app.renderSnapshot(
        renderSnapshotFromJsonValue({ ...bundle.snapshot.value, frame: 3 }),
      );
      assert.equal(replay.ok, true, JSON.stringify(replay.diagnostics));
      assert.deepEqual([...(await output.readRgba()).slice(0, 4)], pixels[0]);
      output.resize(81, 39);
      replay = await app.renderSnapshot(
        renderSnapshotFromJsonValue({ ...bundle.snapshot.value, frame: 4 }),
      );
      assert.equal(replay.ok, true, JSON.stringify(replay.diagnostics));
      assert.deepEqual([...(await output.readRgba()).slice(0, 4)], pixels[0]);
      native.assertHealthy();
    } finally {
      await rendered?.app.dispose();
      await output.dispose();
    }
  });
