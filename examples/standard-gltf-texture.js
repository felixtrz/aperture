const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const scalarColor = [0.95, 0.1, 0.08, 1];
const expectedTextureColor = [0.09375, 0.5, 1, 1];
const metallicRoughness = { metallic: 64 / 255, roughness: 16 / 255 };
const normalMapVector = { x: 128 / 255, y: 128 / 255, z: 16 / 255 };
const occlusionValue = 32 / 255;
const occlusion = { red: occlusionValue, strength: 1 };
const emissiveColor = [1, 0.5, 0.125, 1];
const emissiveFactor = [0.9, 0.25, 0.08];
const alphaMaskDoubleSided = {
  alphaMode: "MASK",
  alphaCutoff: 0.35,
  doubleSided: true,
};
const alphaMaskTexture = {
  source: {
    alphaMode: "MASK",
    alphaCutoff: 0.5,
    doubleSided: true,
  },
  opaqueColor: expectedTextureColor,
  maskedColor: [1, 24 / 255, 24 / 255, 64 / 255],
  opaqueSample: { id: "opaque", x: 0.455, y: 0.5 },
  maskedSample: { id: "masked", x: 0.53, y: 0.5 },
};
const alphaMaskBackface = {
  source: {
    alphaMode: "MASK",
    alphaCutoff: 0.35,
    doubleSided: true,
  },
  sample: { id: "backface", x: 0.5, y: 0.5 },
  expectedColor: scalarColor,
};
const unsupportedTextureTransform = { offset: [0.25, 0], rotation: 0.25 };
const textureTransformSampling = {
  transform: { offset: [0.5, 0], scale: [0.5, 1] },
  sample: { id: "transformed", x: 0.455, y: 0.5 },
  expectedColor: [0.05, 0.95, 0.1, 1],
  untransformedColor: [0.95, 0.05, 0.05, 1],
};
const uv1Coordinate = { u: 0.25, v: 0.25 };
const uv1Texture = {
  expectedColor: [0.95, 0.05, 0.05, 1],
  rejectedUv0Color: [0.05, 0.95, 0.1, 1],
};
const gltfSamplerSource = {
  magFilter: 9728,
  minFilter: 9728,
  wrapS: 33071,
  wrapT: 33071,
};
const fixtureId = "inline-gltf-standard-base-color-texture";
const baseColorTextureBytes = new Uint8Array([
  24, 128, 255, 255, 24, 128, 255, 255, 24, 128, 255, 255, 24, 128, 255, 255,
]);
const metallicRoughnessTextureBytes = new Uint8Array([
  0, 16, 64, 255, 0, 16, 64, 255, 0, 16, 64, 255, 0, 16, 64, 255,
]);
const normalTextureBytes = new Uint8Array([
  128, 128, 16, 255, 128, 128, 16, 255, 128, 128, 16, 255, 128, 128, 16, 255,
]);
const occlusionTextureBytes = new Uint8Array([
  32, 255, 255, 255, 32, 255, 255, 255, 32, 255, 255, 255, 32, 255, 255, 255,
]);
const emissiveTextureBytes = new Uint8Array([
  255, 128, 32, 255, 255, 128, 32, 255, 255, 128, 32, 255, 255, 128, 32, 255,
]);
const alphaMaskTextureBytes = new Uint8Array([
  24, 128, 255, 255, 255, 24, 24, 64, 24, 128, 255, 255, 255, 24, 24, 64,
]);
const textureTransformSamplingBytes = new Uint8Array([
  242, 13, 13, 255, 13, 242, 26, 255, 242, 13, 13, 255, 13, 242, 26, 255,
]);
const expectedGltfFailures = {
  "base-color-transform": {
    mappingDiagnostic: "gltfMaterial.unsupportedTextureTransform",
    renderDiagnostic:
      "render.standardMaterialTexture.unsupportedTextureTransform",
    status: "unsupported-transform",
  },
  "delayed-dependencies": {
    mappingDiagnostic: null,
    renderDiagnostic: "webGpuApp.materialDependenciesNotReady",
    status: "delayed-dependencies",
  },
  "base-color-uv1-missing": {
    mappingDiagnostic: null,
    renderDiagnostic: "render.standardMaterialTexture.missingTexCoord1",
    status: "missing-texcoord1",
  },
};
const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? "ready";
const scenarioConfig = createGltfScenarioConfig(scenario);

const baseStatus = {
  example: "standard-gltf-texture",
  fixtureId,
  scenario,
  materialModel: scenarioConfig.materialModel,
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
    const created = await aperture.createWebGpuApp({
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
      const scene = createGltfTextureScene(
        aperture,
        created.app,
        canvas,
        scenario,
      );
      const report = await created.app.render({
        frame: 1,
        clearColor,
        label: "standard-gltf-texture-app",
        readbackSamples: scene.readbackSamples,
      });

      publishStatus(createStatus(aperture, created.app, scene, report));
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "standard-gltf-texture-failed",
      error instanceof Error
        ? error.message
        : "Standard glTF texture example failed.",
    ),
  );
}

function createGltfTextureScene(aperture, app, targetCanvas, selectedScenario) {
  const config = createGltfScenarioConfig(selectedScenario);
  const assetMapping = aperture.createGltfAssetMappingReport({
    root: createGltfFixtureRoot(config),
    resolveImageData: (input) => ({
      width: 2,
      height: 2,
      sourceData: {
        bytes: textureBytesForSlot(input.slot),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  });
  const meshConstruction = createGltfMeshConstructionReport(aperture, config);
  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: app.assets,
    assetMapping,
    meshConstruction,
  });
  applyDelayedDependencyScenario(aperture, app, config);
  const mesh = aperture.createMeshHandle("gltf:mesh:0:primitive:0");
  const material = aperture.createMaterialHandle("gltf:material:0");

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 2.5] }),
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
      intensity: 0.72,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.2, 0.8, 1.5] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 1, 1, 1],
      intensity: 1.15,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(
      config.expectedBackface === null ? {} : { rotation: [0, 1, 0, 0] },
    ),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    assetMapping,
    meshConstruction,
    registration,
    app,
    mesh,
    material,
    textureSlot: config.textureSlot,
    samplePoint: config.samplePoint,
    expectedFailure: config.expectedFailure,
    expectedTextureTransform: config.expectedTextureTransform,
    expectedTextureColor: config.expectedTextureColor,
    expectedUntransformedTextureColor: config.expectedUntransformedTextureColor,
    expectedTexCoord: config.expectedTexCoord,
    expectedUv1: config.expectedUv1,
    expectedMetallicRoughness: config.expectedMetallicRoughness,
    expectedNormalMap: config.expectedNormalMap,
    expectedOcclusion: config.expectedOcclusion,
    expectedEmissive: config.expectedEmissive,
    expectedAlphaMaskTexture: config.expectedAlphaMaskTexture,
    expectedBackface: config.expectedBackface,
    expectedDelayedDependencies: config.expectedDelayedDependencies,
    expectedRenderState: config.expectedRenderState,
    readbackSamples: readbackSamplesForConfig(config),
  };
}

function createGltfScenarioConfig(selectedScenario) {
  const usesBaseColorTransform = selectedScenario === "base-color-transform";
  const usesBaseColorTransformSampling =
    selectedScenario === "base-color-transform-sampling";
  const usesBaseColorUv1 = selectedScenario === "base-color-uv1";
  const usesBaseColorUv1Missing = selectedScenario === "base-color-uv1-missing";
  const usesAnyBaseColorUv1 = usesBaseColorUv1 || usesBaseColorUv1Missing;
  const usesMetallicRoughnessTexture =
    selectedScenario === "metallic-roughness";
  const usesNormalTexture = selectedScenario === "normal-map";
  const usesOcclusionTexture = selectedScenario === "occlusion";
  const usesEmissiveTexture = selectedScenario === "emissive";
  const usesAlphaMaskDoubleSided =
    selectedScenario === "alpha-mask-double-sided";
  const usesAlphaMaskTexture = selectedScenario === "alpha-mask-texture";
  const usesAlphaMaskBackface = selectedScenario === "alpha-mask-backface";
  const usesDelayedDependencies = selectedScenario === "delayed-dependencies";

  return {
    usesBaseColorTransform,
    usesBaseColorTransformSampling,
    usesBaseColorUv1,
    usesBaseColorUv1Missing,
    usesAnyBaseColorUv1,
    usesMetallicRoughnessTexture,
    usesNormalTexture,
    usesOcclusionTexture,
    usesEmissiveTexture,
    usesAlphaMaskDoubleSided,
    usesAlphaMaskTexture,
    usesAlphaMaskBackface,
    usesDelayedDependencies,
    textureSlot: usesMetallicRoughnessTexture
      ? "metallicRoughnessTexture"
      : usesNormalTexture
        ? "normalTexture"
        : usesOcclusionTexture
          ? "occlusionTexture"
          : usesEmissiveTexture
            ? "emissiveTexture"
            : usesAlphaMaskDoubleSided
              ? null
              : usesAlphaMaskBackface
                ? null
                : usesDelayedDependencies
                  ? "baseColorTexture"
                  : "baseColorTexture",
    materialModel: usesMetallicRoughnessTexture
      ? "gltf-standard-metallic-roughness-texture"
      : usesNormalTexture
        ? "gltf-standard-normal-texture"
        : usesOcclusionTexture
          ? "gltf-standard-occlusion-texture"
          : usesEmissiveTexture
            ? "gltf-standard-emissive-texture"
            : usesAlphaMaskDoubleSided
              ? "gltf-standard-alpha-mask-double-sided"
              : usesAlphaMaskTexture
                ? "gltf-standard-alpha-mask-texture"
                : usesAlphaMaskBackface
                  ? "gltf-standard-alpha-mask-backface"
                  : usesDelayedDependencies
                    ? "gltf-standard-delayed-dependencies"
                    : usesBaseColorTransformSampling
                      ? "gltf-standard-base-color-transform-sampling"
                      : usesBaseColorUv1
                        ? "gltf-standard-base-color-uv1"
                        : usesBaseColorUv1Missing
                          ? "gltf-standard-base-color-uv1-missing"
                          : "gltf-standard-base-color-texture",
    expectedFailure: expectedGltfFailures[selectedScenario] ?? null,
    expectedTextureTransform: usesBaseColorTransform
      ? unsupportedTextureTransform
      : usesBaseColorTransformSampling
        ? textureTransformSampling.transform
        : null,
    expectedTextureColor: usesBaseColorTransformSampling
      ? textureTransformSampling.expectedColor
      : usesBaseColorUv1
        ? uv1Texture.expectedColor
        : usesMetallicRoughnessTexture ||
            usesNormalTexture ||
            usesOcclusionTexture
          ? null
          : usesEmissiveTexture
            ? null
            : expectedTextureColor,
    expectedUntransformedTextureColor: usesBaseColorTransformSampling
      ? textureTransformSampling.untransformedColor
      : usesBaseColorUv1
        ? uv1Texture.rejectedUv0Color
        : null,
    expectedTexCoord: usesAnyBaseColorUv1 ? 1 : 0,
    expectedUv1: usesBaseColorUv1 ? uv1Coordinate : null,
    expectedMetallicRoughness: usesMetallicRoughnessTexture
      ? metallicRoughness
      : null,
    expectedNormalMap: usesNormalTexture ? normalMapVector : null,
    expectedOcclusion: usesOcclusionTexture ? occlusion : null,
    expectedEmissive: usesEmissiveTexture
      ? { factor: emissiveFactor, color: emissiveColor }
      : null,
    expectedAlphaMaskTexture: usesAlphaMaskTexture ? alphaMaskTexture : null,
    expectedBackface: usesAlphaMaskBackface ? alphaMaskBackface : null,
    expectedDelayedDependencies: usesDelayedDependencies
      ? {
          loadingTextureKey: "texture:gltf:texture:0:baseColorTexture",
          failedTextureKey: "texture:gltf:texture:1:normalTexture",
          loadingSamplerKey: "sampler:gltf:sampler:1:normalTexture",
          failedSamplerKey: "sampler:gltf:sampler:0:baseColorTexture",
        }
      : null,
    expectedRenderState:
      usesAlphaMaskDoubleSided || usesAlphaMaskTexture || usesAlphaMaskBackface
        ? (() => {
            const source = alphaMaskSourceForConfig({
              usesAlphaMaskTexture,
              usesAlphaMaskBackface,
            });

            return {
              source,
              mapped: {
                alphaMode: "mask",
                alphaCutoff: source.alphaCutoff,
                cullMode: "none",
                depth: { test: true, write: true, compare: "less" },
                blend: { preset: "none" },
              },
            };
          })()
        : null,
    samplePoint: usesBaseColorTransformSampling
      ? textureTransformSampling.sample
      : { id: "textured", x: 0.5, y: 0.5 },
  };
}

function alphaMaskSourceForConfig(config) {
  if (config.usesAlphaMaskTexture) {
    return alphaMaskTexture.source;
  }

  if (config.usesAlphaMaskBackface) {
    return alphaMaskBackface.source;
  }

  return alphaMaskDoubleSided;
}

function materialNameForConfig(config) {
  return config.usesMetallicRoughnessTexture
    ? "GLB Standard MetallicRoughness"
    : config.usesNormalTexture
      ? "GLB Standard Normal"
      : config.usesOcclusionTexture
        ? "GLB Standard Occlusion"
        : config.usesEmissiveTexture
          ? "GLB Standard Emissive"
          : config.usesAlphaMaskDoubleSided
            ? "GLB Standard Alpha Mask Double Sided"
            : config.usesAlphaMaskTexture
              ? "GLB Standard Alpha Mask Texture"
              : config.usesAlphaMaskBackface
                ? "GLB Standard Alpha Mask Backface"
                : config.usesDelayedDependencies
                  ? "GLB Standard Delayed Dependencies"
                  : config.usesBaseColorTransformSampling
                    ? "GLB Standard BaseColor Transform Sampling"
                    : config.usesBaseColorUv1
                      ? "GLB Standard BaseColor UV1"
                      : config.usesBaseColorUv1Missing
                        ? "GLB Standard BaseColor UV1 Missing"
                        : "GLB Standard BaseColor";
}

function readbackSamplesForConfig(config) {
  if (config.expectedAlphaMaskTexture !== null) {
    return [
      config.expectedAlphaMaskTexture.opaqueSample,
      config.expectedAlphaMaskTexture.maskedSample,
    ];
  }

  if (config.expectedBackface !== null) {
    return [config.expectedBackface.sample];
  }

  return [config.samplePoint];
}

function createGltfFixtureRoot(config) {
  let pbrMetallicRoughness;

  if (config.usesMetallicRoughnessTexture) {
    pbrMetallicRoughness = {
      baseColorFactor: scalarColor,
      metallicFactor: 1,
      roughnessFactor: 1,
      metallicRoughnessTexture: { index: 0 },
    };
  } else if (
    config.usesNormalTexture ||
    config.usesOcclusionTexture ||
    config.usesEmissiveTexture ||
    config.usesAlphaMaskDoubleSided ||
    config.usesAlphaMaskBackface
  ) {
    pbrMetallicRoughness = {
      baseColorFactor: scalarColor,
      metallicFactor: 0,
      roughnessFactor: 0.8,
    };
  } else if (config.usesAlphaMaskTexture || config.usesDelayedDependencies) {
    pbrMetallicRoughness = {
      baseColorFactor: [1, 1, 1, 1],
      baseColorTexture: { index: 0 },
      metallicFactor: 0,
      roughnessFactor: 0.8,
    };
  } else {
    pbrMetallicRoughness = {
      baseColorFactor: [1, 1, 1, 1],
      baseColorTexture: {
        index: 0,
        ...(config.usesAnyBaseColorUv1 ? { texCoord: 1 } : {}),
        ...(config.expectedTextureTransform === null
          ? {}
          : {
              extensions: {
                KHR_texture_transform: config.expectedTextureTransform,
              },
            }),
      },
      metallicFactor: 0,
      roughnessFactor: 0.8,
    };
  }

  const material = {
    name: materialNameForConfig(config),
    pbrMetallicRoughness,
    ...(config.usesAlphaMaskDoubleSided ||
    config.usesAlphaMaskTexture ||
    config.usesAlphaMaskBackface
      ? (() => {
          const source = alphaMaskSourceForConfig(config);

          return {
            alphaMode: source.alphaMode,
            alphaCutoff: source.alphaCutoff,
            doubleSided: source.doubleSided,
          };
        })()
      : {}),
    ...(config.usesNormalTexture
      ? { normalTexture: { index: 0, scale: 2 } }
      : {}),
    ...(config.usesDelayedDependencies
      ? { normalTexture: { index: 1, scale: 1 } }
      : {}),
    ...(config.usesOcclusionTexture
      ? { occlusionTexture: { index: 0, strength: occlusion.strength } }
      : {}),
    ...(config.usesEmissiveTexture
      ? { emissiveFactor, emissiveTexture: { index: 0 } }
      : {}),
  };

  return {
    asset: { version: "2.0" },
    materials: [material],
    ...(config.textureSlot === null
      ? {}
      : config.usesDelayedDependencies
        ? {
            textures: [
              { source: 0, sampler: 0 },
              { source: 1, sampler: 1 },
            ],
            images: [
              { bufferView: 0, mimeType: "image/png", name: "BaseColor" },
              { bufferView: 1, mimeType: "image/png", name: "Normal" },
            ],
            samplers: [gltfSamplerSource, gltfSamplerSource],
          }
        : {
            textures: [{ source: 0, sampler: 0 }],
            images: [
              { bufferView: 0, mimeType: "image/png", name: "BaseColor" },
            ],
            samplers: [gltfSamplerSource],
          }),
  };
}

function textureBytesForSlot(textureSlot) {
  switch (textureSlot) {
    case "metallicRoughnessTexture":
      return metallicRoughnessTextureBytes;
    case "normalTexture":
      return normalTextureBytes;
    case "occlusionTexture":
      return occlusionTextureBytes;
    case "emissiveTexture":
      return emissiveTextureBytes;
    case "baseColorTexture":
      return scenario === "alpha-mask-texture"
        ? alphaMaskTextureBytes
        : scenario === "base-color-transform-sampling"
          ? textureTransformSamplingBytes
          : scenario === "base-color-uv1" ||
              scenario === "base-color-uv1-missing"
            ? textureTransformSamplingBytes
            : baseColorTextureBytes;
    default:
      return baseColorTextureBytes;
  }
}
function applyDelayedDependencyScenario(aperture, app, config) {
  if (config.expectedDelayedDependencies === null) {
    return;
  }

  app.assets.markLoading(
    aperture.createTextureHandle("gltf:texture:0:baseColorTexture"),
  );
  app.assets.markFailed(
    aperture.createTextureHandle("gltf:texture:1:normalTexture"),
    [
      {
        code: "example.gltfTextureDecodeFailed",
        message: "Delayed dependency fixture marks normal texture failed.",
        severity: "error",
      },
    ],
  );
  app.assets.markLoading(
    aperture.createSamplerHandle("gltf:sampler:1:normalTexture"),
  );
  app.assets.markFailed(
    aperture.createSamplerHandle("gltf:sampler:0:baseColorTexture"),
    [
      {
        code: "example.gltfSamplerFailed",
        message: "Delayed dependency fixture marks base-color sampler failed.",
        severity: "error",
      },
    ],
  );
}

function createGltfMeshConstructionReport(aperture, config) {
  const baseMesh = aperture.createPlaneMeshAsset({
    label: "GltfStandardBaseColorPlane",
    width: 0.78,
    height: 0.9,
  });
  const mesh = config.usesNormalTexture
    ? createTangentPlaneMeshAsset(baseMesh)
    : config.usesBaseColorUv1
      ? createUv1PlaneMeshAsset(baseMesh, uv1Coordinate)
      : baseMesh;

  return {
    valid: true,
    meshes: [
      {
        handleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        mesh,
      },
    ],
    diagnostics: [],
  };
}

function createStatus(aperture, app, scene, report) {
  const snapshot = report.snapshot;
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const pipelineKeys = snapshot.meshDraws.map(
    (draw) => draw.batchKey.pipelineKey,
  );
  const meshLayoutKeys = snapshot.meshDraws.map(
    (draw) => draw.batchKey.meshLayoutKey,
  );

  const expectedFailure = scene.expectedFailure;
  const ok =
    expectedFailure === null
      ? report.ok && scene.registration.valid
      : !report.ok && scene.registration.valid;

  return {
    ...baseStatus,
    ok,
    phase:
      expectedFailure === null
        ? report.ok && scene.registration.valid
          ? "rendered"
          : "render"
        : "expected-failure",
    ...(expectedFailure === null
      ? {}
      : {
          expectedFailure: true,
          expectedMappingDiagnostic: expectedFailure.mappingDiagnostic,
          expectedDiagnostic: expectedFailure.renderDiagnostic,
          expectedTextureStatus: expectedFailure.status,
        }),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    gltf: {
      assetMapping: {
        valid: scene.assetMapping.valid,
        textureCount: scene.assetMapping.textures.length,
        samplerCount: scene.assetMapping.samplers.length,
        materialCount: scene.assetMapping.materials.length,
        diagnostics: scene.assetMapping.diagnostics.length,
        diagnosticCodes: scene.assetMapping.diagnostics.map(
          (diagnostic) => diagnostic.code,
        ),
        samplers: scene.assetMapping.samplers.map((sampler) =>
          createSamplerMappingStatus(sampler),
        ),
      },
      meshConstruction: {
        valid: scene.meshConstruction.valid,
        meshCount: scene.meshConstruction.meshes.length,
        diagnostics: scene.meshConstruction.diagnostics.length,
      },
      registration: {
        valid: scene.registration.valid,
        stages: scene.registration.stages,
        diagnostics: scene.registration.diagnostics.length,
        written: scene.registration.stages.reduce(
          (total, stage) => total + stage.writtenCount,
          0,
        ),
      },
    },
    standardMaterial: createStandardMaterialStatus(aperture, scene),
    ...createStandardTextureStatus(aperture, scene),
    ...(scene.expectedBackface === null
      ? {}
      : {
          backface: {
            sample: scene.expectedBackface.sample,
            expectedColor: scene.expectedBackface.expectedColor,
          },
        }),
    ...(reportJson.materialDependencyReadiness === undefined
      ? {}
      : {
          materialDependencyReadiness: reportJson.materialDependencyReadiness,
        }),
    ...(reportJson.diagnosticsSummary === undefined
      ? {}
      : { diagnosticsSummary: reportJson.diagnosticsSummary }),
    ...(report.readback === undefined ? {} : { readback: report.readback }),
    extraction: {
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
    resources: {
      textureResourcesCreated: report.resourceReuse.textureResourcesCreated,
      samplerResourcesCreated: report.resourceReuse.samplerResourcesCreated,
      materialBuffersCreated: report.resourceReuse.materialBuffersCreated,
      bindGroupsCreated: report.resourceReuse.materialBindGroupsCreated,
    },
    pipelines: {
      keys: pipelineKeys,
      meshLayoutKeys,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    diagnosticCodes: [...snapshot.diagnostics, ...report.diagnostics].map(
      (diagnostic) => diagnostic.code,
    ),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      severity: diagnostic.severity,
    })),
  };
}

function createStandardMaterialStatus(aperture, scene) {
  return {
    meshKey: aperture.assetHandleKey(scene.mesh),
    materialKey: aperture.assetHandleKey(scene.material),
    renderState: {
      source: scene.expectedRenderState?.source ?? null,
      mapped:
        scene.assetMapping.materials[0]?.material.renderState ??
        scene.expectedRenderState?.mapped ??
        null,
    },
  };
}

function createStandardTextureStatus(aperture, scene) {
  if (scene.textureSlot === null) {
    return {};
  }
  const readiness = aperture.createStandardMaterialTextureReadinessReport({
    registry: scene.app.assets,
    material: scene.material,
  });

  return {
    standardTexture: {
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      textureKey: `texture:gltf:texture:0:${scene.textureSlot}`,
      samplerKey: `sampler:gltf:sampler:0:${scene.textureSlot}`,
      textureSlot: scene.textureSlot,
      samplerMapping: createSamplerMappingStatus(
        scene.assetMapping.samplers[0],
      ),
      expectedTextureColor: scene.expectedTextureColor,
      expectedUntransformedTextureColor:
        scene.expectedUntransformedTextureColor,
      expectedTexCoord: scene.expectedTexCoord,
      expectedUv1: scene.expectedUv1,
      expectedMetallicRoughness: scene.expectedMetallicRoughness,
      expectedNormalMap: scene.expectedNormalMap,
      expectedOcclusion: scene.expectedOcclusion,
      expectedEmissive: scene.expectedEmissive,
      expectedAlphaMaskTexture: scene.expectedAlphaMaskTexture,
      expectedDelayedDependencies: scene.expectedDelayedDependencies,
      expectedTextureTransform: scene.expectedTextureTransform,
      readiness:
        aperture.standardMaterialTextureReadinessReportToJsonValue(readiness),
      sample: scene.samplePoint,
      samples:
        scene.expectedAlphaMaskTexture === null
          ? undefined
          : {
              opaque: scene.expectedAlphaMaskTexture.opaqueSample,
              masked: scene.expectedAlphaMaskTexture.maskedSample,
            },
    },
  };
}

function createTangentPlaneMeshAsset(mesh) {
  const stream = mesh.vertexStreams[0];

  if (stream === undefined) {
    throw new Error(
      "Expected plane mesh fixture to provide one vertex stream.",
    );
  }

  const source = stream.data;
  const sourceStrideFloats = stream.arrayStride / 4;
  const targetStrideFloats = 12;
  const data = new Float32Array(stream.vertexCount * targetStrideFloats);

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const sourceOffset = vertex * sourceStrideFloats;
    const targetOffset = vertex * targetStrideFloats;

    data.set(source.subarray(sourceOffset, sourceOffset + 8), targetOffset);
    data.set([1, 0, 0, 1], targetOffset + 8);
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: "gltf-standard-plane-tangent",
        arrayStride: targetStrideFloats * 4,
        attributes: [
          ...stream.attributes,
          { semantic: "TANGENT", format: "float32x4", offset: 32 },
        ],
        data,
      },
    ],
  };
}

function createUv1PlaneMeshAsset(mesh, uv1) {
  const stream = mesh.vertexStreams[0];

  if (stream === undefined) {
    throw new Error(
      "Expected plane mesh fixture to provide one vertex stream.",
    );
  }

  const source = stream.data;
  const sourceStrideFloats = stream.arrayStride / 4;
  const targetStrideFloats = sourceStrideFloats + 2;
  const data = new Float32Array(stream.vertexCount * targetStrideFloats);

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const sourceOffset = vertex * sourceStrideFloats;
    const targetOffset = vertex * targetStrideFloats;

    data.set(
      source.subarray(sourceOffset, sourceOffset + sourceStrideFloats),
      targetOffset,
    );
    data.set([uv1.u, uv1.v], targetOffset + sourceStrideFloats);
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: "gltf-standard-plane-uv1",
        arrayStride: targetStrideFloats * 4,
        attributes: [
          ...stream.attributes,
          {
            semantic: "TEXCOORD_1",
            format: "float32x2",
            offset: stream.arrayStride,
          },
        ],
        data,
      },
    ],
  };
}

function createSamplerMappingStatus(plannedSampler) {
  return {
    handleKey: plannedSampler?.handleKey ?? null,
    textureIndex: plannedSampler?.textureIndex ?? null,
    slot: plannedSampler?.slot ?? null,
    source: {
      magFilter: gltfSamplerSource.magFilter,
      minFilter: gltfSamplerSource.minFilter,
      wrapS: gltfSamplerSource.wrapS,
      wrapT: gltfSamplerSource.wrapT,
    },
    mapped:
      plannedSampler?.sampler === null || plannedSampler?.sampler === undefined
        ? null
        : {
            kind: plannedSampler.sampler.kind,
            label: plannedSampler.sampler.label,
            addressModeU: plannedSampler.sampler.addressModeU,
            addressModeV: plannedSampler.sampler.addressModeV,
            addressModeW: plannedSampler.sampler.addressModeW,
            magFilter: plannedSampler.sampler.magFilter,
            minFilter: plannedSampler.sampler.minFilter,
            mipmapFilter: plannedSampler.sampler.mipmapFilter,
            lodMinClamp: plannedSampler.sampler.lodMinClamp,
            lodMaxClamp: plannedSampler.sampler.lodMaxClamp,
            maxAnisotropy: plannedSampler.sampler.maxAnisotropy,
          },
  };
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
