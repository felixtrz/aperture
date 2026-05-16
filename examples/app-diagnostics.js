const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.025, 0.03, 1];

const baseStatus = {
  example: "app-diagnostics",
  diagnosticOnly: true,
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
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const mixedMaterials = await runMixedMaterialScenario(aperture, canvas);

    if (!mixedMaterials.ready) {
      publishStatus(mixedMaterials.status);
    } else {
      const materialDependencies = await runMaterialDependencyScenario(
        aperture,
        canvas,
      );

      if (!materialDependencies.ready) {
        publishStatus(materialDependencies.status);
      } else {
        publishStatus({
          ...baseStatus,
          ok: true,
          phase: "diagnostics-ready",
          apertureVersion: aperture.APERTURE_VERSION,
          renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
          scenarios: {
            mixedMaterials: mixedMaterials.status,
            materialDependencies: materialDependencies.status,
          },
          diagnosticCodes: [
            ...mixedMaterials.status.diagnosticCodes,
            ...materialDependencies.status.diagnosticCodes,
          ],
        });
      }
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "dist-import",
      "dist-import-failed",
      error instanceof Error
        ? error.message
        : "The built Aperture workspace packages could not be imported.",
    ),
  );
}

async function runMixedMaterialScenario(aperture, canvasElement) {
  const created = await aperture.createWebGpuApp({
    canvas: canvasElement,
    worldOptions: { entityCapacity: 8 },
  });

  if (!created.ok) {
    return { ready: false, status: webGpuFailure(aperture, created) };
  }

  const app = created.app;
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "DiagnosticSharedCube" }),
    { id: "diagnostic-shared-cube" },
  );
  const firstMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({ label: "DiagnosticWhite" }),
    { id: "diagnostic-white" },
  );
  const secondMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "DiagnosticStandard",
      baseColorFactor: new Float32Array([0.15, 0.4, 1, 1]),
      metallicFactor: 0.1,
      roughnessFactor: 0.65,
    }),
    { id: "diagnostic-standard" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({ layerMask: 1 }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.55, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(firstMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.55, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(secondMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.step(0, 0);

  const report = await app.render({
    frame: 1,
    clearColor,
    label: "app-diagnostics-mixed-materials",
  });

  return {
    ready: true,
    status: scenarioStatus(
      aperture,
      "mixed-materials",
      "webGpuApp.additionalDrawResourceUnsupported",
      report,
    ),
  };
}

async function runMaterialDependencyScenario(aperture, canvasElement) {
  const created = await aperture.createWebGpuApp({
    canvas: canvasElement,
    worldOptions: { entityCapacity: 8 },
  });

  if (!created.ok) {
    return { ready: false, status: webGpuFailure(aperture, created) };
  }

  const app = created.app;
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "DependencyCube" }),
    { id: "dependency-cube" },
  );
  const texture = aperture.createTextureHandle("dependency-missing-texture");
  const sampler = aperture.createSamplerHandle("dependency-loading-sampler");

  app.assets.register(sampler);
  app.assets.markLoading(sampler);

  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "BlockedDependencyMaterial",
      baseColorTexture: { texture, sampler },
    }),
    { id: "blocked-dependency-material" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 4] }),
    aperture.withCamera({ layerMask: 1 }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.step(0, 0);

  const report = await app.render({
    frame: 2,
    clearColor,
    label: "app-diagnostics-material-dependencies",
  });

  return {
    ready: true,
    status: scenarioStatus(
      aperture,
      "material-dependencies",
      "webGpuApp.materialDependenciesNotReady",
      report,
    ),
  };
}

function scenarioStatus(aperture, caseId, expectedDiagnostic, report) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const diagnosticCodes = reportJson.diagnostics
    .map((diagnostic) =>
      diagnostic !== null &&
      typeof diagnostic === "object" &&
      typeof diagnostic.code === "string"
        ? diagnostic.code
        : null,
    )
    .filter((code) => code !== null);
  const expected = reportJson.diagnostics.find(
    (diagnostic) =>
      diagnostic !== null &&
      typeof diagnostic === "object" &&
      diagnostic.code === expectedDiagnostic,
  );

  return {
    caseId,
    ok: report.ok,
    expectedFailure: true,
    expectedDiagnostic,
    diagnosticCodes,
    message:
      expected !== undefined &&
      expected !== null &&
      typeof expected === "object" &&
      typeof expected.message === "string"
        ? expected.message
        : "Expected app diagnostic was not present.",
    report: reportJson,
  };
}

function webGpuFailure(aperture, created) {
  return {
    ...failure("initialize-webgpu", created.reason, created.message),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
  };
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
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
