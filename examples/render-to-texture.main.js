import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  renderToTextureCenterSample as centerSample,
  renderToTextureOffscreenClearColor as offscreenClearColor,
  renderToTextureOffscreenSize as offscreenSize,
  renderToTexturePlaneColor as planeColor,
  renderToTextureScreenClearColor as screenClearColor,
  renderToTextureScreenClearSample as screenClearSample,
  registerRenderToTextureAssets,
} from "./render-to-texture-assets.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  copyCurrentTextureReadbackSamples,
  createCurrentTextureColorTargetWithTexture,
  mapCurrentTextureReadbackSamples,
} from "./webgpu-readback.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const baseStatus = {
  example: "render-to-texture",
  workerModel: "ecs-extraction-worker-postmessage-snapshot",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
  renderTarget: {
    width: offscreenSize,
    height: offscreenSize,
    source: "ViewPacket.renderTarget",
  },
};

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(
        failure("initialize-webgpu", created.reason, created.message, {
          apertureVersion: aperture.APERTURE_VERSION,
          renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
        }),
      );
    } else {
      const scene = createMainScene(aperture, created.app, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene, readbackUsage);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "render-to-texture",
      "render-to-texture-failed",
      error instanceof Error
        ? error.message
        : "Render-to-texture example failed.",
    ),
  );
}

function createMainScene(aperture, app, sourceAssets) {
  const scene = registerRenderToTextureAssets(aperture, sourceAssets);
  const device = app.initialization.device;
  const format = app.initialization.format;
  const textureUsage = resolveTextureUsage(aperture);
  const offscreenTexture = device.createTexture({
    label: "aperture-render-to-texture-target",
    size: { width: offscreenSize, height: offscreenSize },
    format,
    usage:
      textureUsage.RENDER_ATTACHMENT |
      textureUsage.TEXTURE_BINDING |
      textureUsage.COPY_SRC,
  });

  sourceAssets.register(scene.renderTarget, {
    label: "Render-to-texture target",
  });
  sourceAssets.markReady(
    scene.renderTarget,
    aperture.createWebGpuAppRenderTargetAsset({
      label: "Render-to-texture target",
      texture: offscreenTexture,
      width: offscreenSize,
      height: offscreenSize,
      format,
    }),
  );

  return {
    ...scene,
    format,
    offscreenTexture,
    textureUsage: {
      renderAttachment: true,
      textureBinding: true,
      copySource: true,
    },
  };
}

function startWorkerSnapshotLoop(aperture, app, scene, readbackUsage) {
  const worker = new Worker(
    "/worker-modules/examples/render-to-texture.worker.js",
    {
      name: "aperture-render-to-texture-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      scene,
      readbackUsage,
      worker,
      loop,
      event.data,
    );
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker",
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  readbackUsage,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        "worker",
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const offscreenReport = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor: offscreenClearColor,
    label: "render-to-texture/offscreen",
  });

  if (!offscreenReport.ok) {
    publishStatus(
      failure(
        "offscreen-render",
        "offscreen-render-failed",
        "The ViewPacket render-target pass did not complete.",
        createFailureDetails(
          aperture,
          app,
          scene,
          loop,
          message,
          typedSnapshot,
          offscreenReport,
        ),
      ),
    );
    worker.terminate();
    return;
  }

  const screenPass = await drawRenderTargetTextureToCanvas({
    aperture,
    app,
    texture: scene.offscreenTexture,
    readbackUsage,
  });

  publishStatus(
    screenPass.ok
      ? createStatus(
          aperture,
          app,
          scene,
          loop,
          message,
          typedSnapshot,
          offscreenReport,
          screenPass,
        )
      : failure(
          "screen-pass",
          screenPass.reason,
          screenPass.message,
          createFailureDetails(
            aperture,
            app,
            scene,
            loop,
            message,
            typedSnapshot,
            offscreenReport,
            screenPass,
          ),
        ),
  );
  worker.terminate();
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

async function drawRenderTargetTextureToCanvas({
  aperture,
  app,
  texture,
  readbackUsage,
}) {
  const device = app.initialization.device;
  const context = app.initialization.context;
  const format = app.initialization.format;
  const current = createCurrentTextureColorTargetWithTexture({
    context,
    clearColor: screenClearColor,
  });

  if (!current.ok) {
    return current;
  }

  const textureView = texture.createView();
  const sampler = device.createSampler({
    label: "aperture-render-to-texture-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
  });
  const shader = device.createShaderModule({
    label: "aperture-render-to-texture-screen-shader",
    code: `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) uv: vec2f,
      }

      @group(0) @binding(0) var rttSampler: sampler;
      @group(0) @binding(1) var rttTexture: texture_2d<f32>;

      @vertex
      fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        var positions = array<vec2f, 6>(
          vec2f(-0.62, -0.62),
          vec2f(0.62, -0.62),
          vec2f(0.62, 0.62),
          vec2f(-0.62, -0.62),
          vec2f(0.62, 0.62),
          vec2f(-0.62, 0.62),
        );
        var uvs = array<vec2f, 6>(
          vec2f(0.0, 1.0),
          vec2f(1.0, 1.0),
          vec2f(1.0, 0.0),
          vec2f(0.0, 1.0),
          vec2f(1.0, 0.0),
          vec2f(0.0, 0.0),
        );

        var output: VertexOutput;
        output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
        output.uv = uvs[vertexIndex];
        return output;
      }

      @fragment
      fn fs(input: VertexOutput) -> @location(0) vec4f {
        return textureSample(rttTexture, rttSampler, input.uv);
      }
    `,
  });
  const pipeline = device.createRenderPipeline({
    label: "aperture-render-to-texture-screen-pipeline",
    layout: "auto",
    vertex: { module: shader, entryPoint: "vs" },
    fragment: {
      module: shader,
      entryPoint: "fs",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list" },
  });
  const bindGroup = device.createBindGroup({
    label: "aperture-render-to-texture-screen-bind-group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: textureView },
    ],
  });
  const encoder = device.createCommandEncoder({
    label: "aperture-render-to-texture-screen-encoder",
  });
  const pass = encoder.beginRenderPass({
    label: "aperture-render-to-texture-screen-pass",
    colorAttachments: [
      {
        view: current.target.view,
        clearValue: current.target.clearColor,
        loadOp: current.target.loadOp,
        storeOp: current.target.storeOp,
      },
    ],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6);
  pass.end();

  const readbackPlan = readbackUsage.ok
    ? copyCurrentTextureReadbackSamples({
        device,
        encoder,
        texture: current.texture,
        format,
        width: app.canvas.width,
        height: app.canvas.height,
        samples: [centerSample, screenClearSample],
      })
    : readbackUsage;

  device.queue.submit([encoder.finish()]);
  await waitForSubmittedWork(device);

  const readback = await mapCurrentTextureReadbackSamples(readbackPlan);

  return {
    ok: true,
    phase: "screen-pass",
    format,
    quad: {
      source: "off-screen render target",
      vertexCount: 6,
      widthNdc: 1.24,
      heightNdc: 1.24,
    },
    drawCalls: 1,
    readback: aperture.markReadbackClearOk?.(readback, true) ?? readback,
  };
}

function createStatus(
  aperture,
  app,
  scene,
  loop,
  message,
  typedSnapshot,
  offscreenReport,
  screenPass,
) {
  const report = aperture.webGpuAppRenderReportToJsonValue(offscreenReport);

  return {
    ...baseStatus,
    ok: true,
    phase: "display",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: scene.format,
    clearColors: {
      offscreen: rgbaToStatusColor(offscreenClearColor),
      screen: { ...screenClearColor },
    },
    renderTarget: {
      ...baseStatus.renderTarget,
      key: aperture.assetHandleKey(scene.renderTarget),
      textureUsage: scene.textureUsage,
    },
    sourceView: createSourceViewStatus(aperture, message.snapshot, scene),
    scene: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      materialKind: "unlit",
      expectedCenterColor: rgbaToStatusColor(planeColor),
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    counts: {
      views: offscreenReport.counts.views,
      meshDraws: offscreenReport.counts.meshDraws,
      drawCalls: offscreenReport.counts.drawCalls,
      diagnostics: offscreenReport.counts.diagnostics,
    },
    report,
    screenPass: {
      phase: screenPass.phase,
      format: screenPass.format,
      drawCalls: screenPass.drawCalls,
      quad: screenPass.quad,
      samples: {
        preview: centerSample.id,
        screenClear: screenClearSample.id,
      },
    },
    readback: screenPass.readback,
    renderControl: {
      capabilities: exampleControlCapabilities(),
    },
    canvas: {
      width: app.canvas.width,
      height: app.canvas.height,
    },
  };
}

function createFailureDetails(
  aperture,
  app,
  scene,
  loop,
  message,
  typedSnapshot,
  offscreenReport,
  screenPass = null,
) {
  return {
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: scene?.format ?? app.initialization.format,
    clearColors: {
      offscreen: rgbaToStatusColor(offscreenClearColor),
      screen: { ...screenClearColor },
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    counts: offscreenReport?.counts,
    report:
      offscreenReport === null || offscreenReport === undefined
        ? null
        : aperture.webGpuAppRenderReportToJsonValue(offscreenReport),
    screenPass,
    renderControl: {
      capabilities: exampleControlCapabilities(),
    },
  };
}

function createSourceViewStatus(aperture, snapshot, scene) {
  const expectedRenderTargetKey = aperture.assetHandleKey(scene.renderTarget);
  const view = snapshot?.views?.[0];

  if (view === undefined) {
    return {
      ok: false,
      reason: "source-view-missing",
      expectedRenderTargetKey,
    };
  }

  const renderTargetKey = assetKeyOrNull(aperture, view.renderTarget);

  return {
    ok: true,
    viewId: view.viewId,
    camera: view.camera,
    priority: view.priority,
    layerMask: view.layerMask,
    viewport: Array.from(view.viewport),
    scissor: Array.from(view.scissor),
    clearColor: rgbaToStatusColor(view.clearColor),
    clearDepth: view.clearDepth,
    clearStencil: view.clearStencil,
    renderTargetKey,
    expectedRenderTargetKey,
    renderTargetMatches: renderTargetKey === expectedRenderTargetKey,
  };
}

function assetKeyOrNull(aperture, handle) {
  return handle === null || handle === undefined
    ? null
    : aperture.assetHandleKey(handle);
}

function exampleControlCapabilities() {
  return (
    globalThis.__APERTURE_EXAMPLE_CONTROL__?.capabilities ?? {
      status: true,
      warnings: true,
      screenshot: true,
      pause: false,
      resume: false,
      step: false,
      scenario: false,
      snapshot: true,
      readback: false,
    }
  );
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}

function rgbaToStatusColor(color) {
  return {
    r: statusColorChannel(color[0]),
    g: statusColorChannel(color[1]),
    b: statusColorChannel(color[2]),
    a: statusColorChannel(color[3]),
  };
}

function statusColorChannel(value) {
  return Number(value.toFixed(6));
}

async function waitForSubmittedWork(device) {
  if (typeof device.queue?.onSubmittedWorkDone === "function") {
    await device.queue.onSubmittedWorkDone();
  }
}

function failure(phase, reason, message, extra = {}) {
  return {
    ...baseStatus,
    ...extra,
    ok: false,
    phase,
    reason,
    message,
  };
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
