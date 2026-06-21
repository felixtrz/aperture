export const clearColor = [0.015, 0.025, 0.035, 1];
const scalarColor = [0.95, 0.1, 0.08, 1];
const textureColor = [0.09375, 0.5, 1, 1];
const uv1Coordinate = { u: 0.25, v: 0.25 };
const repeatSamplerCoordinate = { u: 1.25, v: 0.25 };
// Finite offset/scale/rotation transforms on TEXCOORD_0/1 now render; a
// non-finite component is the remaining unsupported-transform input, so the
// control scenario uses a NaN rotation to exercise that failure path.
const textureTransform = { offset: [0.25, 0], rotation: Number.NaN };
const uv1TextureBytes = [
  24, 128, 255, 255, 255, 32, 32, 255, 255, 255, 0, 255, 0, 255, 0, 255,
];
const linearSamplerTextureBytes = [
  255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255,
];
const linearSamplerExpectedColor = [0.5, 0, 0.5, 1];
const linearSamplerRejectedNearestColor = [1, 0, 0, 1];
const repeatSamplerRejectedClampColor = [1, 32 / 255, 32 / 255, 1];
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
export function registerStandardTextureControlScene(
  aperture,
  registry,
  selectedScenario,
) {
  const assets = aperture.createRenderAssetCollections({
    registry,
  });
  const flags = createScenarioFlags(selectedScenario);
  const mesh = assets.meshes.add(createScenarioMeshAsset(aperture, flags), {
    id: "standard-texture-control-plane",
  });
  const texture = aperture.createTextureHandle(createScenarioTextureId(flags));
  const sampler = aperture.createSamplerHandle(
    flags.usesLinearSampler
      ? "standard-control-linear"
      : "standard-control-nearest",
  );
  const textureKey = aperture.assetHandleKey(texture);
  const samplerKey = aperture.assetHandleKey(sampler);
  registerScenarioTextureAsset(aperture, registry, flags, texture);
  registry.register(sampler);
  registry.markReady(sampler, createScenarioSamplerAsset(aperture, flags));

  const materialInput = createScenarioMaterialInput(flags, texture, sampler);
  const scalar = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "StandardControlScalar",
      baseColorFactor: new Float32Array(scalarColor),
      ...materialInput.scalarTextureBinding,
      metallicFactor: 0,
      roughnessFactor: 0.8,
    }),
    { id: "standard-control-scalar" },
  );
  const textured = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "StandardControlTextured",
      baseColorFactor: new Float32Array(materialInput.texturedBaseColorFactor),
      ...materialInput.texturedTextureBinding,
      metallicFactor: flags.usesMetallicRoughness ? 1 : 0,
      roughnessFactor: flags.usesMetallicRoughness ? 1 : 0.8,
    }),
    { id: "standard-control-textured" },
  );

  return {
    mesh,
    scalar,
    textured,
    texture,
    sampler,
    textureKey,
    samplerKey,
    ...createScenarioExpectations(flags),
    lighting: createScenarioLighting(flags),
    samplePoints: {
      scalar: { x: 0.34, y: 0.5 },
      textured: { x: 0.62, y: 0.5 },
    },
    expectedFailure: flags.expectedFailure,
  };
}

function createScenarioFlags(selectedScenario) {
  const usesNormalMap =
    selectedScenario === "normal-map" ||
    selectedScenario === "normal-map-missing-tangents";

  return {
    selectedScenario,
    usesMetallicRoughness: selectedScenario === "metallic-roughness",
    usesNormalMap,
    usesMissingNormalTangents:
      selectedScenario === "normal-map-missing-tangents",
    providesTangents: selectedScenario === "normal-map",
    usesOcclusion: selectedScenario === "occlusion",
    usesEmissive: selectedScenario === "emissive",
    usesBaseColorUv1: selectedScenario === "base-color-uv1",
    usesLinearSampler: selectedScenario === "base-color-linear-sampler",
    usesRepeatSampler: selectedScenario === "base-color-repeat-sampler",
    usesBaseColorTransform: selectedScenario === "base-color-transform",
    expectedFailure: expectedTextureFailures[selectedScenario] ?? null,
  };
}

function createScenarioMeshAsset(aperture, flags) {
  const meshAsset = aperture.createPlaneMeshAsset({
    label: "StandardTextureControlPlane",
    width: 0.78,
    height: 0.9,
  });

  if (flags.providesTangents) {
    return createTangentPlaneMeshAsset(meshAsset);
  }

  if (flags.usesBaseColorUv1) {
    return createUv1PlaneMeshAsset(meshAsset, uv1Coordinate);
  }

  if (flags.usesRepeatSampler) {
    return createUv0PlaneMeshAsset(meshAsset, repeatSamplerCoordinate);
  }

  return meshAsset;
}

function createScenarioTextureId(flags) {
  if (flags.usesMetallicRoughness) {
    return "standard-control-metallic-roughness";
  }

  if (flags.usesNormalMap) {
    return "standard-control-normal";
  }

  if (flags.usesOcclusion) {
    return "standard-control-occlusion";
  }

  if (flags.usesEmissive) {
    return "standard-control-emissive";
  }

  if (flags.usesBaseColorUv1) {
    return "standard-control-base-color-uv1";
  }

  if (flags.usesLinearSampler) {
    return "standard-control-base-color-linear-sampler";
  }

  if (flags.usesRepeatSampler) {
    return "standard-control-base-color-repeat-sampler";
  }

  if (flags.usesBaseColorTransform) {
    return "standard-control-base-color-transform";
  }

  return "standard-control-base-color";
}

function registerScenarioTextureAsset(aperture, registry, flags, texture) {
  if (flags.selectedScenario === "missing-texture") {
    return;
  }

  registry.register(texture);

  if (flags.selectedScenario === "loading-texture") {
    registry.markLoading(texture);
    return;
  }

  if (flags.selectedScenario === "failed-texture") {
    registry.markFailed(texture, [
      {
        code: "standard-control.texture.failed",
        message: "Intentional StandardMaterial texture control failure.",
        severity: "error",
      },
    ]);
    return;
  }

  registry.markReady(texture, createScenarioTextureAsset(aperture, flags));
}

function createScenarioTextureAsset(aperture, flags) {
  const dataTexture =
    flags.usesMetallicRoughness || flags.usesNormalMap || flags.usesOcclusion;

  return aperture.createTextureAsset({
    label: createScenarioTextureLabel(flags),
    dimension: "2d",
    width: 2,
    height: 2,
    format: dataTexture ? "rgba8unorm" : "rgba8unorm-srgb",
    colorSpace: dataTexture ? "data" : "srgb",
    semantic: createScenarioTextureSemantic(flags),
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes: textureSourceBytes(createScenarioTextureBytes(flags)),
      bytesPerRow: 8,
      rowsPerImage: 2,
    },
  });
}

function createScenarioTextureLabel(flags) {
  if (flags.usesMetallicRoughness) {
    return "StandardControlMetallicRoughness";
  }

  if (flags.usesNormalMap) {
    return "StandardControlNormal";
  }

  if (flags.usesOcclusion) {
    return "StandardControlOcclusion";
  }

  if (flags.usesEmissive) {
    return "StandardControlEmissive";
  }

  if (flags.usesBaseColorUv1) {
    return "StandardControlBaseColorUv1";
  }

  if (flags.usesLinearSampler) {
    return "StandardControlBaseColorLinearSampler";
  }

  if (flags.usesRepeatSampler) {
    return "StandardControlBaseColorRepeatSampler";
  }

  if (flags.usesBaseColorTransform) {
    return "StandardControlBaseColorTransform";
  }

  return "StandardControlBaseColor";
}

function createScenarioTextureSemantic(flags) {
  if (flags.usesMetallicRoughness) {
    return "metallic-roughness";
  }

  if (flags.usesNormalMap) {
    return "normal";
  }

  if (flags.usesOcclusion) {
    return "occlusion";
  }

  if (flags.usesEmissive) {
    return "emissive";
  }

  return "base-color";
}

function createScenarioTextureBytes(flags) {
  if (flags.usesMetallicRoughness) {
    return metallicRoughnessBytes;
  }

  if (flags.usesNormalMap) {
    return normalMapBytes;
  }

  if (flags.usesOcclusion) {
    return occlusionBytes;
  }

  if (flags.usesEmissive) {
    return emissiveBytes;
  }

  if (flags.usesBaseColorUv1) {
    return uv1TextureBytes;
  }

  if (flags.usesLinearSampler) {
    return linearSamplerTextureBytes;
  }

  if (flags.usesRepeatSampler) {
    return uv1TextureBytes;
  }

  return [24, 128, 255, 255];
}

function createScenarioSamplerAsset(aperture, flags) {
  return aperture.createSamplerAsset({
    label: flags.usesLinearSampler
      ? "StandardControlLinearSampler"
      : flags.usesRepeatSampler
        ? "StandardControlRepeatSampler"
        : "StandardControlNearestSampler",
    addressModeU: flags.usesRepeatSampler ? "repeat" : "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: flags.usesLinearSampler ? "linear" : "nearest",
    minFilter: flags.usesLinearSampler ? "linear" : "nearest",
    mipmapFilter: "nearest",
  });
}

function createScenarioMaterialInput(flags, texture, sampler) {
  const binding = { texture, sampler };

  if (flags.usesMissingNormalTangents) {
    return {
      scalarTextureBinding: { normalTexture: binding, normalScale: 2 },
      texturedBaseColorFactor: scalarColor,
      texturedTextureBinding: { normalTexture: binding, normalScale: 2 },
    };
  }

  if (flags.usesBaseColorTransform) {
    return {
      scalarTextureBinding: {
        baseColorTexture: { ...binding, transform: textureTransform },
      },
      texturedBaseColorFactor: [1, 1, 1, 1],
      texturedTextureBinding: {
        baseColorTexture: { ...binding, transform: textureTransform },
      },
    };
  }

  if (flags.usesMetallicRoughness) {
    return {
      scalarTextureBinding: {},
      texturedBaseColorFactor: scalarColor,
      texturedTextureBinding: { metallicRoughnessTexture: binding },
    };
  }

  if (flags.usesNormalMap) {
    return {
      scalarTextureBinding: {},
      texturedBaseColorFactor: scalarColor,
      texturedTextureBinding: { normalTexture: binding, normalScale: 2 },
    };
  }

  if (flags.usesOcclusion) {
    return {
      scalarTextureBinding: {},
      texturedBaseColorFactor: scalarColor,
      texturedTextureBinding: {
        occlusionTexture: binding,
        occlusionStrength: 1,
      },
    };
  }

  if (flags.usesEmissive) {
    return {
      scalarTextureBinding: {},
      texturedBaseColorFactor: scalarColor,
      texturedTextureBinding: {
        emissiveTexture: binding,
        emissiveFactor: new Float32Array(emissiveFactor),
      },
    };
  }

  return {
    scalarTextureBinding: {},
    texturedBaseColorFactor: [1, 1, 1, 1],
    texturedTextureBinding: {
      baseColorTexture: {
        ...binding,
        ...(flags.usesBaseColorUv1 ? { texCoord: 1 } : {}),
      },
    },
  };
}

function createScenarioExpectations(flags) {
  return {
    textureSlot: flags.usesMetallicRoughness
      ? "metallicRoughnessTexture"
      : flags.usesNormalMap
        ? "normalTexture"
        : flags.usesOcclusion
          ? "occlusionTexture"
          : flags.usesEmissive
            ? "emissiveTexture"
            : "baseColorTexture",
    expectedMetallicRoughness: flags.usesMetallicRoughness
      ? metallicRoughness
      : null,
    expectedNormalMap: flags.usesNormalMap ? normalMapVector : null,
    expectedOcclusion: flags.usesOcclusion
      ? { red: occlusionValue, strength: 1 }
      : null,
    expectedEmissive: flags.usesEmissive
      ? { factor: emissiveFactor, color: emissiveColor }
      : null,
    expectedTexCoord: flags.usesBaseColorUv1 ? 1 : 0,
    expectedUv1: flags.usesBaseColorUv1 ? uv1Coordinate : null,
    expectedSampler: flags.usesLinearSampler
      ? {
          magFilter: "linear",
          minFilter: "linear",
          expectedColor: linearSamplerExpectedColor,
          rejectedNearestColor: linearSamplerRejectedNearestColor,
        }
      : flags.usesRepeatSampler
        ? {
            addressModeU: "repeat",
            addressModeV: "clamp-to-edge",
            magFilter: "nearest",
            minFilter: "nearest",
            sampleUv: repeatSamplerCoordinate,
            expectedColor: textureColor,
            rejectedClampColor: repeatSamplerRejectedClampColor,
          }
        : null,
    expectedTextureTransform: flags.usesBaseColorTransform
      ? textureTransform
      : null,
  };
}

function createScenarioLighting(flags) {
  return {
    ambientIntensity: flags.usesLinearSampler
      ? 1
      : flags.usesNormalMap
        ? 0.25
        : flags.usesEmissive
          ? 0.05
          : 0.72,
    directionalTransform: flags.usesNormalMap
      ? { rotation: normalMapLightRotation }
      : { translation: [0.2, 0.8, 1.5] },
    directionalIntensity:
      flags.usesOcclusion || flags.usesEmissive || flags.usesLinearSampler
        ? 0
        : 1.15,
  };
}

export function createStandardTextureControlStatus(
  aperture,
  app,
  scene,
  report,
  baseStatus,
  transportStatus = null,
) {
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
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    ...(transportStatus === null ? {} : transportStatus),
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

function createUv0PlaneMeshAsset(mesh, uv) {
  const stream = mesh.vertexStreams[0];

  if (stream === undefined) {
    throw new Error(
      "Expected plane mesh fixture to provide one vertex stream.",
    );
  }

  const uv0 = stream.attributes.find(
    (attribute) => attribute.semantic === "TEXCOORD_0",
  );

  if (uv0 === undefined) {
    throw new Error("Expected plane mesh fixture to provide TEXCOORD_0.");
  }

  const data = new Float32Array(stream.data);
  const strideFloats = stream.arrayStride / 4;
  const uvOffsetFloats = uv0.offset / 4;

  for (let vertex = 0; vertex < stream.vertexCount; vertex += 1) {
    const offset = vertex * strideFloats + uvOffsetFloats;
    data[offset] = uv.u;
    data[offset + 1] = uv.v;
  }

  return {
    ...mesh,
    vertexStreams: [
      {
        ...stream,
        id: "standard-control-plane-uv0-repeat",
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
