const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

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

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 32 },
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createScene(aperture, created.app, canvas);

      startRendering(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "gltf-scene-failed",
      error instanceof Error ? error.message : "GLTF scene example failed.",
    ),
  );
}

function createScene(aperture, app, targetCanvas) {
  const root = createGltfSceneRoot();
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

  const replay = aperture.replayGltfEcsAuthoringCommands({
    world: app.world,
    plan: contract.ecsCommandPlan,
  });

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
    aperture.withTransform(),
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
    canvas: targetCanvas,
    contract,
    environmentHandle,
    registration,
    replay,
    root,
  };
}

function startRendering(aperture, app, scene) {
  let frame = 0;

  const render = async () => {
    frame += 1;
    const step = app.step(0, frame / 60);
    const report = await app.render({
      frame,
      clearColor,
      label: "gltf-scene-app",
    });

    publishFrameStatus(aperture, app, scene, step, report, frame);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

function publishFrameStatus(aperture, app, scene, step, report, frame) {
  const contractJson = aperture.gltfSceneImportContractReportToJsonValue(
    scene.contract,
  );
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const environmentMapKey = aperture.assetHandleKey(scene.environmentHandle);
  const environmentReadiness =
    aperture.environmentMapReadinessReportToJsonValue(
      aperture.createEnvironmentMapReadinessReport({
        snapshot: report.snapshot,
        resources: {
          environmentMapResourceKeys: [environmentMapKey],
        },
      }),
    );
  const iblDescriptor = aperture.iblResourceDescriptorReportToJsonValue(
    aperture.createIblResourceDescriptorReport({
      snapshot: report.snapshot,
      descriptors: [
        {
          environmentMapResourceKey: environmentMapKey,
          diffuseResourceKey: environmentIntent.diffuseTextureHandleKey,
          specularResourceKey: environmentIntent.specularTextureHandleKey,
        },
      ],
    }),
  );
  const standardMaterialCount =
    contractJson.summary.materialFamilies.find(
      (materialFamily) => materialFamily.family === "standard",
    )?.count ?? 0;
  const standardMaterialIbl =
    aperture.standardMaterialIblReadinessReportToJsonValue(
      aperture.createStandardMaterialIblReadinessReport({
        standardMaterialCount,
        iblDescriptors: iblDescriptor,
      }),
    );
  const shadowDescriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests: report.snapshot.shadowRequests,
      descriptors: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: shadowIntent.mapSize,
        depthBias: shadowIntent.depthBias,
        normalBias: shadowIntent.normalBias,
      })),
    }),
  );
  const shadowResources = aperture.shadowResourceReadinessReportToJsonValue(
    aperture.createShadowResourceReadinessReport({
      descriptors: shadowDescriptor,
    }),
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    aperture.createShadowTextureResourceReport({
      descriptors: shadowDescriptor,
    }),
  );

  publishStatus({
    example: "gltf-scene",
    ok: report.ok && scene.contract.valid && scene.replay.valid,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-explicit",
    frame,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    gltf: {
      contract: contractJson.summary,
      diagnostics: contractJson.diagnostics,
      registration: {
        valid: scene.registration.valid,
        stages: scene.registration.stages,
      },
      replay: {
        valid: scene.replay.valid,
        created: scene.replay.created.length,
        appliedComponents: scene.replay.appliedComponents.length,
        diagnostics: scene.replay.diagnostics.length,
      },
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: step.transform.diagnostics.length,
      environments: report.snapshot.environments.length,
      shadowRequests: report.snapshot.shadowRequests.length,
    },
    ibl: {
      environmentMapKey,
      readiness: environmentReadiness,
      descriptor: iblDescriptor,
      standardMaterial: standardMaterialIbl,
      sampling: {
        supported: false,
        diagnostic: {
          code: "gltfScene.iblSamplingDeferred",
          severity: "warning",
          message:
            "GLTF scene environment map is extracted and resource-ready, but StandardMaterial IBL shader sampling is not implemented yet.",
        },
      },
    },
    shadow: {
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      intent: {
        key: shadowIntent.key,
        lightKey: shadowIntent.lightKey,
        kind: directLightIntent.kind,
        mapSize: shadowIntent.mapSize,
        bias: shadowIntent.depthBias,
        normalBias: shadowIntent.normalBias,
      },
      descriptor: shadowDescriptor,
      resources: shadowResources,
      textures: shadowTextures,
      rendering: {
        supported: false,
        diagnostic: {
          code: "gltfScene.shadowMapDeferred",
          severity: "warning",
          message:
            "GLTF scene shadow request is extracted, but shadow-map pass creation and StandardMaterial shadow sampling are not implemented yet.",
        },
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      bindGroups: report.resources?.resources?.bindGroups.length ?? 0,
      reuse: report.resourceReuse,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
      indexedDrawCalls: report.boundary?.execution?.indexedDrawCalls ?? 0,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    report: reportJson,
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
  });
}

function familyBuckets(report) {
  const buckets = report.resources?.routeSummary?.familyBuckets;
  if (!Array.isArray(buckets)) {
    return [];
  }

  return buckets.map((bucket) => ({
    family: bucket.family,
    routedItems: bucket.routedItems,
    frameResources: bucket.frameResources,
  }));
}

function createGltfSceneRoot() {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "Plane", mesh: 0, translation: [-1.45, -0.15, 0] },
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

function failure(reason, message, extra = {}) {
  return {
    example: "gltf-scene",
    ok: false,
    phase: "initialize",
    reason,
    message,
    ...extra,
  };
}
