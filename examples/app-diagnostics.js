import { createExampleWebGpuApp } from "./example-renderer-app.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.025, 0.03, 1];

const baseStatus = {
  example: "app-diagnostics",
  diagnosticOnly: true,
  clearColor: toRgbaObject(clearColor),
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
        const standardMaterialDependencies =
          await runStandardMaterialDependencyScenario(aperture, canvas);

        if (!standardMaterialDependencies.ready) {
          publishStatus(standardMaterialDependencies.status);
        } else {
          const mixedMaterialSuccess = await runMixedMaterialSuccessScenario(
            aperture,
            canvas,
          );

          if (!mixedMaterialSuccess.ready) {
            publishStatus(mixedMaterialSuccess.status);
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
                standardMaterialDependencies:
                  standardMaterialDependencies.status,
                mixedMaterialSuccess: mixedMaterialSuccess.status,
              },
              textureFidelitySummary:
                createExampleTextureFidelitySummary(aperture),
              samplerFidelitySummary:
                createExampleSamplerFidelitySummary(aperture),
              diagnosticCodes: [
                ...mixedMaterials.status.diagnosticCodes,
                ...materialDependencies.status.diagnosticCodes,
                ...standardMaterialDependencies.status.diagnosticCodes,
              ],
            });
          }
        }
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
  const created = await createExampleWebGpuApp(aperture, {
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
  const texture = aperture.createTextureHandle("diagnostic-missing-matcap");
  const sampler = aperture.createSamplerHandle("diagnostic-loading-matcap");

  app.assets.register(sampler);
  app.assets.markLoading(sampler);

  const secondMaterial = assets.materials.matcap.add(
    aperture.createMatcapMaterialAsset({
      label: "DiagnosticBlockedMatcap",
      matcapTexture: { texture, sampler },
    }),
    { id: "diagnostic-blocked-matcap" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera(diagnosticCamera(canvasElement)),
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
      "webGpuApp.materialDependenciesNotReady",
      report,
    ),
  };
}

async function runMixedMaterialSuccessScenario(aperture, canvasElement) {
  const created = await createExampleWebGpuApp(aperture, {
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
    aperture.createBoxMeshAsset({ label: "DiagnosticMixedSuccessCube" }),
    { id: "diagnostic-mixed-success-cube" },
  );
  const unlitMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "DiagnosticSuccessUnlit",
      baseColorFactor: new Float32Array([0.95, 0.25, 0.1, 1]),
    }),
    { id: "diagnostic-success-unlit" },
  );
  const texture = aperture.createTextureHandle("diagnostic-success-matcap");
  const sampler = aperture.createSamplerHandle("diagnostic-success-matcap");

  app.assets.register(texture);
  app.assets.markReady(
    texture,
    aperture.createTextureAsset({
      label: "DiagnosticSuccessMatcap",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48, 72,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(sampler);
  app.assets.markReady(
    sampler,
    aperture.createSamplerAsset({ label: "DiagnosticSuccessMatcapSampler" }),
  );

  const matcapMaterial = assets.materials.matcap.add(
    aperture.createMatcapMaterialAsset({
      label: "DiagnosticSuccessMatcap",
      matcapTexture: { texture, sampler },
    }),
    { id: "diagnostic-success-matcap" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera(diagnosticCamera(canvasElement)),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.55, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(unlitMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.55, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(matcapMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.step(0, 0);

  const report = await app.render({
    frame: 3,
    clearColor,
    label: "app-diagnostics-mixed-material-success",
  });
  const preparedSummaries = createExamplePreparedResourceSummaries(aperture, {
    registry: app.assets,
    mesh,
    materials: [unlitMaterial, matcapMaterial],
    report,
  });

  return {
    ready: true,
    status: successScenarioStatus(aperture, "mixed-material-success", report, {
      preparedResourceSummary: preparedSummaries.preparedResourceSummary,
      preparedLifetimeSummary: preparedSummaries.preparedLifetimeSummary,
      preparedAppReuseSummary: preparedSummaries.preparedAppReuseSummary,
    }),
  };
}

async function runMaterialDependencyScenario(aperture, canvasElement) {
  const created = await createExampleWebGpuApp(aperture, {
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
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera(diagnosticCamera(canvasElement)),
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

async function runStandardMaterialDependencyScenario(aperture, canvasElement) {
  const created = await createExampleWebGpuApp(aperture, {
    canvas: canvasElement,
    worldOptions: { entityCapacity: 10 },
  });

  if (!created.ok) {
    return { ready: false, status: webGpuFailure(aperture, created) };
  }

  const app = created.app;
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "StandardDependencyCube" }),
    { id: "standard-dependency-cube" },
  );
  const unlitMaterial = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "StandardDependencyPeerUnlit",
    }),
    { id: "standard-dependency-peer-unlit" },
  );
  const texture = aperture.createTextureHandle("standard-missing-base-color");
  const sampler = aperture.createSamplerHandle("standard-loading-base-color");

  app.assets.register(sampler);
  app.assets.markLoading(sampler);

  const standardMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "BlockedStandardDependencyMaterial",
      baseColorTexture: { texture, sampler },
    }),
    { id: "blocked-standard-dependency-material" },
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera(diagnosticCamera(canvasElement)),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.55, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(unlitMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.55, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(standardMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      intensity: 0.2,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      intensity: 1.5,
      layerMask: 1,
    }),
  );

  app.step(0, 0);

  const report = await app.render({
    frame: 4,
    clearColor,
    label: "app-diagnostics-standard-material-dependencies",
  });

  return {
    ready: true,
    status: scenarioStatus(
      aperture,
      "standard-material-dependencies",
      "webGpuApp.materialDependenciesNotReady",
      report,
    ),
  };
}

function scenarioStatus(aperture, caseId, expectedDiagnostic, report) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const dependencySummary = aperture.createMaterialDependencyDiagnosticsSummary(
    reportJson.materialDependencyReadiness ?? [],
  );
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
  const materialDependency = firstMaterialDependencyReadiness(reportJson);

  return {
    caseId,
    ok: report.ok,
    expectedFailure: true,
    expectedDiagnostic,
    submitted: report.boundary?.submit?.valid === true,
    diagnosticCodes,
    dependencySummary,
    ...(materialDependency === null
      ? {}
      : {
          failedMaterialKind: materialDependency.materialKind,
          failedMaterialKey: materialDependency.materialKey,
          failedDependencyFields: materialDependency.slots.map(
            (slot) => slot.field,
          ),
          failedResourceKeys: materialDependency.slots.map(
            (slot) => slot.handleKey,
          ),
        }),
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

function successScenarioStatus(aperture, caseId, report, summaries = {}) {
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

  return {
    caseId,
    ok: report.ok,
    expectedFailure: false,
    submitted: report.boundary?.submit?.valid === true,
    diagnosticCodes,
    message: report.ok
      ? "Mixed material-family app rendering submitted successfully."
      : "Mixed material-family app rendering did not submit.",
    ...summaries,
    report: reportJson,
  };
}

function createExamplePreparedResourceSummaries(
  aperture,
  { registry, mesh, materials, report },
) {
  const preparedMeshes = aperture.createPreparedMeshStore();
  const preparedMaterials = aperture.createPreparedMaterialStore();

  preparedMeshes.prepare({ registry, handle: mesh });

  for (const material of materials) {
    preparedMaterials.prepare({ registry, handle: material });
  }

  const preparedResourceSummary =
    aperture.createRenderWorldPreparedResourceSummary({
      meshes: preparedMeshes,
      materials: preparedMaterials,
      drawReadiness: {
        ready: report.ok ? report.snapshot.meshDraws : [],
        blocked: report.ok ? [] : report.snapshot.meshDraws,
        diagnostics: [],
      },
    });
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const preparedLifetimeSummary =
    aperture.createPreparedResourceLifetimeAlignmentSummary({
      facade: preparedResourceSummary,
      backend: createExampleBackendResourceSummary(
        reportJson,
        preparedResourceSummary,
      ),
    });
  const preparedAppReuseSummary =
    aperture.createPreparedResourceAppReuseAlignmentSummary({
      facade: preparedResourceSummary,
      reuse: reportJson.resourceReuse,
    });

  return {
    preparedResourceSummary,
    preparedLifetimeSummary,
    preparedAppReuseSummary,
  };
}

function createExampleBackendResourceSummary(reportJson, preparedSummary) {
  const reuse = reportJson.resourceReuse ?? {};

  return {
    counts: {
      meshResources: preparedSummary.preparedMeshes.totalEntries,
      meshVertexBuffers: preparedSummary.preparedMeshes.totalEntries,
      meshIndexBuffers: preparedSummary.preparedMeshes.totalEntries,
      materialBuffers: preparedSummary.preparedMaterials.totalEntries,
      textures: reuse.textureResourcesCreated ?? 0,
      samplers: reuse.samplerResourcesCreated ?? 0,
      lightBuffers: reuse.lightBuffersCreated ?? 0,
      lightGpuBuffers: reuse.lightBuffersCreated ?? 0,
      lightBindGroups: 0,
      environmentMaps: 0,
      viewUniformBuffers: 1,
      shaderModules: 0,
      pipelineHits: reuse.pipelineHits ?? 0,
      pipelineMisses: reuse.pipelineMisses ?? 0,
      inspectedResources: 0,
      staleResources: 0,
      missingResources: 0,
      pendingDestroyResources: 0,
      warnings: 0,
      errors: 0,
    },
    diagnostics: [],
  };
}

function createExampleTextureFidelitySummary(aperture) {
  return aperture.createStandardMaterialTextureFidelitySummary([
    {
      ready: false,
      materialKey: "material:example-standard-texture-fidelity",
      materialStatus: "ready",
      materialKind: "standard",
      slots: [
        textureFidelitySlot("baseColorTexture", "texture:example-base", false),
        textureFidelitySlot("normalTexture", "texture:example-normal", true),
        textureFidelitySlot(
          "emissiveTexture",
          "texture:example-emissive",
          true,
        ),
      ],
      diagnostics: [
        textureFidelityDiagnostic(
          "standardMaterialTexture.invalidColorSpace",
          "baseColorTexture",
        ),
        textureFidelityDiagnostic(
          "standardMaterialTexture.invalidSemantic",
          "baseColorTexture",
        ),
        textureFidelityDiagnostic(
          "standardMaterialTexture.missingSamplerHandle",
          "normalTexture",
        ),
        textureFidelityDiagnostic(
          "standardMaterialTexture.samplerNotReady",
          "emissiveTexture",
        ),
        textureFidelityDiagnostic(
          "standardMaterialTexture.unsupportedTexCoord",
          "occlusionTexture",
        ),
        textureFidelityDiagnostic(
          "standardMaterialTexture.unsupportedTextureTransform",
          "metallicRoughnessTexture",
        ),
      ],
    },
  ]);
}

function textureFidelitySlot(field, textureKey, ready) {
  const baseColor = field === "baseColorTexture";

  return {
    field,
    textureKey,
    expectedSemantic: baseColor ? "base-color" : "metallic-roughness",
    actualSemantic: baseColor ? "base-color" : "metallic-roughness",
    expectedColorSpaces: baseColor ? ["srgb"] : ["linear", "data"],
    actualColorSpace: baseColor ? "srgb" : "data",
    texCoord: 0,
    ready,
  };
}

function textureFidelityDiagnostic(code, field) {
  return {
    code,
    severity: "warning",
    materialKey: "material:example-standard-texture-fidelity",
    field,
    textureKey: `texture:${field}`,
    samplerKey: `sampler:${field}`,
    message: `${field} produced a texture fidelity issue.`,
  };
}

function createExampleSamplerFidelitySummary(aperture) {
  return aperture.createStandardMaterialSamplerFidelitySummary([
    {
      ready: true,
      materialKey: "material:example-standard-sampler-fidelity",
      materialStatus: "ready",
      materialKind: "standard",
      slots: [
        samplerFidelitySlot("baseColorTexture", 2),
        samplerFidelitySlot("normalTexture", 1),
      ],
      diagnostics: [
        samplerFidelityDiagnostic(
          "standardMaterialSampler.mipmapFilterWithoutMips",
          "baseColorTexture",
        ),
        samplerFidelityDiagnostic(
          "standardMaterialSampler.lodMaxExceedsMipRange",
          "baseColorTexture",
        ),
        samplerFidelityDiagnostic(
          "standardMaterialSampler.anisotropyNotReported",
          "normalTexture",
        ),
      ],
    },
  ]);
}

function samplerFidelitySlot(field, warningCount) {
  return {
    field,
    textureKey: `texture:${field}`,
    samplerKey: `sampler:${field}`,
    mipLevelCount: 1,
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 32,
    maxAnisotropy: field === "normalTexture" ? 8 : 1,
    warningCount,
  };
}

function samplerFidelityDiagnostic(code, field) {
  return {
    code,
    severity: "warning",
    materialKey: "material:example-standard-sampler-fidelity",
    field,
    textureKey: `texture:${field}`,
    samplerKey: `sampler:${field}`,
    message: `${field} produced a sampler fidelity issue.`,
  };
}

function firstMaterialDependencyReadiness(reportJson) {
  const [readiness] = reportJson.materialDependencyReadiness ?? [];

  if (
    readiness === undefined ||
    readiness === null ||
    typeof readiness !== "object" ||
    !Array.isArray(readiness.slots)
  ) {
    return null;
  }

  return {
    materialKind:
      typeof readiness.materialKind === "string"
        ? readiness.materialKind
        : "unknown",
    materialKey:
      typeof readiness.materialKey === "string"
        ? readiness.materialKey
        : "unknown",
    slots: readiness.slots.filter(
      (slot) =>
        slot !== null &&
        typeof slot === "object" &&
        typeof slot.handleKey === "string",
    ),
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

function diagnosticCamera(canvasElement) {
  return {
    aspect: canvasElement.width / canvasElement.height,
    near: 0.1,
    far: 100,
    clearColor,
    layerMask: 1,
  };
}
