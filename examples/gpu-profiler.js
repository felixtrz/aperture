import { createExampleWebGpuApp } from "./example-renderer-app.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const overlayFrameElement = document.querySelector("#gpu-profiler-frame");
const overlayPassListElement = document.querySelector(
  "#gpu-profiler-pass-list",
);

const clearColor = [0.014, 0.018, 0.024, 1];
const offscreenClearColor = [0.025, 0.02, 0.045, 1];
const offscreenSize = 384;
const sceneLayerMask = 3;
const gridSize = 5;
const spacing = 0.72;

const timingHistory = new Map();

const baseStatus = {
  example: "gpu-profiler",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
  profiler: {
    source: "WebGpuAppRenderReport.gpuTimings",
    requiredPassCount: 2,
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
    const created = await createExampleWebGpuApp(aperture, {
      canvas,
      timestampQuery: true,
      worldOptions: { entityCapacity: 48 },
    });

    if (!created.ok) {
      publishStatus(
        failure("initialize-webgpu", created.reason, created.message, {
          apertureVersion: aperture.APERTURE_VERSION,
          renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
        }),
      );
    } else {
      const scene = createProfilerScene(aperture, created.app, canvas);

      startProfilerLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "gpu-profiler",
      "gpu-profiler-failed",
      error instanceof Error ? error.message : "GPU profiler example failed.",
    ),
  );
}

function createProfilerScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const device = app.initialization.device;
  const textureUsage = resolveTextureUsage(aperture);
  const offscreenTexture = device.createTexture({
    label: "aperture-gpu-profiler-offscreen-target",
    size: { width: offscreenSize, height: offscreenSize },
    format: app.initialization.format,
    usage:
      textureUsage.RENDER_ATTACHMENT |
      textureUsage.TEXTURE_BINDING |
      textureUsage.COPY_SRC,
  });
  const renderTarget = aperture.createRenderTargetHandle(
    "gpu-profiler-offscreen",
  );
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "GpuProfilerBox",
      width: 0.46,
      height: 0.46,
      depth: 0.46,
    }),
    { id: "gpu-profiler-box" },
  );
  const materials = createProfilerMaterials(aperture, assets);

  app.assets.register(renderTarget, { label: "GPU profiler offscreen target" });
  app.assets.markReady(
    renderTarget,
    aperture.createWebGpuAppRenderTargetAsset({
      label: "GPU profiler offscreen target",
      texture: offscreenTexture,
      width: offscreenSize,
      height: offscreenSize,
      format: app.initialization.format,
    }),
  );

  app.registerSystem(aperture.SpinSystem);

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.46, 0.52, 0.62, 1],
      intensity: 0.38,
      layerMask: sceneLayerMask,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: [0.12, -0.32, 0.08, 0.94] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.92, 0.76, 1],
      intensity: 2.2,
      layerMask: sceneLayerMask,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 5.2] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
      priority: 0,
    }),
  );
  app.spawn(
    aperture.withTransform({
      translation: [0, 0.2, 5.6],
      rotation: [0, -0.258819, 0, 0.965926],
    }),
    aperture.withCamera({
      aspect: 1,
      near: 0.1,
      far: 100,
      clearColor: offscreenClearColor,
      layerMask: 2,
      priority: 1,
      renderTargetId: aperture.assetHandleKey(renderTarget),
    }),
  );

  let cubeCount = 0;
  const start = -((gridSize - 1) * spacing) / 2;

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const index = y * gridSize + x;
      const material = materials[index % materials.length];

      app.spawn(
        aperture.withTransform({
          translation: [start + x * spacing, start + y * spacing, 0],
          scale: [0.88, 0.88, 0.88],
        }),
        aperture.withMesh(mesh),
        aperture.withMaterial(material),
        aperture.withRenderLayer(sceneLayerMask),
        aperture.withVisibility(true),
        aperture.withSpin({
          radiansPerSecond: 0.35 + index * 0.015,
          axis: [0.25 + (index % 3) * 0.12, 1, 0.2],
        }),
      );
      cubeCount += 1;
    }
  }

  return {
    mesh,
    materials,
    renderTarget,
    offscreenTexture,
    cubeCount,
  };
}

function createProfilerMaterials(aperture, assets) {
  const colors = [
    [0.94, 0.34, 0.24, 1],
    [0.22, 0.78, 0.54, 1],
    [0.26, 0.5, 0.96, 1],
    [0.96, 0.76, 0.28, 1],
    [0.72, 0.48, 0.94, 1],
  ];

  return colors.map((color, index) =>
    assets.materials.standard.add(
      aperture.createStandardMaterialAsset({
        label: `GpuProfilerMaterial${index}`,
        baseColorFactor: new Float32Array(color),
        metallicFactor: 0.18 + index * 0.05,
        roughnessFactor: 0.34 + index * 0.08,
      }),
      { id: `gpu-profiler-material-${index}` },
    ),
  );
}

function startProfilerLoop(aperture, app, scene) {
  let firstTimestamp = null;
  let previousTimestamp = null;
  let frame = 0;

  const renderNextFrame = async (timestamp) => {
    if (firstTimestamp === null) {
      firstTimestamp = timestamp;
      previousTimestamp = timestamp;
    }

    frame += 1;

    const elapsedSeconds = (timestamp - firstTimestamp) / 1000;
    const deltaSeconds =
      previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / 1000;

    previousTimestamp = timestamp;

    const step = app.step(deltaSeconds, elapsedSeconds);
    const report = await app.render({
      frame,
      clearColor,
      label: "gpu-profiler",
    });
    const status = createProfilerStatus({
      aperture,
      scene,
      step,
      report,
      frame,
      elapsedSeconds,
    });

    publishStatus(status);
    requestAnimationFrame(renderNextFrame);
  };

  requestAnimationFrame(renderNextFrame);
}

function createProfilerStatus({
  aperture,
  scene,
  step,
  report,
  frame,
  elapsedSeconds,
}) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const overlay = updateTimingOverlay(reportJson.gpuTimings, frame);

  return {
    ...baseStatus,
    ok: report.ok && overlay.ready,
    phase: overlay.ready ? "profiling" : "timing-unavailable",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    frame,
    elapsedSeconds,
    scene: {
      cubeCount: scene.cubeCount,
      materialCount: scene.materials.length,
      meshKey: aperture.assetHandleKey(scene.mesh),
      renderTargetKey: aperture.assetHandleKey(scene.renderTarget),
      layerMask: sceneLayerMask,
    },
    counts: {
      views: report.counts.views,
      meshDraws: report.counts.meshDraws,
      drawCalls: report.counts.drawCalls,
      diagnostics: report.counts.diagnostics,
      transformDiagnostics: step.transform.diagnostics.length,
    },
    renderTargets: reportJson.renderTargets ?? [],
    gpuTimings: reportJson.gpuTimings ?? null,
    overlay,
    report: reportJson,
  };
}

function updateTimingOverlay(gpuTimings, frame) {
  if (overlayFrameElement !== null) {
    overlayFrameElement.textContent = `frame ${frame}`;
  }

  const passes = Array.isArray(gpuTimings?.passes) ? gpuTimings.passes : [];
  const rows = passes.map((pass) => {
    const previous = timingHistory.get(pass.pass);
    const changed =
      previous !== undefined && previous.microseconds !== pass.microseconds;
    const sampleCount = (previous?.sampleCount ?? 0) + 1;
    const changeCount = (previous?.changeCount ?? 0) + (changed ? 1 : 0);
    const row = {
      pass: pass.pass,
      microseconds: pass.microseconds,
      formattedMicroseconds: formatMicroseconds(pass.microseconds),
      previousMicroseconds: previous?.microseconds ?? null,
      sampleCount,
      changeCount,
      changed,
    };

    timingHistory.set(pass.pass, row);
    return row;
  });

  if (overlayPassListElement !== null) {
    overlayPassListElement.replaceChildren(
      ...rows.map((row) => createTimingRowElement(row)),
    );
  }

  return {
    ready:
      gpuTimings?.ready === true &&
      gpuTimings.supported === true &&
      rows.length >= baseStatus.profiler.requiredPassCount &&
      rows.every((row) => row.microseconds > 0),
    supported: gpuTimings?.supported === true,
    passCount: rows.length,
    changedPassValueCount: rows.filter((row) => row.changeCount > 0).length,
    rows,
  };
}

function createTimingRowElement(row) {
  const item = document.createElement("li");
  const name = document.createElement("span");
  const value = document.createElement("strong");

  item.dataset.pass = row.pass;
  item.dataset.microseconds = String(row.microseconds);
  item.dataset.sampleCount = String(row.sampleCount);
  item.dataset.changeCount = String(row.changeCount);
  name.textContent = row.pass;
  value.textContent = row.formattedMicroseconds;
  item.append(name, value);

  return item;
}

function formatMicroseconds(value) {
  if (!Number.isFinite(value)) {
    return "0.000 us";
  }

  if (value < 10) {
    return `${value.toFixed(3)} us`;
  }

  if (value < 100) {
    return `${value.toFixed(2)} us`;
  }

  return `${Math.round(value)} us`;
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
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
