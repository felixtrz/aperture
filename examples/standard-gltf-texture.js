const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const scalarColor = [0.95, 0.1, 0.08, 1];
const expectedTextureColor = [0.09375, 0.5, 1, 1];
const metallicRoughness = { metallic: 64 / 255, roughness: 16 / 255 };
const normalMapVector = { x: 192 / 255, y: 64 / 255, z: 16 / 255 };
const fullNormalMapScale = 2;
const reducedNormalMapScale = 0.25;
const occlusionValue = 32 / 255;
const occlusion = { red: occlusionValue, strength: 1 };
const partialOcclusion = { red: occlusionValue, strength: 0.25 };
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
const alphaBlendTexture = {
  source: {
    alphaMode: "BLEND",
    alphaCutoff: 0.5,
    doubleSided: false,
  },
  opaqueColor: alphaMaskTexture.opaqueColor,
  translucentColor: alphaMaskTexture.maskedColor,
  opaqueSample: alphaMaskTexture.opaqueSample,
  translucentSample: alphaMaskTexture.maskedSample,
};
const alphaBlendDoubleSided = {
  source: {
    alphaMode: "BLEND",
    alphaCutoff: 0.5,
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
const textureTransformRotationSampling = {
  transform: { offset: [0.5, 0.5], rotation: Math.PI / 2, scale: [1, 1] },
  sample: { id: "rotated", x: 0.5, y: 0.5 },
  authoredUv0: { u: 0.2, v: 0.2 },
  expectedColor: [0.05, 0.95, 0.1, 1],
  offsetScaleOnlyColor: [0.95, 0.95, 0.05, 1],
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
const metallicRoughnessUv1TransformTextureBytes = new Uint8Array([
  0, 255, 0, 255, 0, 255, 255, 255, 0, 255, 0, 255, 0, 255, 255, 255,
]);
const normalTextureBytes = new Uint8Array([
  192, 64, 16, 255, 192, 64, 16, 255, 192, 64, 16, 255, 192, 64, 16, 255,
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
const textureTransformRotationSamplingBytes = new Uint8Array([
  242, 242, 13, 255, 242, 242, 13, 255, 13, 242, 26, 255, 13, 242, 26, 255, 242,
  242, 13, 255, 242, 242, 13, 255, 13, 242, 26, 255, 13, 242, 26, 255, 242, 13,
  13, 255, 242, 13, 13, 255, 24, 128, 255, 255, 24, 128, 255, 255, 242, 13, 13,
  255, 242, 13, 13, 255, 24, 128, 255, 255, 24, 128, 255, 255,
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
  "base-color-format-color-space-mismatch": {
    mappingDiagnostic: null,
    renderDiagnostic: "render.standardMaterialTexture.invalidColorSpaceFormat",
    status: "format-color-space-mismatch",
  },
  "unsupported-required-material-extension": {
    mappingDiagnostic: "gltfMaterial.unsupportedRequiredExtension",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "unsupported-required-material-extension",
    registrationValid: false,
  },
  "invalid-render-state": {
    mappingDiagnostic: "gltfMaterial.invalidField",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "invalid-render-state",
    registrationValid: false,
  },
  "invalid-material-scalar": {
    mappingDiagnostic: "gltfMaterial.invalidField",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "invalid-material-scalar",
    registrationValid: false,
  },
  "invalid-vector-factor": {
    mappingDiagnostic: "gltfMaterial.invalidField",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "invalid-vector-factor",
    registrationValid: false,
  },
  "invalid-texture-scalar": {
    mappingDiagnostic: "gltfMaterial.invalidField",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "invalid-texture-scalar",
    registrationValid: false,
  },
  "unresolved-texture-binding": {
    mappingDiagnostic: "gltfMaterial.unresolvedTextureBinding",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "unresolved-texture-binding",
    registrationValid: false,
  },
  "invalid-texture-info": {
    mappingDiagnostic: "gltfMaterial.invalidTextureInfo",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "invalid-texture-info",
    registrationValid: false,
  },
  "invalid-sampler-index": {
    mappingDiagnostic: "gltfMaterial.unresolvedTextureBinding",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "invalid-sampler-index",
    registrationValid: false,
  },
  "invalid-sampler-enum": {
    mappingDiagnostic: "gltfMaterial.unresolvedTextureBinding",
    renderDiagnostic: "render.missingMaterialHandle",
    status: "invalid-sampler-enum",
    registrationValid: false,
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
  applyFormatColorSpaceMismatchScenario(aperture, app, config);
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
      intensity: config.usesNormalTexture ? 0.25 : 0.72,
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
    expectedOffsetScaleTextureColor: config.expectedOffsetScaleTextureColor,
    expectedTexCoord: config.expectedTexCoord,
    expectedUv1: config.expectedUv1,
    expectedMetallicRoughness: config.expectedMetallicRoughness,
    expectedNormalMap: config.expectedNormalMap,
    expectedNormalScale: config.expectedNormalScale,
    expectedOcclusion: config.expectedOcclusion,
    expectedEmissive: config.expectedEmissive,
    expectedAlphaMaskTexture: config.expectedAlphaMaskTexture,
    expectedAlphaBlendTexture: config.expectedAlphaBlendTexture,
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
  const usesBaseColorTransformRotationSampling =
    selectedScenario === "base-color-transform-rotation-sampling";
  const usesBaseColorUv1 = selectedScenario === "base-color-uv1";
  const usesBaseColorUv1Missing = selectedScenario === "base-color-uv1-missing";
  const usesBaseColorUv1Transform =
    selectedScenario === "base-color-uv1-transform";
  const usesAnyBaseColorUv1 =
    usesBaseColorUv1 || usesBaseColorUv1Missing || usesBaseColorUv1Transform;
  const usesBaseColorMetallicRoughness =
    selectedScenario === "base-color-metallic-roughness" ||
    selectedScenario === "base-color-metallic-roughness-normal";
  const usesBaseColorMetallicRoughnessNormal =
    selectedScenario === "base-color-metallic-roughness-normal";
  const usesBaseColorOcclusionEmissive =
    selectedScenario === "base-color-occlusion-emissive";
  const usesBaseColorAlphaMaskEmissive =
    selectedScenario === "base-color-alpha-mask-emissive";
  const usesMetallicRoughnessTexture =
    selectedScenario === "metallic-roughness";
  const usesMetallicRoughnessTextureTransform =
    selectedScenario === "metallic-roughness-transform";
  const usesMetallicRoughnessUv1 =
    selectedScenario === "metallic-roughness-uv1";
  const usesMetallicRoughnessUv1Transform =
    selectedScenario === "metallic-roughness-uv1-transform";
  const usesAnyMetallicRoughnessTexture =
    usesMetallicRoughnessTexture ||
    usesMetallicRoughnessTextureTransform ||
    usesMetallicRoughnessUv1 ||
    usesMetallicRoughnessUv1Transform;
  const usesAnyMetallicRoughnessUv1 =
    usesMetallicRoughnessUv1 || usesMetallicRoughnessUv1Transform;
  const usesNormalTextureTransform =
    selectedScenario === "normal-map-transform";
  const usesNormalTextureScale = selectedScenario === "normal-map-scale";
  const usesNormalTexture =
    selectedScenario === "normal-map" ||
    usesNormalTextureScale ||
    usesNormalTextureTransform ||
    usesBaseColorMetallicRoughnessNormal;
  const usesOcclusionTextureTransform =
    selectedScenario === "occlusion-transform";
  const usesOcclusionTextureStrength =
    selectedScenario === "occlusion-strength";
  const usesInvalidTextureScalar =
    selectedScenario === "invalid-texture-scalar";
  const usesOcclusionTexture =
    selectedScenario === "occlusion" ||
    usesOcclusionTextureStrength ||
    usesOcclusionTextureTransform ||
    usesInvalidTextureScalar ||
    usesBaseColorOcclusionEmissive;
  const usesEmissiveTextureTransform =
    selectedScenario === "emissive-transform";
  const usesEmissiveTexture =
    selectedScenario === "emissive" ||
    usesEmissiveTextureTransform ||
    usesBaseColorOcclusionEmissive ||
    usesBaseColorAlphaMaskEmissive;
  const usesAlphaMaskDoubleSided =
    selectedScenario === "alpha-mask-double-sided";
  const usesAlphaMaskTexture =
    selectedScenario === "alpha-mask-texture" || usesBaseColorAlphaMaskEmissive;
  const usesAlphaMaskBackface = selectedScenario === "alpha-mask-backface";
  const usesAlphaBlendTexturePixels =
    selectedScenario === "alpha-blend-texture";
  const usesAlphaBlendTexture =
    selectedScenario === "alpha-blend" || usesAlphaBlendTexturePixels;
  const usesAlphaBlendDoubleSided =
    selectedScenario === "alpha-blend-double-sided";
  const usesDelayedDependencies = selectedScenario === "delayed-dependencies";
  const usesFormatColorSpaceMismatch =
    selectedScenario === "base-color-format-color-space-mismatch";
  const usesUnsupportedRequiredMaterialExtension =
    selectedScenario === "unsupported-required-material-extension";
  const usesUnsupportedOptionalMaterialExtension =
    selectedScenario === "unsupported-optional-material-extension";
  const usesMultipleOptionalMaterialExtensions =
    selectedScenario === "multiple-optional-material-extensions";
  const usesInvalidRenderState = selectedScenario === "invalid-render-state";
  const usesInvalidMaterialScalar =
    selectedScenario === "invalid-material-scalar";
  const usesInvalidVectorFactor = selectedScenario === "invalid-vector-factor";
  const usesUnresolvedTextureBinding =
    selectedScenario === "unresolved-texture-binding";
  const usesInvalidTextureInfo = selectedScenario === "invalid-texture-info";
  const usesInvalidSamplerIndex = selectedScenario === "invalid-sampler-index";
  const usesInvalidSamplerEnum = selectedScenario === "invalid-sampler-enum";

  return {
    usesBaseColorTransform,
    usesBaseColorTransformSampling,
    usesBaseColorTransformRotationSampling,
    usesBaseColorUv1,
    usesBaseColorUv1Missing,
    usesBaseColorUv1Transform,
    usesAnyBaseColorUv1,
    usesBaseColorMetallicRoughness,
    usesBaseColorMetallicRoughnessNormal,
    usesBaseColorOcclusionEmissive,
    usesBaseColorAlphaMaskEmissive,
    usesMetallicRoughnessTexture,
    usesMetallicRoughnessTextureTransform,
    usesMetallicRoughnessUv1,
    usesMetallicRoughnessUv1Transform,
    usesAnyMetallicRoughnessTexture,
    usesAnyMetallicRoughnessUv1,
    usesNormalTextureScale,
    usesNormalTextureTransform,
    usesNormalTexture,
    usesOcclusionTextureTransform,
    usesOcclusionTexture,
    usesEmissiveTextureTransform,
    usesEmissiveTexture,
    usesAlphaMaskDoubleSided,
    usesAlphaMaskTexture,
    usesAlphaMaskBackface,
    usesAlphaBlendTexturePixels,
    usesAlphaBlendTexture,
    usesAlphaBlendDoubleSided,
    usesDelayedDependencies,
    usesFormatColorSpaceMismatch,
    usesUnsupportedRequiredMaterialExtension,
    usesUnsupportedOptionalMaterialExtension,
    usesMultipleOptionalMaterialExtensions,
    usesInvalidRenderState,
    usesInvalidMaterialScalar,
    usesInvalidVectorFactor,
    usesInvalidTextureScalar,
    usesUnresolvedTextureBinding,
    usesInvalidTextureInfo,
    usesInvalidSamplerIndex,
    usesInvalidSamplerEnum,
    textureSlot:
      usesUnsupportedRequiredMaterialExtension ||
      usesInvalidRenderState ||
      usesInvalidMaterialScalar ||
      usesInvalidVectorFactor ||
      usesInvalidTextureInfo
        ? null
        : usesBaseColorMetallicRoughness ||
            usesBaseColorOcclusionEmissive ||
            usesBaseColorAlphaMaskEmissive
          ? "baseColorTexture"
          : usesAnyMetallicRoughnessTexture
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
                      : usesAlphaBlendDoubleSided
                        ? null
                        : "baseColorTexture",
    materialModel: usesMetallicRoughnessTexture
      ? "gltf-standard-metallic-roughness-texture"
      : usesMetallicRoughnessTextureTransform
        ? "gltf-standard-metallic-roughness-transform"
        : usesMetallicRoughnessUv1
          ? "gltf-standard-metallic-roughness-uv1"
          : usesMetallicRoughnessUv1Transform
            ? "gltf-standard-metallic-roughness-uv1-transform"
            : usesBaseColorAlphaMaskEmissive
              ? "gltf-standard-base-color-alpha-mask-emissive"
              : usesBaseColorOcclusionEmissive
                ? "gltf-standard-base-color-occlusion-emissive"
                : usesBaseColorMetallicRoughnessNormal
                  ? "gltf-standard-base-color-metallic-roughness-normal"
                  : usesBaseColorMetallicRoughness
                    ? "gltf-standard-base-color-metallic-roughness"
                    : usesNormalTextureScale
                      ? "gltf-standard-normal-scale"
                      : usesNormalTextureTransform
                        ? "gltf-standard-normal-transform"
                        : usesNormalTexture
                          ? "gltf-standard-normal-texture"
                          : usesOcclusionTextureTransform
                            ? "gltf-standard-occlusion-transform"
                            : usesInvalidTextureScalar
                              ? "gltf-standard-invalid-texture-scalar"
                              : usesOcclusionTextureStrength
                                ? "gltf-standard-occlusion-strength"
                                : usesOcclusionTexture
                                  ? "gltf-standard-occlusion-texture"
                                  : usesEmissiveTextureTransform
                                    ? "gltf-standard-emissive-transform"
                                    : usesEmissiveTexture
                                      ? "gltf-standard-emissive-texture"
                                      : usesAlphaMaskDoubleSided
                                        ? "gltf-standard-alpha-mask-double-sided"
                                        : usesAlphaMaskTexture
                                          ? "gltf-standard-alpha-mask-texture"
                                          : usesAlphaMaskBackface
                                            ? "gltf-standard-alpha-mask-backface"
                                            : usesAlphaBlendTexture
                                              ? usesAlphaBlendTexturePixels
                                                ? "gltf-standard-alpha-blend-texture"
                                                : "gltf-standard-alpha-blend"
                                              : usesAlphaBlendDoubleSided
                                                ? "gltf-standard-alpha-blend-double-sided"
                                                : usesDelayedDependencies
                                                  ? "gltf-standard-delayed-dependencies"
                                                  : usesFormatColorSpaceMismatch
                                                    ? "gltf-standard-base-color-format-color-space-mismatch"
                                                    : usesUnsupportedRequiredMaterialExtension
                                                      ? "gltf-standard-unsupported-required-material-extension"
                                                      : usesUnsupportedOptionalMaterialExtension
                                                        ? "gltf-standard-unsupported-optional-material-extension"
                                                        : usesMultipleOptionalMaterialExtensions
                                                          ? "gltf-standard-multiple-optional-material-extensions"
                                                          : usesInvalidRenderState
                                                            ? "gltf-standard-invalid-render-state"
                                                            : usesInvalidMaterialScalar
                                                              ? "gltf-standard-invalid-material-scalar"
                                                              : usesInvalidVectorFactor
                                                                ? "gltf-standard-invalid-vector-factor"
                                                                : usesUnresolvedTextureBinding
                                                                  ? "gltf-standard-unresolved-texture-binding"
                                                                  : usesInvalidTextureInfo
                                                                    ? "gltf-standard-invalid-texture-info"
                                                                    : usesInvalidSamplerIndex
                                                                      ? "gltf-standard-invalid-sampler-index"
                                                                      : usesInvalidSamplerEnum
                                                                        ? "gltf-standard-invalid-sampler-enum"
                                                                        : usesBaseColorTransformSampling
                                                                          ? "gltf-standard-base-color-transform-sampling"
                                                                          : usesBaseColorTransformRotationSampling
                                                                            ? "gltf-standard-base-color-transform-rotation-sampling"
                                                                            : usesBaseColorUv1
                                                                              ? "gltf-standard-base-color-uv1"
                                                                              : usesBaseColorUv1Missing
                                                                                ? "gltf-standard-base-color-uv1-missing"
                                                                                : usesBaseColorUv1Transform
                                                                                  ? "gltf-standard-base-color-uv1-transform"
                                                                                  : "gltf-standard-base-color-texture",
    expectedFailure: expectedGltfFailures[selectedScenario] ?? null,
    expectedTextureTransform: usesBaseColorTransform
      ? unsupportedTextureTransform
      : usesBaseColorTransformSampling
        ? textureTransformSampling.transform
        : usesBaseColorTransformRotationSampling
          ? textureTransformRotationSampling.transform
          : usesBaseColorUv1Transform ||
              usesMetallicRoughnessTextureTransform ||
              usesMetallicRoughnessUv1Transform ||
              usesNormalTextureTransform ||
              usesOcclusionTextureTransform ||
              usesEmissiveTextureTransform
            ? textureTransformSampling.transform
            : null,
    expectedTextureColor:
      usesBaseColorMetallicRoughness ||
      usesBaseColorOcclusionEmissive ||
      usesBaseColorAlphaMaskEmissive
        ? expectedTextureColor
        : usesBaseColorTransformSampling
          ? textureTransformSampling.expectedColor
          : usesBaseColorTransformRotationSampling
            ? textureTransformRotationSampling.expectedColor
            : usesBaseColorUv1Transform
              ? textureTransformSampling.expectedColor
              : usesBaseColorUv1
                ? uv1Texture.expectedColor
                : usesAnyMetallicRoughnessTexture ||
                    usesNormalTexture ||
                    usesOcclusionTexture
                  ? null
                  : usesEmissiveTexture
                    ? null
                    : expectedTextureColor,
    expectedUntransformedTextureColor: usesBaseColorTransformSampling
      ? textureTransformSampling.untransformedColor
      : usesBaseColorTransformRotationSampling
        ? textureTransformRotationSampling.untransformedColor
        : usesBaseColorUv1Transform
          ? textureTransformSampling.untransformedColor
          : usesBaseColorUv1
            ? uv1Texture.rejectedUv0Color
            : null,
    expectedOffsetScaleTextureColor: usesBaseColorTransformRotationSampling
      ? textureTransformRotationSampling.offsetScaleOnlyColor
      : null,
    expectedTexCoord:
      usesAnyBaseColorUv1 || usesAnyMetallicRoughnessUv1 ? 1 : 0,
    expectedUv1:
      usesBaseColorUv1 ||
      usesBaseColorUv1Transform ||
      usesAnyMetallicRoughnessUv1
        ? uv1Coordinate
        : null,
    expectedMetallicRoughness: usesMetallicRoughnessUv1Transform
      ? { metallic: 1, roughness: 1 }
      : usesMetallicRoughnessUv1
        ? { metallic: 0, roughness: 1 }
        : usesBaseColorMetallicRoughness ||
            usesMetallicRoughnessTexture ||
            usesMetallicRoughnessTextureTransform
          ? metallicRoughness
          : null,
    expectedNormalMap: usesNormalTexture ? normalMapVector : null,
    expectedNormalScale: usesNormalTexture
      ? usesNormalTextureScale
        ? reducedNormalMapScale
        : fullNormalMapScale
      : null,
    expectedOcclusion: usesOcclusionTexture
      ? usesOcclusionTextureStrength
        ? partialOcclusion
        : occlusion
      : null,
    expectedEmissive: usesEmissiveTexture
      ? { factor: emissiveFactor, color: emissiveColor }
      : null,
    expectedAlphaMaskTexture: usesAlphaMaskTexture ? alphaMaskTexture : null,
    expectedAlphaBlendTexture: usesAlphaBlendTexturePixels
      ? alphaBlendTexture
      : null,
    expectedBackface: usesAlphaMaskBackface
      ? alphaMaskBackface
      : usesAlphaBlendDoubleSided
        ? alphaBlendDoubleSided
        : null,
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
        : usesAlphaBlendTexture
          ? {
              source: alphaBlendTexture.source,
              mapped: {
                alphaMode: "blend",
                alphaCutoff: alphaBlendTexture.source.alphaCutoff,
                cullMode: "back",
                depth: { test: true, write: false, compare: "less" },
                blend: { preset: "alpha" },
              },
            }
          : usesAlphaBlendDoubleSided
            ? {
                source: alphaBlendDoubleSided.source,
                mapped: {
                  alphaMode: "blend",
                  alphaCutoff: alphaBlendDoubleSided.source.alphaCutoff,
                  cullMode: "none",
                  depth: { test: true, write: false, compare: "less" },
                  blend: { preset: "alpha" },
                },
              }
            : null,
    samplePoint:
      usesBaseColorTransformSampling ||
      usesBaseColorUv1Transform ||
      usesMetallicRoughnessUv1Transform
        ? textureTransformSampling.sample
        : usesBaseColorTransformRotationSampling
          ? textureTransformRotationSampling.sample
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
    : config.usesMetallicRoughnessTextureTransform
      ? "GLB Standard MetallicRoughness Transform"
      : config.usesMetallicRoughnessUv1
        ? "GLB Standard MetallicRoughness UV1"
        : config.usesMetallicRoughnessUv1Transform
          ? "GLB Standard MetallicRoughness UV1 Transform"
          : config.usesBaseColorAlphaMaskEmissive
            ? "GLB Standard BaseColor AlphaMask Emissive"
            : config.usesBaseColorOcclusionEmissive
              ? "GLB Standard BaseColor Occlusion Emissive"
              : config.usesBaseColorMetallicRoughnessNormal
                ? "GLB Standard BaseColor MetallicRoughness Normal"
                : config.usesBaseColorMetallicRoughness
                  ? "GLB Standard BaseColor MetallicRoughness"
                  : config.usesNormalTextureScale
                    ? "GLB Standard Normal Scale"
                    : config.usesNormalTextureTransform
                      ? "GLB Standard Normal Transform"
                      : config.usesNormalTexture
                        ? "GLB Standard Normal"
                        : config.usesOcclusionTextureTransform
                          ? "GLB Standard Occlusion Transform"
                          : config.usesOcclusionTexture
                            ? "GLB Standard Occlusion"
                            : config.usesEmissiveTextureTransform
                              ? "GLB Standard Emissive Transform"
                              : config.usesEmissiveTexture
                                ? "GLB Standard Emissive"
                                : config.usesAlphaMaskDoubleSided
                                  ? "GLB Standard Alpha Mask Double Sided"
                                  : config.usesAlphaMaskTexture
                                    ? "GLB Standard Alpha Mask Texture"
                                    : config.usesAlphaMaskBackface
                                      ? "GLB Standard Alpha Mask Backface"
                                      : config.usesAlphaBlendTexture
                                        ? config.usesAlphaBlendTexturePixels
                                          ? "GLB Standard Alpha Blend Texture"
                                          : "GLB Standard Alpha Blend"
                                        : config.usesAlphaBlendDoubleSided
                                          ? "GLB Standard Alpha Blend Double Sided"
                                          : config.usesDelayedDependencies
                                            ? "GLB Standard Delayed Dependencies"
                                            : config.usesUnsupportedRequiredMaterialExtension
                                              ? "GLB Standard Unsupported Required Extension"
                                              : config.usesUnsupportedOptionalMaterialExtension
                                                ? "GLB Standard Unsupported Optional Extension"
                                                : config.usesInvalidRenderState
                                                  ? "GLB Standard Invalid Render State"
                                                  : config.usesInvalidMaterialScalar
                                                    ? "GLB Standard Invalid Material Scalar"
                                                    : config.usesInvalidVectorFactor
                                                      ? "GLB Standard Invalid Vector Factor"
                                                      : config.usesInvalidTextureScalar
                                                        ? "GLB Standard Invalid Texture Scalar"
                                                        : config.usesUnresolvedTextureBinding
                                                          ? "GLB Standard Unresolved Texture Binding"
                                                          : config.usesInvalidTextureInfo
                                                            ? "GLB Standard Invalid Texture Info"
                                                            : config.usesBaseColorTransformSampling
                                                              ? "GLB Standard BaseColor Transform Sampling"
                                                              : config.usesBaseColorTransformRotationSampling
                                                                ? "GLB Standard BaseColor Transform Rotation Sampling"
                                                                : config.usesBaseColorUv1
                                                                  ? "GLB Standard BaseColor UV1"
                                                                  : config.usesBaseColorUv1Missing
                                                                    ? "GLB Standard BaseColor UV1 Missing"
                                                                    : config.usesInvalidSamplerIndex
                                                                      ? "GLB Standard Invalid Sampler Index"
                                                                      : config.usesInvalidSamplerEnum
                                                                        ? "GLB Standard Invalid Sampler Enum"
                                                                        : config.usesBaseColorUv1Transform
                                                                          ? "GLB Standard BaseColor UV1 Transform"
                                                                          : "GLB Standard BaseColor";
}

function readbackSamplesForConfig(config) {
  if (config.expectedAlphaMaskTexture !== null) {
    return [
      config.expectedAlphaMaskTexture.opaqueSample,
      config.expectedAlphaMaskTexture.maskedSample,
    ];
  }

  if (config.expectedAlphaBlendTexture !== null) {
    return [
      config.expectedAlphaBlendTexture.opaqueSample,
      config.expectedAlphaBlendTexture.translucentSample,
    ];
  }

  if (config.expectedBackface !== null) {
    return [config.expectedBackface.sample];
  }

  return [config.samplePoint];
}

function createGltfFixtureRoot(config) {
  let pbrMetallicRoughness;

  if (
    config.usesUnsupportedRequiredMaterialExtension ||
    config.usesInvalidRenderState
  ) {
    pbrMetallicRoughness = {
      baseColorFactor: scalarColor,
      metallicFactor: 0,
      roughnessFactor: 0.8,
    };
  } else if (config.usesInvalidMaterialScalar) {
    pbrMetallicRoughness = {
      baseColorFactor: scalarColor,
      metallicFactor: "metallic",
      roughnessFactor: 0.8,
    };
  } else if (config.usesInvalidVectorFactor) {
    pbrMetallicRoughness = {
      baseColorFactor: "hot-pink",
      metallicFactor: 0,
      roughnessFactor: 0.8,
    };
  } else if (config.usesInvalidTextureInfo) {
    pbrMetallicRoughness = {
      baseColorFactor: [1, 1, 1, 1],
      baseColorTexture: { index: "zero", texCoord: "uv1" },
      metallicFactor: 0,
      roughnessFactor: 0.8,
    };
  } else if (
    config.usesBaseColorMetallicRoughness ||
    config.usesBaseColorOcclusionEmissive ||
    config.usesBaseColorAlphaMaskEmissive
  ) {
    pbrMetallicRoughness = {
      baseColorFactor: [1, 1, 1, 1],
      baseColorTexture: { index: 0 },
      metallicFactor: config.usesBaseColorMetallicRoughness ? 1 : 0,
      roughnessFactor: config.usesBaseColorMetallicRoughness ? 1 : 0.8,
      ...(config.usesBaseColorMetallicRoughness
        ? { metallicRoughnessTexture: { index: 1 } }
        : {}),
    };
  } else if (config.usesAnyMetallicRoughnessTexture) {
    pbrMetallicRoughness = {
      baseColorFactor: scalarColor,
      metallicFactor: 1,
      roughnessFactor: 1,
      metallicRoughnessTexture: {
        index: 0,
        ...(config.usesAnyMetallicRoughnessUv1 ? { texCoord: 1 } : {}),
        ...(config.expectedTextureTransform === null
          ? {}
          : {
              extensions: {
                KHR_texture_transform: config.expectedTextureTransform,
              },
            }),
      },
    };
  } else if (
    config.usesNormalTexture ||
    config.usesOcclusionTexture ||
    config.usesEmissiveTexture ||
    config.usesAlphaMaskDoubleSided ||
    config.usesAlphaMaskBackface ||
    config.usesAlphaBlendDoubleSided
  ) {
    pbrMetallicRoughness = {
      baseColorFactor: scalarColor,
      metallicFactor: 0,
      roughnessFactor: 0.8,
    };
  } else if (
    config.usesAlphaMaskTexture ||
    config.usesAlphaBlendTexture ||
    config.usesDelayedDependencies ||
    config.usesInvalidSamplerIndex ||
    config.usesInvalidSamplerEnum
  ) {
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
        ...(config.usesBaseColorTransform
          ? { texCoord: 2 }
          : config.usesAnyBaseColorUv1
            ? { texCoord: 1 }
            : {}),
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
    ...(config.usesUnsupportedRequiredMaterialExtension
      ? { extensions: { KHR_materials_clearcoat: {} } }
      : {}),
    ...(config.usesUnsupportedOptionalMaterialExtension
      ? { extensions: { KHR_materials_clearcoat: {} } }
      : {}),
    ...(config.usesMultipleOptionalMaterialExtensions
      ? {
          extensions: {
            KHR_materials_clearcoat: {},
            KHR_materials_transmission: {},
          },
        }
      : {}),
    ...(config.usesInvalidRenderState
      ? {
          alphaMode: "CUTOUT",
          alphaCutoff: 1.5,
          doubleSided: "true",
        }
      : {}),
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
    ...(config.usesAlphaBlendTexture
      ? {
          alphaMode: alphaBlendTexture.source.alphaMode,
          alphaCutoff: alphaBlendTexture.source.alphaCutoff,
          doubleSided: alphaBlendTexture.source.doubleSided,
        }
      : {}),
    ...(config.usesAlphaBlendDoubleSided
      ? {
          alphaMode: alphaBlendDoubleSided.source.alphaMode,
          alphaCutoff: alphaBlendDoubleSided.source.alphaCutoff,
          doubleSided: alphaBlendDoubleSided.source.doubleSided,
        }
      : {}),
    ...(config.usesNormalTexture
      ? {
          normalTexture: {
            index: config.usesBaseColorMetallicRoughnessNormal ? 2 : 0,
            scale: config.expectedNormalScale,
            ...(config.usesNormalTextureTransform
              ? {
                  extensions: {
                    KHR_texture_transform: config.expectedTextureTransform,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(config.usesDelayedDependencies
      ? { normalTexture: { index: 1, scale: 1 } }
      : {}),
    ...(config.usesOcclusionTexture
      ? {
          occlusionTexture: {
            index: config.usesBaseColorOcclusionEmissive ? 1 : 0,
            strength: config.usesInvalidTextureScalar
              ? "strong"
              : config.expectedOcclusion?.strength,
            ...(config.usesOcclusionTextureTransform
              ? {
                  extensions: {
                    KHR_texture_transform: config.expectedTextureTransform,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(config.usesEmissiveTexture
      ? {
          emissiveFactor,
          emissiveTexture: {
            index: config.usesBaseColorOcclusionEmissive
              ? 2
              : config.usesBaseColorAlphaMaskEmissive
                ? 1
                : 0,
            ...(config.usesEmissiveTextureTransform
              ? {
                  extensions: {
                    KHR_texture_transform: config.expectedTextureTransform,
                  },
                }
              : {}),
          },
        }
      : {}),
  };

  return {
    asset: { version: "2.0" },
    ...(config.usesUnsupportedRequiredMaterialExtension
      ? { extensionsRequired: ["KHR_materials_clearcoat"] }
      : {}),
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
        : config.usesBaseColorMetallicRoughnessNormal
          ? {
              textures: [
                { source: 0, sampler: 0 },
                { source: 1, sampler: 1 },
                { source: 2, sampler: 2 },
              ],
              images: [
                { bufferView: 0, mimeType: "image/png", name: "BaseColor" },
                {
                  bufferView: 1,
                  mimeType: "image/png",
                  name: "MetallicRoughness",
                },
                { bufferView: 2, mimeType: "image/png", name: "Normal" },
              ],
              samplers: [
                gltfSamplerSource,
                gltfSamplerSource,
                gltfSamplerSource,
              ],
            }
          : config.usesBaseColorAlphaMaskEmissive
            ? {
                textures: [
                  { source: 0, sampler: 0 },
                  { source: 1, sampler: 1 },
                ],
                images: [
                  { bufferView: 0, mimeType: "image/png", name: "BaseColor" },
                  { bufferView: 1, mimeType: "image/png", name: "Emissive" },
                ],
                samplers: [gltfSamplerSource, gltfSamplerSource],
              }
            : config.usesBaseColorOcclusionEmissive
              ? {
                  textures: [
                    { source: 0, sampler: 0 },
                    { source: 1, sampler: 1 },
                    { source: 2, sampler: 2 },
                  ],
                  images: [
                    { bufferView: 0, mimeType: "image/png", name: "BaseColor" },
                    { bufferView: 1, mimeType: "image/png", name: "Occlusion" },
                    { bufferView: 2, mimeType: "image/png", name: "Emissive" },
                  ],
                  samplers: [
                    gltfSamplerSource,
                    gltfSamplerSource,
                    gltfSamplerSource,
                  ],
                }
              : config.usesBaseColorMetallicRoughness
                ? {
                    textures: [
                      { source: 0, sampler: 0 },
                      { source: 1, sampler: 1 },
                    ],
                    images: [
                      {
                        bufferView: 0,
                        mimeType: "image/png",
                        name: "BaseColor",
                      },
                      {
                        bufferView: 1,
                        mimeType: "image/png",
                        name: "MetallicRoughness",
                      },
                    ],
                    samplers: [gltfSamplerSource, gltfSamplerSource],
                  }
                : config.usesUnresolvedTextureBinding
                  ? {
                      textures: [{ source: 7, sampler: 0 }],
                      images: [],
                      samplers: [gltfSamplerSource],
                    }
                  : config.usesInvalidSamplerIndex
                    ? {
                        textures: [{ source: 0, sampler: 3 }],
                        images: [
                          {
                            bufferView: 0,
                            mimeType: "image/png",
                            name: "BaseColor",
                          },
                        ],
                        samplers: [gltfSamplerSource],
                      }
                    : config.usesInvalidSamplerEnum
                      ? {
                          textures: [{ source: 0, sampler: 0 }],
                          images: [
                            {
                              bufferView: 0,
                              mimeType: "image/png",
                              name: "BaseColor",
                            },
                          ],
                          samplers: [{ ...gltfSamplerSource, wrapS: "repeat" }],
                        }
                      : {
                          textures: [{ source: 0, sampler: 0 }],
                          images: [
                            {
                              bufferView: 0,
                              mimeType: "image/png",
                              name: "BaseColor",
                            },
                          ],
                          samplers: [gltfSamplerSource],
                        }),
  };
}

function textureBytesForSlot(textureSlot) {
  switch (textureSlot) {
    case "metallicRoughnessTexture":
      return scenario === "metallic-roughness-uv1" ||
        scenario === "metallic-roughness-uv1-transform"
        ? metallicRoughnessUv1TransformTextureBytes
        : metallicRoughnessTextureBytes;
    case "normalTexture":
      return normalTextureBytes;
    case "occlusionTexture":
      return occlusionTextureBytes;
    case "emissiveTexture":
      return emissiveTextureBytes;
    case "baseColorTexture":
      return scenario === "alpha-mask-texture" ||
        scenario === "base-color-alpha-mask-emissive"
        ? alphaMaskTextureBytes
        : scenario === "alpha-blend-texture"
          ? alphaMaskTextureBytes
          : scenario === "base-color-transform-sampling"
            ? textureTransformSamplingBytes
            : scenario === "base-color-transform-rotation-sampling"
              ? textureTransformRotationSamplingBytes
              : scenario === "base-color-uv1" ||
                  scenario === "base-color-uv1-missing" ||
                  scenario === "base-color-uv1-transform"
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

function applyFormatColorSpaceMismatchScenario(aperture, app, config) {
  if (!config.usesFormatColorSpaceMismatch) {
    return;
  }

  const textureHandle = aperture.createTextureHandle(
    "gltf:texture:0:baseColorTexture",
  );
  const entry = app.assets.get(textureHandle);

  if (entry?.asset === null || entry?.asset === undefined) {
    return;
  }

  app.assets.markReady(textureHandle, {
    ...entry.asset,
    format: "rgba8unorm",
    colorSpace: "srgb",
  });
}

function createGltfMeshConstructionReport(aperture, config) {
  const baseMesh = aperture.createPlaneMeshAsset({
    label: "GltfStandardBaseColorPlane",
    width: 0.78,
    height: 0.9,
  });
  const mesh = config.usesNormalTexture
    ? createTangentPlaneMeshAsset(baseMesh)
    : config.usesBaseColorTransformRotationSampling
      ? createConstantUv0PlaneMeshAsset(
          baseMesh,
          textureTransformRotationSampling.authoredUv0,
        )
      : config.usesBaseColorUv1 ||
          config.usesBaseColorUv1Transform ||
          config.usesAnyMetallicRoughnessUv1
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
  const expectedRegistrationValid =
    expectedFailure?.registrationValid === undefined
      ? true
      : expectedFailure.registrationValid;
  const ok =
    expectedFailure === null
      ? report.ok && scene.registration.valid
      : !report.ok && scene.registration.valid === expectedRegistrationValid;

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
        diagnosticDetails: scene.assetMapping.diagnostics.map((diagnostic) => ({
          layer: diagnostic.layer,
          code: diagnostic.code,
          severity: diagnostic.severity,
          message: diagnostic.message,
          materialIndex: diagnostic.materialIndex,
          textureIndex: diagnostic.textureIndex,
          samplerIndex: diagnostic.samplerIndex,
          slot: diagnostic.slot,
          field: diagnostic.field,
          extensionName: diagnostic.extensionName,
          dependencyKind: diagnostic.dependencyKind,
          value: diagnostic.value,
        })),
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
      bindGroupsCreated: report.resourceReuse.materialBindGroupsCreated ?? 0,
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
      expectedOffsetScaleTextureColor: scene.expectedOffsetScaleTextureColor,
      expectedTexCoord: scene.expectedTexCoord,
      expectedUv1: scene.expectedUv1,
      expectedMetallicRoughness: scene.expectedMetallicRoughness,
      expectedNormalMap: scene.expectedNormalMap,
      expectedNormalScale: scene.expectedNormalScale,
      expectedOcclusion: scene.expectedOcclusion,
      expectedEmissive: scene.expectedEmissive,
      expectedAlphaMaskTexture: scene.expectedAlphaMaskTexture,
      expectedAlphaBlendTexture: scene.expectedAlphaBlendTexture,
      expectedDelayedDependencies: scene.expectedDelayedDependencies,
      expectedTextureTransform: scene.expectedTextureTransform,
      readiness:
        aperture.standardMaterialTextureReadinessReportToJsonValue(readiness),
      sample: scene.samplePoint,
      samples:
        scene.expectedAlphaMaskTexture === null &&
        scene.expectedAlphaBlendTexture === null
          ? undefined
          : scene.expectedAlphaMaskTexture !== null
            ? {
                opaque: scene.expectedAlphaMaskTexture.opaqueSample,
                masked: scene.expectedAlphaMaskTexture.maskedSample,
              }
            : {
                opaque: scene.expectedAlphaBlendTexture.opaqueSample,
                masked: scene.expectedAlphaBlendTexture.translucentSample,
                translucent: scene.expectedAlphaBlendTexture.translucentSample,
              },
    },
  };
}

function createConstantUv0PlaneMeshAsset(mesh, uv) {
  const stream = mesh.vertexStreams[0];

  if (stream === undefined) {
    throw new Error(
      "Expected plane mesh fixture to provide one vertex stream.",
    );
  }

  const uvAttribute = stream.attributes.find(
    (attribute) => attribute.semantic === "TEXCOORD_0",
  );

  if (uvAttribute === undefined) {
    throw new Error("Expected plane mesh fixture to provide TEXCOORD_0.");
  }

  const source = stream.data;
  const sourceStrideFloats = stream.arrayStride / 4;
  const uvOffsetFloats = uvAttribute.offset / 4;
  const data = new Float32Array(source);

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const targetOffset = vertex * sourceStrideFloats + uvOffsetFloats;

    data.set([uv.u, uv.v], targetOffset);
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: "gltf-standard-plane-constant-uv0",
        data,
      },
    ],
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
