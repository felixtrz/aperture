import { createExampleWebGpuApp } from "./example-renderer-app.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.015, 0.02, 0.03, 1];
const nearColor = [0.16, 0.9, 0.32, 1];
const farColor = [1, 0.08, 0.04, 1];
const centerSample = { id: "center", x: 0.5, y: 0.5 };

const baseStatus = {
  example: "depth-app-overlap",
  materialModel: "app-depth-inter-family",
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
      worldOptions: { entityCapacity: 10 },
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = createScene(aperture, created.app, canvas);
      const report = await created.app.render({
        frame: 1,
        clearColor,
        label: "depth-app-overlap",
        readbackSamples: [centerSample],
      });

      publishStatus(createStatus(aperture, scene, report));
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "depth-app-overlap-failed",
      error instanceof Error
        ? error.message
        : "Depth overlap app example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "DepthOverlapCube",
      width: 1.2,
      height: 1.2,
      depth: 1.2,
    }),
    { id: "depth-overlap-cube" },
  );
  const near = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DepthNearUnlitGreen",
      baseColorFactor: new Float32Array(nearColor),
    }),
    { id: "depth-near-unlit-green" },
  );
  const far = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "DepthFarStandardRed",
      baseColorFactor: new Float32Array(farColor),
      emissiveFactor: [farColor[0], farColor[1], farColor[2]],
      metallicFactor: 0,
      roughnessFactor: 1,
    }),
    { id: "depth-far-standard-red" },
  );

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
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [1, 1, 1, 1],
      intensity: 0.35,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 1, 1, 1],
      intensity: 1.3,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0.35] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(near),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(0),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0, 0, -0.35] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(far),
    aperture.withRenderLayer(1),
    aperture.withRenderOrder(10),
    aperture.withVisibility(true),
  );

  return {
    mesh,
    near,
    far,
    expectedTopMaterial: "depth-near-unlit-green",
    expectedRejectedMaterial: "depth-far-standard-red",
    expectedTopColor: nearColor,
    expectedRejectedColor: farColor,
    sample: centerSample,
  };
}

function createStatus(aperture, scene, report) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "submit" : "render",
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    clearColor: colorStatus(clearColor),
    overlap: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      nearMaterialKey: aperture.assetHandleKey(scene.near),
      farMaterialKey: aperture.assetHandleKey(scene.far),
      expectedTopMaterial: scene.expectedTopMaterial,
      expectedRejectedMaterial: scene.expectedRejectedMaterial,
      expectedTopColor: colorStatus(scene.expectedTopColor),
      expectedRejectedColor: colorStatus(scene.expectedRejectedColor),
      sample: scene.sample,
      renderOrders: { near: 0, far: 10 },
    },
    pipelineKeys: report.snapshot.meshDraws.map(
      (draw) => draw.batchKey.pipelineKey,
    ),
    queues: report.snapshot.meshDraws.map((draw) => draw.sortKey.queue),
    webGpuApp: {
      depthAttachment: reportJson.depthAttachment,
    },
    report: reportJson,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
    readback:
      report.readback === undefined
        ? { ok: false, reason: "readback-unavailable" }
        : report.readback,
  };
}

function colorStatus(color) {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}

function failure(reason, message) {
  return {
    ...baseStatus,
    ok: false,
    phase: "failed",
    reason,
    message,
    renderingBackend: "webgpu-explicit",
    clearColor: colorStatus(clearColor),
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
