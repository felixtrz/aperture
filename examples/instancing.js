const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.012, 0.016, 0.024, 1];
const instanceCount = 1000;
const columns = 40;
const rows = 25;

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
      worldOptions: { entityCapacity: instanceCount + 8 },
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      createScene(aperture, created.app, canvas);

      const report = await created.app.stepAndRender(1 / 60, 1, 1);

      publishStatus(statusFromReport(aperture, report));
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "instancing-failed",
      error instanceof Error ? error.message : "Instancing example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "InstancedBox" }),
    { id: "instanced-box" },
  );
  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "InstancedCyan",
      baseColorFactor: new Float32Array([0.08, 0.72, 1, 1]),
    }),
    { id: "instanced-cyan" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 16] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  for (let index = 0; index < instanceCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = (column - (columns - 1) / 2) * 0.42;
    const y = ((rows - 1) / 2 - row) * 0.42;

    app.spawn(
      aperture.withTransform({
        translation: [x, y, 0],
        scale: [0.14, 0.14, 0.14],
      }),
      aperture.withMesh(mesh),
      aperture.withMaterial(material),
      aperture.withRenderLayer(1),
      aperture.withVisibility(true),
    );
  }
}

function statusFromReport(aperture, report) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  return {
    example: "instancing",
    ok: report.ok,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    instanceCount,
    grid: { columns, rows },
    clearColor: toRgbaObject(clearColor),
    counts: reportJson.counts,
    report: reportJson,
    diagnostics: reportJson.diagnostics,
  };
}

function failure(reason, message) {
  return {
    example: "instancing",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: toRgbaObject(clearColor),
  };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function toRgbaObject(color) {
  return {
    r: color[0] ?? 0,
    g: color[1] ?? 0,
    b: color[2] ?? 0,
    a: color[3] ?? 1,
  };
}
