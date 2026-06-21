const clearColor = [0.015, 0.025, 0.035, 1];
const primitiveShapes = [
  { meshIndex: 0, primitiveIndex: 0, shape: "plane" },
  { meshIndex: 1, primitiveIndex: 0, shape: "box" },
  { meshIndex: 2, primitiveIndex: 0, shape: "cone" },
];
const cameraIntent = {
  key: "gltf:camera:main",
  nodeKey: "gltf:node:camera",
  projection: "perspective",
  near: 0.1,
  far: 100,
  yfov: 0.9,
};
const directLightIntent = {
  key: "gltf:light:directional:0",
  nodeKey: "gltf:node:light:0",
  kind: "directional",
  color: [1, 0.94, 0.82],
  intensity: 2.4,
  castsShadow: true,
};
const environmentIntent = {
  key: "gltf:environment:studio",
  diffuseTextureHandleKey: "texture:gltf:environment:studio:diffuse",
  specularTextureHandleKey: "texture:gltf:environment:studio:specular",
  intensity: 0.6,
};
const shadowIntent = {
  key: "gltf:shadow:directional:0",
  lightKey: directLightIntent.key,
  mapSize: 1024,
  depthBias: 0.001,
  normalBias: 0.01,
};
const bufferBackedGlbKeyPrefix = "buffer-backed";
const shadowControls = {
  receiverEnabled: true,
  casterEnabled: true,
};

let apertureModulePromise = null;
let scene = null;

self.addEventListener("error", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-runtime-error",
    message: event.message || "The simulation worker raised an error.",
    location: {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    },
  });
  event.preventDefault();
});

self.addEventListener("unhandledrejection", (event) => {
  self.postMessage({
    type: "error",
    reason: "worker-unhandled-rejection",
    message: messageFromError(event.reason),
  });
  event.preventDefault();
});

self.onmessage = (message) => {
  void handleMessage(message.data);
};

async function handleMessage(data) {
  try {
    const aperture = await loadAperture();

    if (data?.type === "init") {
      updateShadowControls(data.shadowControls);
      const app = aperture.createExtractionApp({
        worldOptions: { entityCapacity: 32 },
      });

      scene = createScene(
        aperture,
        app,
        data.canvas ?? { width: 1280, height: 720 },
      );
      self.postMessage({
        type: "ready",
        scene: createWorkerSceneStatus(aperture, scene),
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      updateShadowControls(data.shadowControls);
      applyShadowAuthoring(
        aperture,
        scene.app,
        scene.shadowAuthoringEntities,
        scene.shadowControls,
      );

      const frame = finiteInteger(data.frame, 0);
      const step = scene.app.step(0, frame / 60);
      const snapshot = scene.app.extract(frame);
      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          scene: createWorkerSceneStatus(aperture, scene),
          workerStep: {
            transformDiagnostics: step.transform.diagnostics.length,
            transforms: snapshot.transforms.length / 16,
            viewMatrices: snapshot.viewMatrices.length / 16,
          },
        },
        aperture.renderSnapshotTransferList(snapshot),
      );
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      reason: "worker-frame-failed",
      message: messageFromError(error),
    });
  }
}

function loadAperture() {
  apertureModulePromise ??= Promise.all([
    import("/aperture/worker-modules/packages/simulation/dist/index.js"),
    import("/aperture/worker-modules/packages/render/dist/index.js"),
    import("/aperture/worker-modules/packages/runtime/dist/index.js"),
  ]).then(([simulation, render, runtime]) => ({
    ...simulation,
    ...render,
    ...runtime,
  }));
  return apertureModulePromise;
}

function updateShadowControls(nextControls) {
  if (nextControls === undefined || nextControls === null) {
    return;
  }

  shadowControls.receiverEnabled = nextControls.receiverEnabled !== false;
  shadowControls.casterEnabled = nextControls.casterEnabled !== false;
}

function createWorkerSceneStatus(aperture, workerScene) {
  return {
    replay: {
      source: "runtime-facade",
      valid: workerScene.replay.valid,
      created: workerScene.replay.created.length,
      appliedComponents: workerScene.replay.appliedComponents.length,
      diagnostics: workerScene.replay.diagnostics.length,
    },
    visibleBufferBackedReplay: {
      source: "runtime-facade",
      valid: workerScene.visibleBufferBackedReplay.replay.valid,
      created: workerScene.visibleBufferBackedReplay.replay.created.length,
      diagnostics:
        workerScene.visibleBufferBackedReplay.replay.diagnostics.length,
      meshHandleKey: workerScene.visibleBufferBackedReplay.meshHandleKey,
      materialHandleKey:
        workerScene.visibleBufferBackedReplay.materialHandleKey,
      materialSource: workerScene.visibleBufferBackedReplay.materialSource,
      baseColorFactor: workerScene.visibleBufferBackedReplay.baseColorFactor,
    },
    shadowControls: { ...workerScene.shadowControls },
    environmentMapKey: aperture.assetHandleKey(workerScene.environmentHandle),
  };
}

function createScene(aperture, app, targetCanvas) {
  const glbFixture = createGltfSceneGlbFixture(aperture);
  const bufferBackedGlbFixture =
    createGltfSceneBufferBackedGlbFixture(aperture);
  const root = glbFixture.root;
  const meshConstruction = createMeshConstructionReport(aperture);
  const environmentHandle = aperture.createEnvironmentMapHandle(
    "gltf:environment:studio",
  );

  app.assets.register(environmentHandle, { label: "GltfSceneStudioIBL" });
  app.assets.markReady(environmentHandle, {
    kind: "environment-map",
    label: "GltfSceneStudioIBL",
    diffuseTextureHandleKey: environmentIntent.diffuseTextureHandleKey,
    specularTextureHandleKey: environmentIntent.specularTextureHandleKey,
    intensity: environmentIntent.intensity,
  });

  const initialContract = aperture.createGltfSceneImportContractReport({
    root,
    resolveImageData: () => null,
    primitiveShapes,
    cameras: [cameraIntent],
    directLights: [directLightIntent],
    environment: environmentIntent,
    shadows: [shadowIntent],
  });
  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: app.assets,
    assetMapping: initialContract.assetMapping,
    meshConstruction,
  });
  const contract = aperture.createGltfSceneImportContractReport({
    root,
    resolveImageData: () => null,
    sourceRegistrationReport: registration.sourceRegistration,
    meshRegistrationReport: registration.meshRegistration,
    primitiveShapes,
    cameras: [cameraIntent],
    directLights: [directLightIntent],
    environment: environmentIntent,
    shadows: [shadowIntent],
  });

  if (contract.ecsCommandPlan === null) {
    throw new Error("GLTF scene contract did not produce an ECS command plan.");
  }

  const replay = aperture.applyGltfEcsCommandPlanToApp({
    app,
    plan: contract.ecsCommandPlan,
  });
  const visibleBufferBackedReplay = createVisibleBufferBackedReplay(
    aperture,
    app,
    bufferBackedGlbFixture,
  );
  const shadowAuthoringEntities = collectShadowAuthoringEntities(
    aperture,
    replay,
    visibleBufferBackedReplay.replay,
  );

  applyShadowAuthoring(aperture, app, shadowAuthoringEntities, shadowControls);

  app.spawn(
    aperture.withTransform({ translation: [0, 0.2, 5.2] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: cameraIntent.near,
      far: cameraIntent.far,
      clearColor,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.42, 0.48, 0.58, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform({ rotation: [0, -0.258819, 0, 0.965926] }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: directLightIntent.intensity,
      layerMask: 1,
    }),
    aperture.withLightShadowSettings({
      enabled: true,
      mapSize: shadowIntent.mapSize,
      bias: shadowIntent.depthBias,
      normalBias: shadowIntent.normalBias,
      casterLayerMask: 1,
      receiverLayerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Environment,
      color: [1, 1, 1, 1],
      intensity: environmentIntent.intensity,
      layerMask: 1,
      environmentMap: environmentHandle,
    }),
  );

  return {
    app,
    canvas: targetCanvas,
    contract,
    environmentHandle,
    bufferBackedGlbFixture: bufferBackedGlbFixture.status,
    glbFixture: glbFixture.status,
    registration,
    replay,
    shadowControls,
    shadowAuthoringEntities,
    visibleBufferBackedReplay,
    root,
  };
}

function collectShadowAuthoringEntities(aperture, ...replays) {
  const entities = [];

  for (const replay of replays) {
    for (const entity of replay.entitiesByKey.values()) {
      if (
        entity.hasComponent(aperture.Mesh) &&
        entity.hasComponent(aperture.Material)
      ) {
        entities.push(entity);
      }
    }
  }

  return entities;
}

function applyShadowAuthoring(aperture, app, entities, controls) {
  const context = { app, world: app.world, assets: app.assets };

  for (const entity of entities) {
    if (entity.hasComponent(aperture.ShadowCaster)) {
      entity.setValue(aperture.ShadowCaster, "enabled", controls.casterEnabled);
    } else {
      aperture.withShadowCaster(controls.casterEnabled)(entity, context);
    }

    if (entity.hasComponent(aperture.ShadowReceiver)) {
      entity.setValue(
        aperture.ShadowReceiver,
        "enabled",
        controls.receiverEnabled,
      );
    } else {
      aperture.withShadowReceiver(controls.receiverEnabled)(entity, context);
    }
  }
}

function createGltfSceneRoot() {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "Plane", mesh: 0, translation: [0.35, -0.15, 0] },
      {
        name: "Box",
        mesh: 1,
        translation: [0, 0, 0],
        rotation: [0, 0.382683, 0, 0.92388],
      },
      { name: "Cone", mesh: 2, translation: [1.45, -0.05, 0] },
    ],
    accessors: [{}, {}, {}],
    meshes: [
      {
        name: "PlaneMesh",
        primitives: [{ attributes: { POSITION: 0 }, material: 0 }],
      },
      {
        name: "BoxMesh",
        primitives: [{ attributes: { POSITION: 1 }, material: 1 }],
      },
      {
        name: "ConeMesh",
        primitives: [{ attributes: { POSITION: 2 }, material: 0 }],
      },
    ],
    materials: [
      {
        name: "StandardBlue",
        pbrMetallicRoughness: {
          baseColorFactor: [0.2, 0.42, 1, 1],
          metallicFactor: 0.12,
          roughnessFactor: 0.55,
        },
        emissiveFactor: [0.02, 0.025, 0.04],
      },
      {
        name: "UnlitCoral",
        pbrMetallicRoughness: {
          baseColorFactor: [1, 0.36, 0.18, 1],
        },
        extensions: { KHR_materials_unlit: {} },
      },
    ],
  };
}

function createGltfSceneGlbFixture(aperture) {
  const source = createGlbFixtureSource(createGltfSceneRoot());
  const loader = aperture.createNoFetchGlbSourceLoaderReport({
    source,
  });
  const report = loader.glbImportReport;
  const container = report.container.container;

  if (!report.valid || container === null || report.importReport === null) {
    throw new Error("GLTF scene GLB fixture did not produce a valid root.");
  }

  return {
    root: container.json,
    status: {
      ...loader.status,
      outputSummary: loader.outputSummary,
    },
  };
}

function createGltfSceneBufferBackedGlbFixture(aperture) {
  const { source } = createIndexedTriangleGlbFixtureSource();
  const preflight = aperture.createNoFetchGlbSourceLoaderReport({
    source,
    keyPrefix: bufferBackedGlbKeyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
  });
  const root = preflight.glbImportReport.container.container?.json;

  if (!preflight.glbImportReport.valid || root === undefined) {
    throw new Error("GLTF scene buffer-backed GLB fixture did not load.");
  }

  const ecsCommandPlan = aperture.createGltfEcsAuthoringCommandPlan({
    traversalReport: aperture.createGltfSceneTraversalReport({ root }),
  });
  const loader = aperture.createNoFetchGlbSourceLoaderReport({
    source,
    keyPrefix: bufferBackedGlbKeyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
    ecsCommandPlan,
  });

  return {
    mesh:
      loader.glbImportReport.importReport?.meshConstruction?.meshes[0]?.mesh ??
      null,
    importReport: loader.glbImportReport.importReport,
    status: {
      ...loader.status,
      outputSummary: loader.outputSummary,
    },
  };
}

function createVisibleBufferBackedReplay(aperture, app, fixture) {
  const mesh = fixture.mesh;

  if (mesh === null) {
    throw new Error("Buffer-backed GLB fixture did not produce a mesh asset.");
  }

  const meshHandle = aperture.createMeshHandle(
    "gltf:buffer-backed:mesh:0:primitive:0",
  );
  const materialResolution = createBufferBackedMaterialResolution(
    aperture,
    fixture.importReport,
  );
  const resolvedMaterial = materialResolution.resolved[0];

  if (resolvedMaterial === undefined) {
    throw new Error("Buffer-backed GLB fixture did not resolve a material.");
  }

  const materialHandle = materialHandleFromKey(
    aperture,
    resolvedMaterial.materialHandleKey,
  );
  const materialAsset = materialAssetFromMapping(
    fixture.importReport,
    resolvedMaterial.materialIndex,
  );
  const baseColorFactor = Array.from(materialAsset.baseColorFactor, (value) =>
    Number(value.toFixed(4)),
  );
  const meshHandleKey = aperture.assetHandleKey(meshHandle);
  const materialHandleKey = aperture.assetHandleKey(materialHandle);

  app.assets.register(meshHandle, { label: "BufferBackedVisibleTriangle" });
  app.assets.markReady(meshHandle, {
    ...mesh,
    label: "BufferBackedVisibleTriangle",
  });
  app.assets.register(materialHandle, {
    label: materialAsset.label,
  });
  app.assets.markReady(materialHandle, materialAsset);

  const replay = aperture.applyGltfEcsCommandPlanToApp({
    app,
    plan: {
      valid: true,
      sceneIndex: 0,
      rootEntityKeys: ["gltf:buffer-backed:visible:primitive:0"],
      commands: [
        {
          type: "createEntity",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          label: "BufferBackedVisibleTriangle",
        },
        {
          type: "addComponent",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          component: "Name",
          value: { value: "BufferBackedVisibleTriangle" },
        },
        {
          type: "addComponent",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          component: "Parent",
          value: { parentEntityKey: null },
        },
        {
          type: "addComponent",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          component: "LocalTransform",
          value: {
            translation: [-2, -2, 3],
            rotation: [0, 0, 0, 1],
            scale: [4, 4, 4],
          },
        },
        {
          type: "addComponent",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          component: "WorldTransform",
          value: {
            col0: [4, 0, 0, 0],
            col1: [0, 4, 0, 0],
            col2: [0, 0, 4, 0],
            col3: [-2, -2, 3, 1],
          },
        },
        {
          type: "addComponent",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          component: "Visibility",
          value: { visible: true },
        },
        {
          type: "addComponent",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          component: "Mesh",
          value: {
            meshId: "gltf:buffer-backed:mesh:0:primitive:0",
            handleKey: meshHandleKey,
          },
        },
        {
          type: "addComponent",
          entityKey: "gltf:buffer-backed:visible:primitive:0",
          component: "Material",
          value: {
            materialId: materialHandle.id,
            handleKey: materialHandleKey,
          },
        },
      ],
      dependencies: [meshHandleKey, materialHandleKey],
      skipped: [],
      diagnostics: [],
    },
  });

  return {
    meshHandleKey,
    materialHandleKey,
    materialSource: resolvedMaterial.source,
    baseColorFactor,
    replay,
  };
}

function createBufferBackedMaterialResolution(aperture, importReport) {
  if (
    importReport === null ||
    importReport.meshPrimitive === null ||
    importReport.assetMapping === null
  ) {
    throw new Error("Buffer-backed GLB fixture did not produce material data.");
  }

  return aperture.createGltfPrimitiveMaterialResolutionReport({
    primitiveReport: importReport.meshPrimitive,
    registrationReport: {
      valid: true,
      written: importReport.assetMapping.materials.map((material) => ({
        kind: "material",
        plannedHandleKey: material.handleKey,
        registeredHandleKey: material.handleKey,
        materialIndex: material.materialIndex,
        diagnostics: [],
      })),
      skipped: [],
      diagnostics: [],
    },
    keyPrefix: bufferBackedGlbKeyPrefix,
  });
}

function materialHandleFromKey(aperture, materialHandleKey) {
  const id = materialHandleKey.startsWith("material:")
    ? materialHandleKey.slice("material:".length)
    : materialHandleKey;

  return aperture.createMaterialHandle(id);
}

function materialAssetFromMapping(importReport, materialIndex) {
  const material = importReport?.assetMapping?.materials.find(
    (entry) => entry.materialIndex === materialIndex,
  )?.material;

  if (material === undefined || material === null) {
    throw new Error("Buffer-backed GLB fixture material mapping is missing.");
  }

  return material;
}

function createGlbFixtureSource(root) {
  return createGlbFixture([
    {
      typeCode: 0x4e4f534a,
      data: padGlbChunkData(
        new TextEncoder().encode(JSON.stringify(root)),
        0x20,
      ),
    },
  ]);
}

function createIndexedTriangleGlbFixtureSource() {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);

  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );
  [0, 2, 1].forEach((value, index) =>
    view.setUint16(36 + index * 2, value, true),
  );

  const root = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "BufferBackedTriangle", mesh: 0 }],
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
      { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
    ],
    meshes: [
      {
        primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }],
      },
    ],
    materials: [
      {
        name: "BufferBackedSourceMint",
        pbrMetallicRoughness: {
          baseColorFactor: [0.12, 0.78, 0.46, 1],
          metallicFactor: 0,
          roughnessFactor: 0.62,
        },
        doubleSided: true,
        extensions: { KHR_materials_unlit: {} },
      },
    ],
  };

  return {
    source: createGlbFixture([
      {
        typeCode: 0x4e4f534a,
        data: padGlbChunkData(
          new TextEncoder().encode(JSON.stringify(root)),
          0x20,
        ),
      },
      {
        typeCode: 0x004e4942,
        data: bytes,
      },
    ]),
  };
}

function createGlbFixture(chunks) {
  const headerByteLength = 12;
  const chunkHeaderByteLength = 8;
  const byteLength =
    headerByteLength +
    chunks.reduce(
      (total, chunk) => total + chunkHeaderByteLength + chunk.data.byteLength,
      0,
    );
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = headerByteLength;

  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, byteLength, true);

  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.byteLength, true);
    view.setUint32(offset + 4, chunk.typeCode, true);
    bytes.set(chunk.data, offset + chunkHeaderByteLength);
    offset += chunkHeaderByteLength + chunk.data.byteLength;
  }

  return bytes;
}

function padGlbChunkData(data, padByte) {
  const paddedLength = Math.ceil(data.byteLength / 4) * 4;
  const padded = new Uint8Array(paddedLength);

  padded.set(data);
  padded.fill(padByte, data.byteLength);

  return padded;
}

function createMeshConstructionReport(aperture) {
  return {
    valid: true,
    meshes: [
      {
        handleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        mesh: aperture.createPlaneMeshAsset({
          label: "GltfScenePlane",
          width: 1.15,
          height: 1.15,
        }),
      },
      {
        handleKey: "gltf:mesh:1:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:1:primitive:0",
        meshIndex: 1,
        primitiveIndex: 0,
        mesh: aperture.createBoxMeshAsset({
          label: "GltfSceneBox",
          width: 1,
          height: 1,
          depth: 1,
        }),
      },
      {
        handleKey: "gltf:mesh:2:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:2:primitive:0",
        meshIndex: 2,
        primitiveIndex: 0,
        mesh: aperture.createConeMeshAsset({
          label: "GltfSceneCone",
          radius: 0.62,
          height: 1.2,
          radialSegments: 4,
        }),
      },
    ],
    diagnostics: [],
  };
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
