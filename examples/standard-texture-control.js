const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const scalarColor = [0.95, 0.1, 0.08, 1];
const textureColor = [0.09375, 0.5, 1, 1];
const uv1Coordinate = { u: 0.25, v: 0.25 };
const textureTransform = { offset: [0.25, 0] };
const uv1TextureBytes = [
  24, 128, 255, 255, 255, 32, 32, 255, 255, 255, 0, 255, 0, 255, 0, 255,
];
const linearSamplerTextureBytes = [
  255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255,
];
const linearSamplerExpectedColor = [0.5, 0, 0.5, 1];
const linearSamplerRejectedNearestColor = [1, 0, 0, 1];
const metallicRoughnessBytes = [0, 16, 64, 255];
const metallicRoughness = { metallic: 64 / 255, roughness: 16 / 255 };
const normalMapBytes = [128, 128, 16, 255];
const normalMapVector = { x: 128 / 255, y: 128 / 255, z: 16 / 255 };
const normalMapLightRotation = [0, 1, 0, 0];
const occlusionBytes = [32, 255, 255, 255];
const occlusionValue = 32 / 255;
const emissiveBytes = [255, 128, 32, 255];
const emissiveColor = [1, 0.5, 0.125, 1];
const emissiveFactor = [0.9, 0.25, 0.08];
const scenario =
  new URLSearchParams(window.location.search).get("scenario") ?? "ready";

const baseStatus = {
  example: "standard-texture-control",
  scenario,
  materialModel: "standard-direct-lit-texture-control",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};
const expectedTextureFailures = {
  "missing-texture": {
    diagnostic: "render.standardMaterialTexture.textureNotReady",
    status: "missing",
  },
  "loading-texture": {
    diagnostic: "render.standardMaterialTexture.textureNotReady",
    status: "loading",
  },
  "failed-texture": {
    diagnostic: "render.standardMaterialTexture.textureNotReady",
    status: "failed",
  },
  "normal-map-missing-tangents": {
    diagnostic: "render.standardNormalMap.missingTangents",
    status: "missing-tangents",
  },
  "base-color-transform": {
    diagnostic: "render.standardMaterialTexture.unsupportedTextureTransform",
    status: "unsupported-transform",
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
      worldOptions: { entityCapacity: 12 },
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createScene(aperture, created.app, canvas, scenario);
      const report = await created.app.render({
        frame: 1,
        clearColor,
        label: "standard-texture-control-app",
        readbackSamples: [
          { id: "scalar", ...scene.samplePoints.scalar },
          { id: "textured", ...scene.samplePoints.textured },
        ],
      });

      publishStatus(createStatus(aperture, created.app, scene, report));
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "standard-texture-control-failed",
      error instanceof Error
        ? error.message
        : "Standard texture control example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas, selectedScenario) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const usesMetallicRoughness = selectedScenario === "metallic-roughness";
  const usesNormalMap =
    selectedScenario === "normal-map" ||
    selectedScenario === "normal-map-missing-tangents";
  const usesMissingNormalTangents =
    selectedScenario === "normal-map-missing-tangents";
  const providesTangents = selectedScenario === "normal-map";
  const usesOcclusion = selectedScenario === "occlusion";
  const usesEmissive = selectedScenario === "emissive";
  const usesBaseColorUv1 = selectedScenario === "base-color-uv1";
  const usesLinearSampler = selectedScenario === "base-color-linear-sampler";
  const usesBaseColorTransform = selectedScenario === "base-color-transform";
  const meshAsset = aperture.createPlaneMeshAsset({
    label: "StandardTextureControlPlane",
    width: 0.78,
    height: 0.9,
  });
  const mesh = assets.meshes.add(
    providesTangents
      ? createTangentPlaneMeshAsset(meshAsset)
      : usesBaseColorUv1
        ? createUv1PlaneMeshAsset(meshAsset, uv1Coordinate)
        : meshAsset,
    { id: "standard-texture-control-plane" },
  );
  const texture = aperture.createTextureHandle(
    usesMetallicRoughness
      ? "standard-control-metallic-roughness"
      : usesNormalMap
        ? "standard-control-normal"
        : usesOcclusion
          ? "standard-control-occlusion"
          : usesEmissive
            ? "standard-control-emissive"
            : usesBaseColorUv1
              ? "standard-control-base-color-uv1"
              : usesLinearSampler
                ? "standard-control-base-color-linear-sampler"
                : usesBaseColorTransform
                  ? "standard-control-base-color-transform"
                  : "standard-control-base-color",
  );
  const sampler = aperture.createSamplerHandle(
    usesLinearSampler ? "standard-control-linear" : "standard-control-nearest",
  );
  const textureKey = aperture.assetHandleKey(texture);
  const samplerKey = aperture.assetHandleKey(sampler);
  if (selectedScenario === "loading-texture") {
    app.assets.register(texture);
    app.assets.markLoading(texture);
  } else if (selectedScenario === "failed-texture") {
    app.assets.register(texture);
    app.assets.markFailed(texture, [
      {
        code: "standard-control.texture.failed",
        message: "Intentional StandardMaterial texture control failure.",
        severity: "error",
      },
    ]);
  } else if (selectedScenario !== "missing-texture") {
    const textureBytes = usesMetallicRoughness
      ? metallicRoughnessBytes
      : usesNormalMap
        ? normalMapBytes
        : usesOcclusion
          ? occlusionBytes
          : usesEmissive
            ? emissiveBytes
            : usesBaseColorUv1
              ? uv1TextureBytes
              : usesLinearSampler
                ? linearSamplerTextureBytes
                : [24, 128, 255, 255];
    app.assets.register(texture);
    app.assets.markReady(
      texture,
      aperture.createTextureAsset({
        label: usesMetallicRoughness
          ? "StandardControlMetallicRoughness"
          : usesNormalMap
            ? "StandardControlNormal"
            : usesOcclusion
              ? "StandardControlOcclusion"
              : usesEmissive
                ? "StandardControlEmissive"
                : usesBaseColorUv1
                  ? "StandardControlBaseColorUv1"
                  : usesLinearSampler
                    ? "StandardControlBaseColorLinearSampler"
                    : usesBaseColorTransform
                      ? "StandardControlBaseColorTransform"
                      : "StandardControlBaseColor",
        dimension: "2d",
        width: 2,
        height: 2,
        format:
          usesMetallicRoughness || usesNormalMap || usesOcclusion
            ? "rgba8unorm"
            : "rgba8unorm-srgb",
        colorSpace:
          usesMetallicRoughness || usesNormalMap || usesOcclusion
            ? "data"
            : "srgb",
        semantic: usesMetallicRoughness
          ? "metallic-roughness"
          : usesNormalMap
            ? "normal"
            : usesOcclusion
              ? "occlusion"
              : usesEmissive
                ? "emissive"
                : "base-color",
        usage: ["sampled", "copy-dst"],
        sourceData: {
          bytes: textureSourceBytes(textureBytes),
          bytesPerRow: 8,
          rowsPerImage: 2,
        },
      }),
    );
  }
  app.assets.register(sampler);
  app.assets.markReady(
    sampler,
    aperture.createSamplerAsset({
      label: usesLinearSampler
        ? "StandardControlLinearSampler"
        : "StandardControlNearestSampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: usesLinearSampler ? "linear" : "nearest",
      minFilter: usesLinearSampler ? "linear" : "nearest",
      mipmapFilter: "nearest",
    }),
  );

  const scalar = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "StandardControlScalar",
      baseColorFactor: new Float32Array(scalarColor),
      ...(usesMissingNormalTangents
        ? { normalTexture: { texture, sampler }, normalScale: 2 }
        : usesBaseColorTransform
          ? {
              baseColorTexture: {
                texture,
                sampler,
                transform: textureTransform,
              },
            }
          : {}),
      metallicFactor: 0,
      roughnessFactor: 0.8,
    }),
    { id: "standard-control-scalar" },
  );
  const textured = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "StandardControlTextured",
      baseColorFactor: new Float32Array(
        usesMetallicRoughness || usesNormalMap || usesOcclusion || usesEmissive
          ? scalarColor
          : [1, 1, 1, 1],
      ),
      ...(usesMetallicRoughness
        ? { metallicRoughnessTexture: { texture, sampler } }
        : usesNormalMap
          ? { normalTexture: { texture, sampler }, normalScale: 2 }
          : usesOcclusion
            ? { occlusionTexture: { texture, sampler }, occlusionStrength: 1 }
            : usesEmissive
              ? {
                  emissiveTexture: { texture, sampler },
                  emissiveFactor: new Float32Array(emissiveFactor),
                }
              : {
                  baseColorTexture: {
                    texture,
                    sampler,
                    ...(usesBaseColorUv1 ? { texCoord: 1 } : {}),
                    ...(usesBaseColorTransform
                      ? { transform: textureTransform }
                      : {}),
                  },
                }),
      metallicFactor: usesMetallicRoughness ? 1 : 0,
      roughnessFactor: usesMetallicRoughness ? 1 : 0.8,
    }),
    { id: "standard-control-textured" },
  );

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
      intensity: usesLinearSampler
        ? 1
        : usesNormalMap
          ? 0.25
          : usesEmissive
            ? 0.05
            : 0.72,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(
      usesNormalMap
        ? { rotation: normalMapLightRotation }
        : { translation: [0.2, 0.8, 1.5] },
    ),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 1, 1, 1],
      intensity: usesOcclusion || usesEmissive || usesLinearSampler ? 0 : 1.15,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-0.52, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(scalar),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [0.52, 0, 0] }),
    aperture.withMesh(mesh),
    aperture.withMaterial(textured),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    mesh,
    scalar,
    textured,
    texture,
    sampler,
    textureKey,
    samplerKey,
    textureSlot: usesMetallicRoughness
      ? "metallicRoughnessTexture"
      : usesNormalMap
        ? "normalTexture"
        : usesOcclusion
          ? "occlusionTexture"
          : usesEmissive
            ? "emissiveTexture"
            : "baseColorTexture",
    expectedMetallicRoughness: usesMetallicRoughness ? metallicRoughness : null,
    expectedNormalMap: usesNormalMap ? normalMapVector : null,
    expectedOcclusion: usesOcclusion
      ? { red: occlusionValue, strength: 1 }
      : null,
    expectedEmissive: usesEmissive
      ? { factor: emissiveFactor, color: emissiveColor }
      : null,
    expectedTexCoord: usesBaseColorUv1 ? 1 : 0,
    expectedUv1: usesBaseColorUv1 ? uv1Coordinate : null,
    expectedSampler: usesLinearSampler
      ? {
          magFilter: "linear",
          minFilter: "linear",
          expectedColor: linearSamplerExpectedColor,
          rejectedNearestColor: linearSamplerRejectedNearestColor,
        }
      : null,
    expectedTextureTransform: usesBaseColorTransform ? textureTransform : null,
    samplePoints: {
      scalar: { x: 0.34, y: 0.5 },
      textured: { x: 0.62, y: 0.5 },
    },
    expectedFailure: expectedTextureFailures[selectedScenario] ?? null,
  };
}

function createStatus(aperture, app, scene, report) {
  const snapshot = report.snapshot;
  const pipelineKeys = snapshot.meshDraws.map(
    (draw) => draw.batchKey.pipelineKey,
  );
  const meshLayoutKeys = snapshot.meshDraws.map(
    (draw) => draw.batchKey.meshLayoutKey,
  );

  return {
    ...baseStatus,
    ok: scene.expectedFailure === null ? report.ok : !report.ok,
    phase:
      scene.expectedFailure === null
        ? report.ok
          ? "rendered"
          : "render"
        : "expected-failure",
    ...(scene.expectedFailure === null
      ? {}
      : {
          expectedFailure: true,
          expectedDiagnostic: scene.expectedFailure.diagnostic,
          expectedTextureStatus: scene.expectedFailure.status,
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
    extraction: {
      views: snapshot.views.length,
      meshDraws: snapshot.meshDraws.length,
      lights: snapshot.lights.length,
      diagnostics: snapshot.diagnostics.length,
    },
    standardTexture: {
      scalarMaterialKey: aperture.assetHandleKey(scene.scalar),
      texturedMaterialKey: aperture.assetHandleKey(scene.textured),
      textureKey: scene.textureKey,
      samplerKey: scene.samplerKey,
      textureSlot: scene.textureSlot,
      expectedScalarColor: scalarColor,
      expectedTextureColor: textureColor,
      expectedMetallicRoughness: scene.expectedMetallicRoughness,
      expectedNormalMap: scene.expectedNormalMap,
      expectedOcclusion: scene.expectedOcclusion,
      expectedEmissive: scene.expectedEmissive,
      expectedTexCoord: scene.expectedTexCoord,
      expectedUv1: scene.expectedUv1,
      expectedSampler: scene.expectedSampler,
      expectedTextureTransform: scene.expectedTextureTransform,
      samples: scene.samplePoints,
    },
    ...(report.readback === undefined ? {} : { readback: report.readback }),
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

function textureSourceBytes(colorOrPixels) {
  return colorOrPixels.length === 4
    ? new Uint8Array([
        ...colorOrPixels,
        ...colorOrPixels,
        ...colorOrPixels,
        ...colorOrPixels,
      ])
    : new Uint8Array(colorOrPixels);
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
        id: "standard-control-plane-tangent",
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
        id: "standard-control-plane-uv1",
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
