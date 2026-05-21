import { createExampleWebGpuApp } from "./example-renderer-app.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.025, 0.035, 1];
const expectedNormalColor = [0.5, 0.5, 1, 1];
const samplePoint = { id: "front-face-normal", x: 0.5, y: 0.5 };

const baseStatus = {
  example: "debug-normal-app",
  materialModel: "debug-normal-app-route",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const created = await createExampleWebGpuApp(aperture, {
      canvas,
      worldOptions: { entityCapacity: 8 },
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createDebugNormalScene(aperture, created.app, canvas);

      created.app.step(0, 0);

      const report = await created.app.render({
        frame: 1,
        clearColor,
        label: "debug-normal-app-route",
        readbackSamples: [samplePoint],
      });

      publishStatus(createStatus(aperture, scene, report));
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "debug-normal-app-failed",
      error instanceof Error
        ? error.message
        : "DebugNormal app example failed.",
    ),
  );
}

function createDebugNormalScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DebugNormalCube",
      width: 1.4,
      height: 1.4,
      depth: 1.4,
    }),
    { id: "debug-normal-cube" },
  );
  const materialAsset = aperture.createDebugNormalMaterialAsset({
    label: "DebugNormalFrontFace",
  });
  const material = assets.materials.debugNormal.add(materialAsset, {
    id: "debug-normal-material",
  });

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return { mesh, material, materialAsset };
}

function createStatus(aperture, scene, report) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const firstDraw = report.snapshot.meshDraws[0];
  const routedResourceSet = reportJson.diagnosticsSummary?.routedResourceSet;
  const materialQueue = reportJson.diagnosticsSummary?.materialQueue;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "submit" : "render",
    renderingBackend: "webgpu-explicit",
    clearColor: colorStatus(clearColor),
    debugNormal: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      materialLabel: scene.materialAsset.label,
      materialFamily: firstDraw?.batchKey.pipelineKey.split("|")[0] ?? null,
      pipelineKey: firstDraw?.batchKey.pipelineKey ?? null,
      expectedNormalColor: colorStatus(expectedNormalColor),
      sample: samplePoint,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    diagnosticsSummary: reportJson.diagnosticsSummary,
    resources: {
      drawCalls: report.counts.drawCalls,
      bindGroups:
        report.resources?.resources === null ||
        report.resources?.resources === undefined
          ? 0
          : report.resources.resources.bindGroups.length,
      materialQueueFamilies: materialQueue?.byFamily ?? [],
      routedResourceFamilies: routedResourceSet?.byFamily ?? [],
      routedResourceFamilyPipelines:
        routedResourceSet?.byFamilyAndPipeline ?? [],
    },
    readback:
      report.readback === undefined
        ? { ok: false, reason: "readback-unavailable" }
        : report.readback,
    counts: report.counts,
    diagnostics: reportJson.diagnostics,
    resourceReuse: reportJson.resourceReuse,
  };
}

function colorStatus(color) {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}

function failure(reason, message, extra = {}) {
  return {
    ...baseStatus,
    ok: false,
    reason,
    message,
    ...extra,
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
