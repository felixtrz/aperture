import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  customGraphPassCanvasSize,
  customGraphPassFrameCount,
  registerCustomGraphPassScene,
} from "./custom-graph-pass-scene.js";

// M3-T7 capstone example: register a custom COMPUTE pass (a luminance histogram
// reading the scene-color G-buffer) and a custom depth-tested RENDER overlay
// (drawn over the scene after 'opaque') through the public app.addComputePass /
// app.addRenderPass API. Both run inside the single-encoder FrameGraph post path
// and are reported in report.renderTargets[0].graph.

const HISTOGRAM_BINS = 16;
const canvas = document.querySelector("#custom-graph-pass-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "custom-graph-pass",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_CUSTOM_GRAPH_PASS_STOP__ = disposeActiveRuntime;

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    await run(aperture, canvas);
  }
} catch (error) {
  publishStatus(
    failure(
      "custom-graph-pass-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerCustomGraphPassScene(aperture, sourceAssets);

  const created = await aperture.createWebGpuApp({
    canvas: targetCanvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    useFrameGraph: true,
    postEffects: [
      aperture.createWebGpuCopyPostEffect({
        id: "present",
        label: "Present",
      }),
    ],
  });

  if (!created.ok) {
    publishStatus(failure(created.reason, created.message));
    return;
  }

  const device = created.app.initialization.device;
  const sceneFormat = created.app.sceneRenderFormat;
  const width = customGraphPassCanvasSize.width;
  const height = customGraphPassCanvasSize.height;

  // ---- custom passes: pipelines + resources owned by the example ----
  const overlayPipeline = createOverlayPipeline(device, sceneFormat);
  const histogram = createHistogramResources(device);

  // app.addRenderPass — a depth-tested magenta overlay drawn over the scene.
  created.app.addRenderPass({
    name: "wireframe-overlay",
    after: "opaque",
    reads: ["depth"],
    writes: [{ handle: "scene-color", attachment: "load" }],
    encode(ctx) {
      ctx.setPipeline(overlayPipeline);
      ctx.draw(3);
    },
  });

  // app.addComputePass — a luminance histogram reading the scene-color G-buffer.
  created.app.addComputePass({
    name: "luminance-histogram",
    reads: ["scene-color"],
    writes: [{ handle: "histogram-buffer" }],
    encode(ctx) {
      const bindGroup = device.createBindGroup({
        layout: histogram.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: ctx.view("scene-color") },
          { binding: 1, resource: { buffer: histogram.buffer } },
        ],
      });
      ctx.setComputePipeline(histogram.pipeline);
      ctx.setBindGroup(0, bindGroup);
      ctx.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8), 1);
    },
  });

  activeRuntime = { app: created.app, worker: null };
  startWorkerLoop(aperture, created.app, scene, device, histogram);
}

function startWorkerLoop(aperture, app, scene, device, histogram) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/custom-graph-pass.worker.js",
    {
      name: "aperture-custom-graph-pass",
      type: "module",
    },
  );
  activeRuntime.worker = worker;

  const loop = { received: 0, report: null };

  worker.addEventListener("message", (event) => {
    void onMessage(event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({ type: "init", canvas: customGraphPassCanvasSize });

  async function onMessage(message) {
    if (message?.type === "ready") {
      worker.postMessage({ type: "frame", frame: 1 });
      return;
    }
    if (message?.type === "error") {
      publishStatus(failure(message.reason ?? "worker-error", message.message));
      worker.terminate();
      return;
    }
    if (message?.type !== "snapshot") {
      return;
    }

    loop.received += 1;
    try {
      loop.report = await app.renderSnapshot(message.snapshot, {
        frame: message.frame ?? 1,
        clearColor,
        label: "custom-graph-pass",
      });
    } catch (error) {
      publishStatus(
        failure(
          "render-failed",
          error instanceof Error ? error.message : String(error),
        ),
      );
      worker.terminate();
      return;
    }

    if ((message.frame ?? 1) < customGraphPassFrameCount) {
      worker.postMessage({ type: "frame", frame: (message.frame ?? 1) + 1 });
      return;
    }

    const bins = await readHistogram(device, histogram);
    publishStatus(createStatus(loop.report, bins, loop.received));
    worker.terminate();
  }
}

function createStatus(report, bins, received) {
  const renderTarget = report?.renderTargets?.[0] ?? null;
  const graph = renderTarget?.graph ?? null;
  const userPasses = graph?.userPasses ?? [];
  const compute = userPasses.find(
    (pass) => pass.name === "luminance-histogram",
  );
  const overlay = userPasses.find((pass) => pass.name === "wireframe-overlay");
  const histogramSum = bins.reduce((total, count) => total + count, 0);
  const order = graph?.order ?? [];
  const sceneIndex = order.findIndex((name) => name.endsWith(":scene"));
  const presentIndex = order.findIndex((name) => name.includes(":present"));
  const overlayIndex = order.indexOf("wireframe-overlay");

  return {
    ...baseStatus,
    ok:
      report?.ok === true &&
      graph !== null &&
      compute?.ran === true &&
      compute.executedCommands > 0 &&
      overlay?.ran === true &&
      histogramSum > 0 &&
      sceneIndex >= 0 &&
      overlayIndex > sceneIndex &&
      presentIndex > overlayIndex,
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    graph: {
      order,
      userPasses,
    },
    histogram: {
      bins,
      sum: histogramSum,
    },
    frames: received,
    diagnostics: report?.diagnostics?.length ?? 0,
  };
}

// ---- the overlay render pipeline (depth-tested, draws over the scene) ----
function createOverlayPipeline(device, colorFormat) {
  const module = device.createShaderModule({
    label: "custom-graph-pass/overlay",
    code: /* wgsl */ `
@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 3>(
    vec2f(0.15, -0.15),
    vec2f(0.9, -0.15),
    vec2f(0.525, -0.9),
  );
  return vec4f(positions[vertexIndex], 0.2, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
  return vec4f(0.96, 0.1, 0.86, 1.0);
}
`,
  });
  return device.createRenderPipeline({
    label: "custom-graph-pass/overlay/pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vs" },
    fragment: {
      module,
      entryPoint: "fs",
      targets: [{ format: colorFormat }],
    },
    primitive: { topology: "triangle-list" },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less-equal",
    },
  });
}

// ---- the luminance-histogram compute pipeline + buffers ----
function createHistogramResources(device) {
  const module = device.createShaderModule({
    label: "custom-graph-pass/histogram",
    code: /* wgsl */ `
@group(0) @binding(0) var sceneColor: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>, ${HISTOGRAM_BINS}>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = textureDimensions(sceneColor);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }
  let color = textureLoad(sceneColor, vec2i(i32(gid.x), i32(gid.y)), 0).rgb;
  let luminance = dot(color, vec3f(0.299, 0.587, 0.114));
  let bin = min(u32(luminance * f32(${HISTOGRAM_BINS})), ${HISTOGRAM_BINS - 1}u);
  atomicAdd(&histogram[bin], 1u);
}
`,
  });
  const pipeline = device.createComputePipeline({
    label: "custom-graph-pass/histogram/pipeline",
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });
  const byteLength = HISTOGRAM_BINS * 4;
  const buffer = device.createBuffer({
    label: "custom-graph-pass/histogram/buffer",
    size: byteLength,
    usage: 0x80 /* STORAGE */ | 0x4 /* COPY_SRC */,
  });
  const readback = device.createBuffer({
    label: "custom-graph-pass/histogram/readback",
    size: byteLength,
    usage: 0x1 /* MAP_READ */ | 0x8 /* COPY_DST */,
  });
  return { pipeline, buffer, readback, byteLength };
}

async function readHistogram(device, histogram) {
  const encoder = device.createCommandEncoder({
    label: "custom-graph-pass/histogram/readback",
  });
  encoder.copyBufferToBuffer(
    histogram.buffer,
    0,
    histogram.readback,
    0,
    histogram.byteLength,
  );
  device.queue.submit([encoder.finish()]);
  await histogram.readback.mapAsync(0x1 /* MAP_READ */);
  const bins = Array.from(new Uint32Array(histogram.readback.getMappedRange()));
  histogram.readback.unmap();
  return bins;
}

function disposeActiveRuntime() {
  activeRuntime?.app?.stop?.();
  activeRuntime?.worker?.terminate?.();
  activeRuntime = null;
}

function failure(reason, message) {
  return { ...baseStatus, ok: false, reason, message };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
