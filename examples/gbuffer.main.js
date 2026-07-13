import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  gbufferCanvasSize,
  gbufferFrameCount,
  gbufferSamplePoints,
  gbufferTargetSize,
  registerGBufferScene,
} from "./gbuffer-scene.js";

// B3 capstone example: a custom G-buffer. Three boxes render through ONE
// custom WGSL material declaring THREE color targets (colorTargets — MRT):
// albedo into the camera-paired facade render target at @location(0), world
// normal and a quantized object-ID band into two more facade targets at
// @location(1..2). A user render pass (app.addRenderPass) then reads all
// three targets and resolves them into scene color as three vertical bands
// (albedo | normal | id), all inside the single-encoder forward FrameGraph.

const canvas = document.querySelector("#gbuffer-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "gbuffer",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

let activeRuntime = null;
window.__APERTURE_GBUFFER_STOP__ = disposeActiveRuntime;

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
      "gbuffer-failed",
      error instanceof Error ? error.message : "Example failed.",
    ),
  );
}

async function run(aperture, targetCanvas) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerGBufferScene(aperture, sourceAssets);
  const readbackUsage = aperture.createReadbackCanvasTextureUsage();

  const created = await aperture.createWebGpuApp({
    canvas: targetCanvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
    useFrameGraph: true,
    ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
  });

  if (!created.ok) {
    publishStatus(failure(created.reason, created.message));
    return;
  }

  const device = created.app.initialization.device;
  const resolve = createResolvePipeline(
    device,
    created.app.initialization.format,
    gbufferCanvasSize,
    gbufferTargetSize,
  );
  const encodeSkips = { count: 0 };

  // app.addRenderPass — the G-buffer resolve: reads the three facade targets
  // and writes scene-color as three vertical bands. Declared reads order the
  // pass after the G-buffer camera node inside the forward graph.
  created.app.addRenderPass({
    name: "gbuffer-resolve",
    reads: ["gbuffer.albedo", "gbuffer.normal", "gbuffer.id"],
    writes: [{ handle: "scene-color", attachment: "load" }],
    encode(ctx) {
      const albedo = ctx.view("gbuffer.albedo");
      const normal = ctx.view("gbuffer.normal");
      const id = ctx.view("gbuffer.id");

      if (!albedo || !normal || !id) {
        encodeSkips.count += 1;
        return;
      }

      const bindGroup = device.createBindGroup({
        layout: resolve.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: albedo },
          { binding: 1, resource: normal },
          { binding: 2, resource: id },
        ],
      });
      ctx.setPipeline(resolve.pipeline);
      ctx.setBindGroup(0, bindGroup);
      ctx.draw(3);
    },
  });

  activeRuntime = { app: created.app, worker: null };
  startWorkerLoop(aperture, created.app, scene, encodeSkips);
}

function startWorkerLoop(aperture, app, scene, encodeSkips) {
  const worker = new Worker("/worker-modules/examples/gbuffer.worker.js", {
    name: "aperture-gbuffer",
    type: "module",
  });
  activeRuntime.worker = worker;

  const loop = { received: 0, report: null };

  worker.addEventListener("message", (event) => {
    void onMessage(event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(failure("worker-error", event.message || "Worker error."));
    worker.terminate();
  });
  worker.postMessage({ type: "init", canvas: gbufferCanvasSize });

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
    const frame = message.frame ?? 1;
    try {
      loop.report = await app.renderSnapshot(message.snapshot, {
        frame,
        clearColor,
        label: "gbuffer",
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

    if (frame < gbufferFrameCount) {
      worker.postMessage({ type: "frame", frame: frame + 1 });
      return;
    }

    publishStatus(createStatus(loop.report, loop.received, encodeSkips));
    worker.terminate();
  }
}

function createStatus(report, received, encodeSkips) {
  const renderTargets = report?.renderTargets ?? [];
  const graph = renderTargets.find((target) => target.graph)?.graph ?? null;
  const order = graph?.order ?? [];
  const resolvePass =
    graph?.userPasses?.find((pass) => pass.name === "gbuffer-resolve") ?? null;
  const gbufferIndex = order.findIndex((name) =>
    name.includes("render-target:gbuffer.albedo"),
  );
  const resolveIndex = order.indexOf("gbuffer-resolve");

  return {
    ...baseStatus,
    ok:
      report?.ok === true &&
      graph !== null &&
      resolvePass?.ran === true &&
      resolvePass.executedCommands > 0 &&
      gbufferIndex >= 0 &&
      resolveIndex > gbufferIndex &&
      encodeSkips.count === 0,
    phase: "submit",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    graph: {
      order,
      userPasses: graph?.userPasses ?? [],
    },
    renderTargets: renderTargets.map((target) => ({
      renderTargetKey: target.renderTargetKey,
      source: target.source,
      ok: target.ok,
      drawCalls: target.drawCalls,
    })),
    // Normalized canvas points the e2e spec samples from a screenshot.
    samplePoints: gbufferSamplePoints,
    encodeSkips: encodeSkips.count,
    frames: received,
    diagnostics: report?.diagnostics?.length ?? 0,
  };
}

// The resolve pipeline: a full-screen triangle whose fragment stage splits
// the canvas into three vertical bands and textureLoads the matching
// G-buffer texture (band-local x remapped onto the full texture).
function createResolvePipeline(device, colorFormat, canvasSize, targetSize) {
  const module = device.createShaderModule({
    label: "gbuffer/resolve",
    code: /* wgsl */ `
@group(0) @binding(0) var albedoTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var idTexture: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(-1.0, 1.0),
    vec2f(3.0, 1.0),
  );
  return vec4f(positions[vertexIndex], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let uv = position.xy / vec2f(${canvasSize.width}.0, ${canvasSize.height}.0);
  let band = min(u32(uv.x * 3.0), 2u);
  let localU = fract(uv.x * 3.0);
  let texel = vec2i(
    clamp(
      vec2f(localU, uv.y) * ${targetSize}.0,
      vec2f(0.0),
      vec2f(${targetSize}.0 - 1.0),
    ),
  );

  if (band == 0u) {
    return textureLoad(albedoTexture, texel, 0);
  }
  if (band == 1u) {
    return textureLoad(normalTexture, texel, 0);
  }
  return textureLoad(idTexture, texel, 0);
}
`,
  });
  return {
    pipeline: device.createRenderPipeline({
      label: "gbuffer/resolve/pipeline",
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
        depthCompare: "always",
      },
    }),
  };
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
