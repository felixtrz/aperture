const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const scalarColor = [0.95, 0.1, 0.08, 1];
const expectedTextureColor = [0.09375, 0.5, 1, 1];
const metallicRoughness = { metallic: 64 / 255, roughness: 16 / 255 };
const normalMapVector = { x: 128 / 255, y: 128 / 255, z: 16 / 255 };
const textureTransform = { offset: [0.25, 0] };
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
const expectedGltfFailures = {
  "base-color-transform": {
    mappingDiagnostic: "gltfMaterial.unsupportedTextureTransform",
    renderDiagnostic:
      "render.standardMaterialTexture.unsupportedTextureTransform",
    status: "unsupported-transform",
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
        readbackSamples: [{ id: "textured", ...scene.samplePoint }],
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
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  return {
    assetMapping,
    meshConstruction,
    registration,
    mesh,
    material,
    textureSlot: config.textureSlot,
    samplePoint: { x: 0.5, y: 0.5 },
    expectedFailure: config.expectedFailure,
    expectedTextureTransform: config.expectedTextureTransform,
    expectedTextureColor: config.expectedTextureColor,
    expectedMetallicRoughness: config.expectedMetallicRoughness,
    expectedNormalMap: config.expectedNormalMap,
  };
}

function createGltfScenarioConfig(selectedScenario) {
  const usesBaseColorTransform = selectedScenario === "base-color-transform";
  const usesMetallicRoughnessTexture =
    selectedScenario === "metallic-roughness";
  const usesNormalTexture = selectedScenario === "normal-map";

  return {
    usesBaseColorTransform,
    usesMetallicRoughnessTexture,
    usesNormalTexture,
    textureSlot: usesMetallicRoughnessTexture
      ? "metallicRoughnessTexture"
      : usesNormalTexture
        ? "normalTexture"
        : "baseColorTexture",
    materialModel: usesMetallicRoughnessTexture
      ? "gltf-standard-metallic-roughness-texture"
      : usesNormalTexture
        ? "gltf-standard-normal-texture"
        : "gltf-standard-base-color-texture",
    expectedFailure: expectedGltfFailures[selectedScenario] ?? null,
    expectedTextureTransform: usesBaseColorTransform ? textureTransform : null,
    expectedTextureColor:
      usesMetallicRoughnessTexture || usesNormalTexture
        ? null
        : expectedTextureColor,
    expectedMetallicRoughness: usesMetallicRoughnessTexture
      ? metallicRoughness
      : null,
    expectedNormalMap: usesNormalTexture ? normalMapVector : null,
  };
}

function createGltfFixtureRoot(config) {
  const pbrMetallicRoughness = config.usesMetallicRoughnessTexture
    ? {
        baseColorFactor: scalarColor,
        metallicFactor: 1,
        roughnessFactor: 1,
        metallicRoughnessTexture: { index: 0 },
      }
    : config.usesNormalTexture
      ? {
          baseColorFactor: scalarColor,
          metallicFactor: 0,
          roughnessFactor: 0.8,
        }
      : {
          baseColorFactor: [1, 1, 1, 1],
          baseColorTexture: {
            index: 0,
            ...(config.usesBaseColorTransform
              ? {
                  extensions: {
                    KHR_texture_transform: textureTransform,
                  },
                }
              : {}),
          },
          metallicFactor: 0,
          roughnessFactor: 0.8,
        };

  const material = {
    name: config.usesMetallicRoughnessTexture
      ? "GLB Standard MetallicRoughness"
      : config.usesNormalTexture
        ? "GLB Standard Normal"
        : "GLB Standard BaseColor",
    pbrMetallicRoughness,
    ...(config.usesNormalTexture
      ? { normalTexture: { index: 0, scale: 2 } }
      : {}),
  };

  return {
    asset: { version: "2.0" },
    materials: [material],
    textures: [{ source: 0, sampler: 0 }],
    images: [{ bufferView: 0, mimeType: "image/png", name: "BaseColor" }],
    samplers: [gltfSamplerSource],
  };
}

function textureBytesForSlot(textureSlot) {
  switch (textureSlot) {
    case "metallicRoughnessTexture":
      return metallicRoughnessTextureBytes;
    case "normalTexture":
      return normalTextureBytes;
    default:
      return baseColorTextureBytes;
  }
}

function createGltfMeshConstructionReport(aperture, config) {
  const baseMesh = aperture.createPlaneMeshAsset({
    label: "GltfStandardBaseColorPlane",
    width: 0.78,
    height: 0.9,
  });
  const mesh = config.usesNormalTexture
    ? createTangentPlaneMeshAsset(baseMesh)
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
      expectedMetallicRoughness: scene.expectedMetallicRoughness,
      expectedNormalMap: scene.expectedNormalMap,
      expectedTextureTransform: scene.expectedTextureTransform,
      sample: scene.samplePoint,
    },
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
