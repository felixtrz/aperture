export const clearColor = [0.02, 0.025, 0.03, 1];

export const appDiagnosticScenarios = [
  {
    id: "mixed-materials",
    statusKey: "mixedMaterials",
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    frame: 1,
    label: "app-diagnostics-mixed-materials",
    entityCapacity: 8,
  },
  {
    id: "material-dependencies",
    statusKey: "materialDependencies",
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    frame: 2,
    label: "app-diagnostics-material-dependencies",
    entityCapacity: 8,
  },
  {
    id: "standard-material-dependencies",
    statusKey: "standardMaterialDependencies",
    expectedFailure: true,
    expectedDiagnostic: "webGpuApp.materialDependenciesNotReady",
    frame: 4,
    label: "app-diagnostics-standard-material-dependencies",
    entityCapacity: 10,
  },
  {
    id: "mixed-material-success",
    statusKey: "mixedMaterialSuccess",
    expectedFailure: false,
    expectedDiagnostic: null,
    frame: 3,
    label: "app-diagnostics-mixed-material-success",
    entityCapacity: 8,
  },
];

export function createAppDiagnosticsBaseStatus(canvas) {
  return {
    example: "app-diagnostics",
    diagnosticOnly: true,
    clearColor: toRgbaObject(clearColor),
    canvas: {
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
    },
  };
}

export function findAppDiagnosticScenario(scenarioId) {
  return (
    appDiagnosticScenarios.find((scenario) => scenario.id === scenarioId) ??
    null
  );
}

export function registerAppDiagnosticScene(aperture, registry, scenarioId) {
  const scenario = findAppDiagnosticScenario(scenarioId);

  if (scenario === null) {
    throw new Error(`Unknown app diagnostics scenario: ${scenarioId}`);
  }

  switch (scenario.id) {
    case "mixed-materials":
      return registerMixedMaterialScene(aperture, registry, scenario);
    case "material-dependencies":
      return registerMaterialDependencyScene(aperture, registry, scenario);
    case "standard-material-dependencies":
      return registerStandardMaterialDependencyScene(
        aperture,
        registry,
        scenario,
      );
    case "mixed-material-success":
      return registerMixedMaterialSuccessScene(aperture, registry, scenario);
    default:
      throw new Error(`Unhandled app diagnostics scenario: ${scenario.id}`);
  }
}

export function spawnAppDiagnosticScene(aperture, app, scene, canvasSize) {
  const camera = diagnosticCamera(canvasSize);

  switch (scene.id) {
    case "mixed-materials":
      app.spawn(
        aperture.withTransform({ translation: [0, 0, 3.1] }),
        aperture.withCamera(camera),
      );
      app.spawn(
        aperture.withTransform({ translation: [-0.55, 0, 0] }),
        aperture.withMesh(scene.mesh),
        aperture.withMaterial(scene.materials[0]),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      );
      app.spawn(
        aperture.withTransform({ translation: [0.55, 0, 0] }),
        aperture.withMesh(scene.mesh),
        aperture.withMaterial(scene.materials[1]),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      );
      return;
    case "material-dependencies":
      app.spawn(
        aperture.withTransform({ translation: [0, 0, 3.1] }),
        aperture.withCamera(camera),
      );
      app.spawn(
        aperture.withTransform(),
        aperture.withMesh(scene.mesh),
        aperture.withMaterial(scene.materials[0]),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      );
      return;
    case "standard-material-dependencies":
      app.spawn(
        aperture.withTransform({ translation: [0, 0, 3.1] }),
        aperture.withCamera(camera),
      );
      app.spawn(
        aperture.withTransform({ translation: [-0.55, 0, 0] }),
        aperture.withMesh(scene.mesh),
        aperture.withMaterial(scene.materials[0]),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      );
      app.spawn(
        aperture.withTransform({ translation: [0.55, 0, 0] }),
        aperture.withMesh(scene.mesh),
        aperture.withMaterial(scene.materials[1]),
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
      return;
    case "mixed-material-success":
      app.spawn(
        aperture.withTransform({ translation: [0, 0, 3.1] }),
        aperture.withCamera(camera),
      );
      app.spawn(
        aperture.withTransform({ translation: [-0.55, 0, 0] }),
        aperture.withMesh(scene.mesh),
        aperture.withMaterial(scene.materials[0]),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      );
      app.spawn(
        aperture.withTransform({ translation: [0.55, 0, 0] }),
        aperture.withMesh(scene.mesh),
        aperture.withMaterial(scene.materials[1]),
        aperture.withRenderLayer(1),
        aperture.withVisibility(true),
      );
      return;
    default:
      throw new Error(`Unhandled app diagnostics scene: ${scene.id}`);
  }
}

export function createAppDiagnosticScenarioStatus(
  aperture,
  scene,
  report,
  transportStatus,
) {
  if (scene.expectedFailure) {
    return {
      ...scenarioStatus(aperture, scene.id, scene.expectedDiagnostic, report),
      ...transportStatus,
    };
  }

  const preparedSummaries = createExamplePreparedResourceSummaries(aperture, {
    registry: scene.registry,
    mesh: scene.mesh,
    materials: scene.materials,
    report,
  });

  return {
    ...successScenarioStatus(aperture, scene.id, report, {
      preparedResourceSummary: preparedSummaries.preparedResourceSummary,
      preparedLifetimeSummary: preparedSummaries.preparedLifetimeSummary,
      preparedAppReuseSummary: preparedSummaries.preparedAppReuseSummary,
    }),
    ...transportStatus,
  };
}

export function createExampleTextureFidelitySummary(aperture) {
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

export function createExampleSamplerFidelitySummary(aperture) {
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

export function webGpuFailure(aperture, baseStatus, created) {
  return {
    ...failure(
      baseStatus,
      "initialize-webgpu",
      created.reason,
      created.message,
    ),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
  };
}

export function failure(baseStatus, phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function registerMixedMaterialScene(aperture, registry, scenario) {
  const assets = aperture.createRenderAssetCollections({ registry });
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

  registry.register(sampler);
  registry.markLoading(sampler);

  const secondMaterial = assets.materials.matcap.add(
    aperture.createMatcapMaterialAsset({
      label: "DiagnosticBlockedMatcap",
      matcapTexture: { texture, sampler },
    }),
    { id: "diagnostic-blocked-matcap" },
  );

  return createSceneRegistration(scenario, registry, mesh, [
    firstMaterial,
    secondMaterial,
  ]);
}

function registerMixedMaterialSuccessScene(aperture, registry, scenario) {
  const assets = aperture.createRenderAssetCollections({ registry });
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

  registry.register(texture);
  registry.markReady(
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
  registry.register(sampler);
  registry.markReady(
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

  return createSceneRegistration(scenario, registry, mesh, [
    unlitMaterial,
    matcapMaterial,
  ]);
}

function registerMaterialDependencyScene(aperture, registry, scenario) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "DependencyCube" }),
    { id: "dependency-cube" },
  );
  const texture = aperture.createTextureHandle("dependency-missing-texture");
  const sampler = aperture.createSamplerHandle("dependency-loading-sampler");

  registry.register(sampler);
  registry.markLoading(sampler);

  const material = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "BlockedDependencyMaterial",
      baseColorTexture: { texture, sampler },
    }),
    { id: "blocked-dependency-material" },
  );

  return createSceneRegistration(scenario, registry, mesh, [material]);
}

function registerStandardMaterialDependencyScene(aperture, registry, scenario) {
  const assets = aperture.createRenderAssetCollections({ registry });
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

  registry.register(sampler);
  registry.markLoading(sampler);

  const standardMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "BlockedStandardDependencyMaterial",
      baseColorTexture: { texture, sampler },
    }),
    { id: "blocked-standard-dependency-material" },
  );

  return createSceneRegistration(scenario, registry, mesh, [
    unlitMaterial,
    standardMaterial,
  ]);
}

function createSceneRegistration(scenario, registry, mesh, materials) {
  return {
    ...scenario,
    registry,
    mesh,
    materials,
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

function diagnosticCamera(canvasSize) {
  return {
    aspect: canvasSize.width / canvasSize.height,
    near: 0.1,
    far: 100,
    clearColor,
    layerMask: 1,
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
