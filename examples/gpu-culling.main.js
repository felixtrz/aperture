import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { configureApertureExampleControl } from "./example-control.js";
import {
  CULL_ARGS_BUFFER_ID,
  CULL_INSTANCE_BUFFER_ID,
  CULL_INSTANCE_COUNT,
  cullComputeWgsl,
  cullDrawWgsl,
  expectedVisibleCount,
  gpuCullingClearColor,
} from "./gpu-culling-scene.js";

// C2 (three.js parity plan): the main-thread half of GPU-driven culling. It
// registers a COMPUTE pass that culls + writes the survivor count into the
// indirect-argument buffer, and a RENDER pass that consumes it with a single
// ctx.drawIndirect(...). The drawn instance count is GPU-authoritative — it
// surfaces in the frame report via report.userIndirectDraws.drawnInstanceCount
// (read back off the argument buffer), and the e2e asserts that lowering the
// cull threshold reduces it. The render pass is ordered AFTER the compute pass
// (after: "gpu-cull"), so it draws the same frame's survivors.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: gpuCullingClearColor,
    // The indirect-draw pipeline below is single-sampled; opt out of MSAA so it
    // matches the forward route's color/depth attachment sample count.
    sampleCount: 1,
  },
});

// A high threshold keeps every instance visible; lowering it culls the ones to
// the right. The e2e drives this through the hook below.
let cullThreshold = 1.5;
let passesRegistered = false;

configureApertureExampleControl({ getStatus: () => gpuCullingStatus() });
requestAnimationFrame(function publish() {
  gpuCullingStatus();
  requestAnimationFrame(publish);
});

try {
  const app = await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/gpu-culling.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/gpu-culling.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });

  if (app.webgpu.ok) {
    registerGpuCullingPasses(app, app.webgpu.app.initialization.device);
  }
} catch (error) {
  publishStatus({
    example: "gpu-culling",
    ok: false,
    state: "failed",
    reason: "gpu-culling-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "GPU culling example failed to start.",
  });
}

function registerGpuCullingPasses(app, device) {
  const usage = globalThis.GPUBufferUsage ?? { UNIFORM: 0x40, COPY_DST: 0x08 };

  const computeModule = device.createShaderModule({
    label: "gpu-culling/compute",
    code: cullComputeWgsl,
  });
  const computePipeline = device.createComputePipeline({
    label: "gpu-culling/compute/pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "main" },
  });

  const drawModule = device.createShaderModule({
    label: "gpu-culling/draw",
    code: cullDrawWgsl,
  });
  const drawPipeline = device.createRenderPipeline({
    label: "gpu-culling/draw/pipeline",
    layout: "auto",
    vertex: { module: drawModule, entryPoint: "vs" },
    fragment: {
      module: drawModule,
      entryPoint: "fs",
      targets: [{ format: app.webgpu.app.sceneRenderFormat }],
    },
    primitive: { topology: "triangle-list" },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "always",
    },
  });

  // Fixed-size params uniform: (cullThreshold f32, count u32, pad, pad). A user
  // pass's encode(ctx) runs when the frame graph is (re)built and its recorded
  // commands are REPLAYED on subsequent frames (like boids' compute), so a CPU
  // side effect inside encode would only run once. The threshold is a live CPU
  // input, so we upload it every animation frame instead: the replayed compute
  // dispatch reads the buffer's current contents each frame.
  const params = device.createBuffer({
    label: "gpu-culling/compute/params",
    size: 16,
    usage: usage.UNIFORM | usage.COPY_DST,
  });
  const paramsBytes = new ArrayBuffer(16);
  const paramsView = new DataView(paramsBytes);
  const uploadParams = () => {
    paramsView.setFloat32(0, cullThreshold, true);
    paramsView.setUint32(4, CULL_INSTANCE_COUNT, true);
    device.queue.writeBuffer(params, 0, paramsBytes);
  };
  uploadParams();
  requestAnimationFrame(function pumpParams() {
    uploadParams();
    requestAnimationFrame(pumpParams);
  });

  app.addComputePass({
    name: "gpu-cull",
    writes: [
      { handle: CULL_ARGS_BUFFER_ID },
      { handle: CULL_INSTANCE_BUFFER_ID },
    ],
    encode(ctx) {
      const args = ctx.buffer(CULL_ARGS_BUFFER_ID);
      const instances = ctx.buffer(CULL_INSTANCE_BUFFER_ID);
      if (!args || !instances) {
        return;
      }
      const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: params } },
          { binding: 1, resource: { buffer: args } },
          { binding: 2, resource: { buffer: instances } },
        ],
      });
      ctx.setComputePipeline(computePipeline);
      ctx.setBindGroup(0, bindGroup);
      ctx.dispatchWorkgroups(1);
    },
  });

  app.addRenderPass({
    name: "gpu-cull-draw",
    // Ordered after the compute pass that fills the buffers this draw consumes.
    after: "gpu-cull",
    reads: [CULL_ARGS_BUFFER_ID, CULL_INSTANCE_BUFFER_ID],
    writes: [{ handle: "scene-color", attachment: "load" }],
    encode(ctx) {
      const args = ctx.buffer(CULL_ARGS_BUFFER_ID);
      const instances = ctx.buffer(CULL_INSTANCE_BUFFER_ID);
      if (!args || !instances) {
        return;
      }
      const bindGroup = device.createBindGroup({
        layout: drawPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: instances } }],
      });
      ctx.setPipeline(drawPipeline);
      ctx.setBindGroup(0, bindGroup);
      // GPU-driven: vertex + instance counts come from the argument buffer the
      // compute pass wrote — the CPU never sets the drawn instance count.
      ctx.drawIndirect(args, 0);
    },
  });

  passesRegistered = true;

  // The e2e drives the cull threshold to prove the GPU-computed drawn count
  // reduces when instances are culled.
  globalThis.__APERTURE_GPU_CULLING__ = {
    instanceCount: CULL_INSTANCE_COUNT,
    setCullThreshold(value) {
      cullThreshold = value;
    },
    expectedVisibleCount: (threshold) => expectedVisibleCount(threshold),
  };
}

function gpuCullingStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const lastFrame = generated?.diagnostics?.lastFrame ?? null;
  const renderTarget = lastFrame?.renderTargets?.[0] ?? null;
  const graph = renderTarget?.graph ?? null;
  const userPasses = graph?.userPasses ?? [];
  const compute = userPasses.find((pass) => pass.name === "gpu-cull") ?? null;
  const draw = userPasses.find((pass) => pass.name === "gpu-cull-draw") ?? null;
  const userIndirectDraws = lastFrame?.userIndirectDraws ?? null;
  const drawnInstanceCount =
    userIndirectDraws?.drawnInstanceCount ??
    draw?.indirectDraws?.drawnInstanceCount ??
    null;

  const status = {
    example: "gpu-culling",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      passesRegistered &&
      compute?.ran === true &&
      draw?.ran === true &&
      userIndirectDraws?.status === "readback" &&
      typeof drawnInstanceCount === "number",
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    passesRegistered,
    instanceCount: CULL_INSTANCE_COUNT,
    cullThreshold,
    computeRan: compute?.ran ?? false,
    drawRan: draw?.ran ?? false,
    indirectStatus: userIndirectDraws?.status ?? null,
    indirectDrawCount: userIndirectDraws?.indirectDraws ?? 0,
    drawnInstanceCount,
    fallbackReasons: userIndirectDraws?.fallbackReasons ?? [],
    frame: lastFrame?.frame ?? null,
    frameOk: lastFrame?.ok ?? null,
    diagnosticsCount: lastFrame?.counts?.diagnostics ?? 0,
  };

  publishStatus(status);
  return status;
}

function webGpuFailureReason(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }
  return typeof generated.diagnostics?.reason === "string"
    ? generated.diagnostics.reason
    : "webgpu-failed";
}

function webGpuFailureMessage(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }
  return typeof generated.diagnostics?.message === "string"
    ? generated.diagnostics.message
    : "WebGPU initialization failed.";
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "running" : status.state;
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
