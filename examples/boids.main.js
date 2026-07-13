import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { configureApertureExampleControl } from "./example-control.js";
import {
  BOID_BUFFER_ID,
  BOID_COUNT,
  BOID_STEP_SECONDS,
  BOID_WORKGROUP_SIZE,
  boidsClearColor,
  boidsComputeWgsl,
} from "./boids-scene.js";

// C1 (three.js parity plan): the main-thread half of GPU boids. It boots the
// generated browser app against the worker (boids.worker.js) and registers a
// COMPUTE pass through app.addComputePass. The pass declares it WRITES the
// flock buffer id; ctx.buffer(id) resolves the EXACT realized GPU buffer the
// worker's material.storage binding + instance stream consume, so the compute
// integrates positions and the same-frame instanced draw renders them with zero
// CPU copies. The frame graph orders compute-before-draw from the writer/reader
// edge on the buffer id.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: boidsClearColor,
  },
});

let device = null;
let positionsBuffer = null;
let computeRegistered = false;

configureApertureExampleControl({
  getStatus: () => boidsStatus(),
});
requestAnimationFrame(function publishBoidsStatus() {
  boidsStatus();
  requestAnimationFrame(publishBoidsStatus);
});

try {
  const app = await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/boids.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/boids.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });

  if (app.webgpu.ok) {
    device = app.webgpu.app.initialization.device;
    registerBoidsComputePass(app, device);
  }
} catch (error) {
  publishStatus({
    example: "boids",
    ok: false,
    state: "failed",
    reason: "boids-start-failed",
    message:
      error instanceof Error ? error.message : "Boids example failed to start.",
  });
}

function registerBoidsComputePass(app, gpuDevice) {
  const bufferUsage = globalThis.GPUBufferUsage ?? {
    UNIFORM: 0x40,
    COPY_DST: 0x08,
  };
  const module = gpuDevice.createShaderModule({
    label: "boids/compute",
    code: boidsComputeWgsl,
  });
  const pipeline = gpuDevice.createComputePipeline({
    label: "boids/compute/pipeline",
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  // Fixed sim params (count + step). Written once — the schedule is reproducible.
  const params = gpuDevice.createBuffer({
    label: "boids/compute/params",
    size: 16,
    usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
  });
  const paramsBytes = new ArrayBuffer(16);
  const paramsView = new DataView(paramsBytes);
  paramsView.setUint32(0, BOID_COUNT, true);
  paramsView.setFloat32(4, BOID_STEP_SECONDS, true);
  gpuDevice.queue.writeBuffer(params, 0, paramsBytes);

  const workgroups = Math.ceil(BOID_COUNT / BOID_WORKGROUP_SIZE);

  app.addComputePass({
    name: "boids-sim",
    // Declares the write so the scene draw (which reads the same id) is ordered
    // AFTER this pass — compute-before-draw, guaranteed by the frame graph.
    writes: [{ handle: BOID_BUFFER_ID }],
    encode(ctx) {
      const boids = ctx.buffer(BOID_BUFFER_ID);
      if (boids === undefined || boids === null) {
        return;
      }
      positionsBuffer = boids;
      const bindGroup = gpuDevice.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: boids } },
          { binding: 1, resource: { buffer: params } },
        ],
      });
      ctx.setComputePipeline(pipeline);
      ctx.setBindGroup(0, bindGroup);
      ctx.dispatchWorkgroups(workgroups);
    },
  });
  computeRegistered = true;

  // Motion-readback hook for the e2e: copy the realized flock buffer to a
  // MAP_READ buffer and sample a few positions. Proves the GPU actually moved
  // the boids between two frames (zero CPU writes to these positions).
  globalThis.__APERTURE_BOIDS__ = {
    bufferId: BOID_BUFFER_ID,
    count: BOID_COUNT,
    async readbackPositions(sampleCount = 8) {
      if (positionsBuffer === null || device === null) {
        return null;
      }
      const usage = globalThis.GPUBufferUsage ?? {
        MAP_READ: 0x01,
        COPY_DST: 0x08,
      };
      const mapMode = globalThis.GPUMapMode ?? { READ: 0x01 };
      const byteLength = BOID_COUNT * 16;
      const readback = device.createBuffer({
        label: "boids/readback",
        size: byteLength,
        usage: usage.MAP_READ | usage.COPY_DST,
      });
      const encoder = device.createCommandEncoder({ label: "boids/readback" });
      encoder.copyBufferToBuffer(positionsBuffer, 0, readback, 0, byteLength);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(mapMode.READ);
      const floats = new Float32Array(readback.getMappedRange().slice(0));
      readback.unmap();
      readback.destroy();
      const samples = [];
      const n = Math.min(sampleCount, BOID_COUNT);
      for (let index = 0; index < n; index += 1) {
        samples.push([floats[index * 4], floats[index * 4 + 1]]);
      }
      return samples;
    },
  };
}

function boidsStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const diagnostics = generated?.diagnostics ?? null;
  const lastFrame = diagnostics?.lastFrame ?? null;
  const counts = lastFrame?.counts ?? null;
  const meshDraws = counts?.meshDraws ?? 0;
  const drawCalls = counts?.drawCalls ?? 0;
  const renderTarget = lastFrame?.renderTargets?.[0] ?? null;
  const graph = renderTarget?.graph ?? null;
  const order = graph?.order ?? [];
  const userPasses = graph?.userPasses ?? [];
  const compute = userPasses.find((pass) => pass.name === "boids-sim") ?? null;
  const computeIndex = order.indexOf("boids-sim");
  const sceneIndex = order.findIndex((name) => name.includes(":fg:"));
  const computeBeforeDraw =
    computeIndex >= 0 && sceneIndex >= 0 && computeIndex < sceneIndex;

  const status = {
    example: "boids",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      computeRegistered &&
      meshDraws === BOID_COUNT &&
      drawCalls > 0 &&
      drawCalls < BOID_COUNT &&
      compute?.ran === true &&
      compute.executedCommands > 0 &&
      computeBeforeDraw,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    boidCount: BOID_COUNT,
    meshDraws,
    drawCalls,
    computeRegistered,
    computeRan: compute?.ran ?? false,
    computeExecutedCommands: compute?.executedCommands ?? 0,
    computeBeforeDraw,
    order,
    frame: lastFrame?.frame ?? null,
    frameOk: lastFrame?.ok ?? null,
    snapshots: generated?.snapshots ?? 0,
    diagnosticsCount: counts?.diagnostics ?? 0,
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
