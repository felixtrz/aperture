const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.02, 0.025, 0.03, 1];

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 10 },
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = createScene(aperture, created.app, canvas);

      startRenderLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "standard-queue-phases-failed",
      error instanceof Error
        ? error.message
        : "Standard queue phase example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "StandardQueuePhasePlane",
      width: 0.9,
      height: 0.9,
    }),
    { id: "standard-queue-phase-plane" },
  );
  const leftOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueRed", [0.95, 0.08, 0.04, 1]),
    { id: "phase-opaque-red" },
  );
  const alphaCutout = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseAlphaCutout", [0.08, 1, 0.1, 0], {
      alphaMode: "mask",
      alphaCutoff: 0.5,
    }),
    { id: "phase-alpha-cutout" },
  );
  const rightOpaque = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseOpaqueBlue", [0.08, 0.16, 0.95, 1]),
    { id: "phase-opaque-blue" },
  );
  const transparent = assets.materials.standard.add(
    standardMaterial(aperture, "PhaseTransparentYellow", [1, 0.92, 0.12, 0.5], {
      alphaMode: "blend",
      depth: { test: true, write: false, compare: "less" },
      blend: { preset: "alpha" },
    }),
    { id: "phase-transparent-yellow" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0.16, 4.9] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.65, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(leftOpaque),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.65, 0, 0.02] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(alphaCutout),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.65, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(rightOpaque),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.65, 0, 0.02] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(transparent),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.5, 0.56, 0.68, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 2.8,
      layerMask: 1,
    }),
  );

  return {
    materialKeys: {
      leftOpaque: aperture.assetHandleKey(leftOpaque),
      alphaCutout: aperture.assetHandleKey(alphaCutout),
      rightOpaque: aperture.assetHandleKey(rightOpaque),
      transparent: aperture.assetHandleKey(transparent),
    },
    expectedSamples: {
      alphaCutout: [0.95, 0.08, 0.04, 1],
      transparentBlend: [0.54, 0.54, 0.54, 1],
    },
  };
}

function startRenderLoop(aperture, app, scene) {
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
    app.step(deltaSeconds, elapsedSeconds);

    const report = await app.render({
      frame,
      clearColor,
      label: "standard-queue-phases",
    });

    publishStatus(statusFromReport(aperture, report, scene));
    requestAnimationFrame(renderNextFrame);
  };

  requestAnimationFrame(renderNextFrame);
}

function standardMaterial(aperture, label, color, renderState = {}) {
  return aperture.createStandardMaterialAsset({
    label,
    baseColorFactor: new Float32Array(color),
    emissiveFactor: [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0],
    metallicFactor: 0,
    roughnessFactor: 1,
    renderState: { cullMode: "none", ...renderState },
  });
}

function statusFromReport(aperture, report, scene) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  return {
    example: "standard-queue-phases",
    ok: report.ok,
    frame: report.frame,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    clearColor: toRgbaObject(clearColor),
    materialKeys: scene.materialKeys,
    expectedSamples: scene.expectedSamples,
    queues: report.snapshot.meshDraws.map((draw) => draw.sortKey.queue),
    pipelineKeys: report.snapshot.meshDraws.map(
      (draw) => draw.batchKey.pipelineKey,
    ),
    report: reportJson,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function failure(reason, message) {
  return {
    example: "standard-queue-phases",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: toRgbaObject(clearColor),
  };
}

function toRgbaObject(color) {
  return {
    r: color[0] ?? 0,
    g: color[1] ?? 0,
    b: color[2] ?? 0,
    a: color[3] ?? 1,
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
