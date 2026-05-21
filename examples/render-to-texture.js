import {
  copyCurrentTextureReadbackSamples,
  createCurrentTextureColorTargetWithTexture,
  mapCurrentTextureReadbackSamples,
} from "./webgpu-readback.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const offscreenSize = 256;
const offscreenClearColor = [0.02, 0.035, 0.07, 1];
const screenClearColor = { r: 0.015, g: 0.018, b: 0.023, a: 1 };
const planeColor = [0.06, 0.88, 0.22, 1];
const centerSample = { id: "quad-center", x: 0.5, y: 0.5 };

const baseStatus = {
  example: "render-to-texture",
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
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 8 },
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
      const scene = createScene(aperture, created.app);
      const offscreenReport = await created.app.render({
        frame: 1,
        clearColor: offscreenClearColor,
        label: "render-to-texture/offscreen",
      });

      if (!offscreenReport.ok) {
        publishStatus(
          failure(
            "offscreen-render",
            "offscreen-render-failed",
            "The ViewPacket render-target pass did not complete.",
            createFailureDetails(aperture, created.app, scene, offscreenReport),
          ),
        );
      } else {
        const screenPass = await drawRenderTargetTextureToCanvas({
          aperture,
          app: created.app,
          texture: scene.offscreenTexture,
          readbackUsage,
        });

        publishStatus(
          screenPass.ok
            ? createStatus(
                aperture,
                created.app,
                scene,
                offscreenReport,
                screenPass,
              )
            : failure(
                "screen-pass",
                screenPass.reason,
                screenPass.message,
                createFailureDetails(
                  aperture,
                  created.app,
                  scene,
                  offscreenReport,
                  screenPass,
                ),
              ),
        );
      }
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

function createScene(aperture, app) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
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
  const renderTarget = aperture.createRenderTargetHandle(
    "render-to-texture-offscreen",
  );
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "RenderToTexturePlane",
      width: 2.2,
      height: 2.2,
    }),
    { id: "render-to-texture-plane" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "RenderToTextureGreen",
      baseColorFactor: new Float32Array(planeColor),
    }),
    { id: "render-to-texture-green" },
  );

  app.assets.register(renderTarget, { label: "Render-to-texture target" });
  app.assets.markReady(
    renderTarget,
    aperture.createWebGpuAppRenderTargetAsset({
      label: "Render-to-texture target",
      texture: offscreenTexture,
      width: offscreenSize,
      height: offscreenSize,
      format,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3] }),
    aperture.withCamera({
      aspect: 1,
      near: 0.1,
      far: 100,
      priority: 0,
      layerMask: 1,
      clearColor: offscreenClearColor,
      renderTargetId: aperture.assetHandleKey(renderTarget),
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    format,
    mesh,
    material,
    renderTarget,
    offscreenTexture,
    textureUsage: {
      renderAttachment: true,
      textureBinding: true,
      copySource: true,
    },
  };
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
        samples: [centerSample],
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
    readback: aperture.markReadbackClearOk?.(readback, true) ?? readback,
  };
}

function createStatus(aperture, app, scene, offscreenReport, screenPass) {
  const report = aperture.webGpuAppRenderReportToJsonValue(offscreenReport);

  return {
    ...baseStatus,
    ok: true,
    phase: "display",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: scene.format,
    renderTarget: {
      ...baseStatus.renderTarget,
      key: aperture.assetHandleKey(scene.renderTarget),
      textureUsage: scene.textureUsage,
    },
    scene: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      materialKind: "unlit",
      expectedCenterColor: rgbaToStatusColor(planeColor),
    },
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
      quad: screenPass.quad,
    },
    readback: screenPass.readback,
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
  offscreenReport,
  screenPass = null,
) {
  return {
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: scene?.format ?? app.initialization.format,
    counts: offscreenReport?.counts,
    report:
      offscreenReport === null || offscreenReport === undefined
        ? null
        : aperture.webGpuAppRenderReportToJsonValue(offscreenReport),
    screenPass,
  };
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}

function rgbaToStatusColor(color) {
  return {
    r: color[0],
    g: color[1],
    b: color[2],
    a: color[3],
  };
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
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
