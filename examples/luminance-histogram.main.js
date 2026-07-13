import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { createComputeKernelAsset } from "@aperture-engine/render";
import { createBufferHandle } from "@aperture-engine/simulation";
import { configureApertureExampleControl } from "./example-control.js";
import {
  HISTOGRAM_BIN_COUNT,
  HISTOGRAM_INPUT_BUFFER_ID,
  HISTOGRAM_KERNEL_OUTPUT_BUFFER_ID,
  HISTOGRAM_PIXEL_COUNT,
  HISTOGRAM_RAW_OUTPUT_BUFFER_ID,
  expectedHistogram,
  histogramComputeWgsl,
  luminanceHistogramClearColor,
} from "./luminance-histogram-scene.js";

// C3 (three.js parity plan): the main-thread half of the luminance histogram. It
// dispatches the SAME kernel two ways:
//   1. RAW — app.addComputePass with a hand-built compute pipeline + bind group
//      (the user touches GPUDevice directly). Full control, more surface area.
//   2. DATA-DESCRIBED — app.addComputeKernelPass with a ComputeKernelAsset (WGSL
//      + typed bindings); the engine builds the pipeline + bind group from data.
//      The user touches NO GPUDevice API.
// Both write their own storage buffer; the readback hook compares the two — the
// e2e asserts they are byte-identical.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: luminanceHistogramClearColor,
  },
});

let device = null;
let rawOutputBuffer = null;
let kernelOutputBuffer = null;
let passesRegistered = false;
let lastReadback = null;

configureApertureExampleControl({ getStatus: () => histogramStatus() });
requestAnimationFrame(function publish() {
  histogramStatus();
  requestAnimationFrame(publish);
});

try {
  const app = await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/luminance-histogram.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/luminance-histogram.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });

  if (app.webgpu.ok) {
    device = app.webgpu.app.initialization.device;
    registerHistogramPasses(app, device);
  }
} catch (error) {
  publishStatus({
    example: "luminance-histogram",
    ok: false,
    state: "failed",
    reason: "luminance-histogram-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Luminance histogram example failed to start.",
  });
}

function registerHistogramPasses(app, gpuDevice) {
  const usage = globalThis.GPUBufferUsage ?? { UNIFORM: 0x40, COPY_DST: 0x08 };

  // --- RAW path: a hand-built compute pipeline + params uniform. ---
  const rawModule = gpuDevice.createShaderModule({
    label: "luminance-histogram/raw",
    code: histogramComputeWgsl,
  });
  const rawPipeline = gpuDevice.createComputePipeline({
    label: "luminance-histogram/raw/pipeline",
    layout: "auto",
    compute: { module: rawModule, entryPoint: "main" },
  });
  const rawParams = gpuDevice.createBuffer({
    label: "luminance-histogram/raw/params",
    size: 16,
    usage: usage.UNIFORM | usage.COPY_DST,
  });
  const paramsBytes = new ArrayBuffer(16);
  const paramsView = new DataView(paramsBytes);
  paramsView.setUint32(0, HISTOGRAM_PIXEL_COUNT, true);
  paramsView.setUint32(4, HISTOGRAM_BIN_COUNT, true);
  gpuDevice.queue.writeBuffer(rawParams, 0, paramsBytes);

  app.addComputePass({
    name: "histogram-raw",
    writes: [{ handle: HISTOGRAM_RAW_OUTPUT_BUFFER_ID }],
    encode(ctx) {
      const pixels = ctx.buffer(HISTOGRAM_INPUT_BUFFER_ID);
      const output = ctx.buffer(HISTOGRAM_RAW_OUTPUT_BUFFER_ID);
      // Capture the engine-realized output buffers (shared cache) for readback —
      // the kernel path's output is realized by the engine, so grab it here too.
      rawOutputBuffer = output;
      kernelOutputBuffer = ctx.buffer(HISTOGRAM_KERNEL_OUTPUT_BUFFER_ID);
      if (!pixels || !output) {
        return;
      }
      const bindGroup = gpuDevice.createBindGroup({
        layout: rawPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: pixels } },
          { binding: 1, resource: { buffer: output } },
          { binding: 2, resource: { buffer: rawParams } },
        ],
      });
      ctx.setComputePipeline(rawPipeline);
      ctx.setBindGroup(0, bindGroup);
      ctx.dispatchWorkgroups(1);
    },
  });

  // --- DATA-DESCRIBED path: a ComputeKernelAsset. No GPUDevice code. ---
  const kernel = createComputeKernelAsset({
    label: "Luminance Histogram",
    shader: { kind: "inline-wgsl", code: histogramComputeWgsl },
    entryPoint: "main",
    bindings: [
      {
        name: "pixels",
        binding: 0,
        kind: "storage-buffer",
        visibility: ["compute"],
        buffer: createBufferHandle(HISTOGRAM_INPUT_BUFFER_ID),
      },
      {
        name: "histogram",
        binding: 1,
        kind: "storage-buffer",
        visibility: ["compute"],
        buffer: createBufferHandle(HISTOGRAM_KERNEL_OUTPUT_BUFFER_ID),
      },
      {
        name: "params",
        binding: 2,
        kind: "uniform-buffer",
        visibility: ["compute"],
        fields: {
          pixelCount: { type: "uint32" },
          binCount: { type: "uint32" },
        },
        values: {
          pixelCount: HISTOGRAM_PIXEL_COUNT,
          binCount: HISTOGRAM_BIN_COUNT,
        },
      },
    ],
  });

  // The kernel's writable storage output is auto-declared as a pass write.
  app.addComputeKernelPass({
    name: "histogram-kernel",
    kernel,
    workgroups: 1,
  });

  passesRegistered = true;

  globalThis.__APERTURE_HISTOGRAM__ = {
    binCount: HISTOGRAM_BIN_COUNT,
    expected: expectedHistogram(),
    async readback() {
      const raw = await readbackBins(rawOutputBuffer);
      const kernel = await readbackBins(kernelOutputBuffer);
      const identical =
        raw !== null &&
        kernel !== null &&
        raw.length === kernel.length &&
        raw.every((value, index) => value === kernel[index]);
      lastReadback = { raw, kernel, identical };
      histogramStatus();
      return lastReadback;
    },
  };
}

async function readbackBins(buffer) {
  if (buffer === null || device === null) {
    return null;
  }
  const usage = globalThis.GPUBufferUsage ?? { MAP_READ: 0x01, COPY_DST: 0x08 };
  const mapMode = globalThis.GPUMapMode ?? { READ: 0x01 };
  const byteLength = HISTOGRAM_BIN_COUNT * 4;
  const readback = device.createBuffer({
    label: "luminance-histogram/readback",
    size: byteLength,
    usage: usage.MAP_READ | usage.COPY_DST,
  });
  const encoder = device.createCommandEncoder({
    label: "luminance-histogram/readback",
  });
  encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength);
  device.queue.submit([encoder.finish()]);
  await readback.mapAsync(mapMode.READ);
  const bins = Array.from(new Uint32Array(readback.getMappedRange().slice(0)));
  readback.unmap();
  readback.destroy();
  return bins;
}

function histogramStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const lastFrame = generated?.diagnostics?.lastFrame ?? null;
  const renderTarget = lastFrame?.renderTargets?.[0] ?? null;
  const userPasses = renderTarget?.graph?.userPasses ?? [];
  const raw = userPasses.find((pass) => pass.name === "histogram-raw") ?? null;
  const kernel =
    userPasses.find((pass) => pass.name === "histogram-kernel") ?? null;

  const status = {
    example: "luminance-histogram",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      passesRegistered &&
      raw?.ran === true &&
      kernel?.ran === true,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    passesRegistered,
    pixelCount: HISTOGRAM_PIXEL_COUNT,
    binCount: HISTOGRAM_BIN_COUNT,
    rawRan: raw?.ran ?? false,
    kernelRan: kernel?.ran ?? false,
    rawExecutedCommands: raw?.executedCommands ?? 0,
    kernelExecutedCommands: kernel?.executedCommands ?? 0,
    readbackIdentical: lastReadback?.identical ?? null,
    rawHistogram: lastReadback?.raw ?? null,
    kernelHistogram: lastReadback?.kernel ?? null,
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
