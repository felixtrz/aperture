const canvas = document.querySelector("#aperture-canvas");
const assetSelect = document.querySelector("#glb-asset-select");
const customUrlForm = document.querySelector("#glb-url-form");
const customUrlInput = document.querySelector("#glb-url-input");
const cameraResetButton = document.querySelector("#glb-camera-reset");
const shadowReceiverToggle = document.querySelector(
  "#glb-shadow-receiver-toggle",
);
const shadowCasterToggle = document.querySelector("#glb-shadow-caster-toggle");
const iblToggle = document.querySelector("#glb-ibl-toggle");
const animationToggleButton = document.querySelector("#glb-animation-toggle");
const animationScrubInput = document.querySelector("#glb-animation-scrub");
const pointLightIntensityInput = document.querySelector(
  "#glb-point-light-intensity",
);
const ambientIntensityInput = document.querySelector("#glb-ambient-intensity");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const exampleParams = new URLSearchParams(globalThis.location.search);
const clearColor = [0.015, 0.025, 0.035, 1];
const lightingControlDefaults = {
  ambientIntensity: 0.24,
  pointIntensity: 18,
};
const enableIblSampling = !exampleParams.has("disable-ibl-sampling");
const enableSpecularIblSampling = !exampleParams.has(
  "disable-specular-ibl-sampling",
);
const shadowControls = {
  receiverEnabled: !exampleParams.has("disable-shadow-receiver"),
  casterEnabled: !exampleParams.has("disable-shadow-caster"),
};
const iblControls = {
  enabled: enableIblSampling,
};
const shadowIntent = {
  mapSize: 512,
  depthBias: 0.0015,
  normalBias: 0.01,
};
const supportedMetadataExtensions = new Set([
  "KHR_materials_unlit",
  "KHR_texture_transform",
]);
let shadowDepthTextureResourceReport = null;
const sampleAssets = [
  {
    id: "cube",
    label: "Mint cube",
    url: new URL("./assets/cube.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "slab",
    label: "Amber slab",
    url: new URL("./assets/amber-slab.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "pillar",
    label: "Sapphire pillar",
    url: new URL("./assets/sapphire-pillar.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "brass",
    label: "Lit brass cube",
    url: new URL("./assets/lit-brass-cube.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "animated",
    label: "Animated cube",
    url: new URL("./assets/animated-cube.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "dual",
    label: "Dual primitive",
    url: new URL("./assets/dual-primitive.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "mixed-alpha",
    label: "Mixed alpha",
    url: new URL("./assets/mixed-alpha.glb", globalThis.location.href),
    source: "sample",
  },
  {
    id: "hierarchy",
    label: "Hierarchy cube",
    url: new URL("./assets/hierarchy-cube.glb", globalThis.location.href),
    source: "sample",
  },
];

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
      worldOptions: { entityCapacity: 16 },
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = createGlbViewerScene(aperture, created.app, canvas);

      await loadInitialAsset(aperture, created.app, scene);
      startRendering(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "glb-viewer-failed",
      error instanceof Error ? error.message : "GLB viewer failed.",
    ),
  );
}

function createGlbViewerScene(aperture, app, targetCanvas) {
  const orbit = createOrbitControls(targetCanvas);
  const initialCustomUrl = readInitialCustomUrl();
  const initialSampleSelection = readInitialSampleSelection();
  const cameraEntity = app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.4] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );
  updateOrbitCamera(aperture, cameraEntity, orbit);
  const ambientLightEntity = app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.48, 0.52, 0.58, 1],
      intensity: lightingControlDefaults.ambientIntensity,
      layerMask: 1,
    }),
  );
  const pointLightEntity = app.spawn(
    aperture.withTransform({ translation: [0.2, 1.2, 3.4] }),
    aperture.withLight({
      kind: aperture.LightKind.Point,
      color: [1, 0.92, 0.76, 1],
      intensity: lightingControlDefaults.pointIntensity,
      range: 8,
      layerMask: 1,
    }),
  );
  const lightControls = {
    ambientIntensity: lightingControlDefaults.ambientIntensity,
    pointIntensity: lightingControlDefaults.pointIntensity,
  };

  const scene = {
    asset: initialSampleSelection.asset,
    loadState: null,
    loadSequence: 0,
    initialCustomUrl,
    sampleSelection: initialSampleSelection.status,
    active: null,
    orbit,
    cameraEntity,
    ambientLightEntity,
    pointLightEntity,
    lightControls,
  };

  setCameraResetEnabled(false);

  if (assetSelect !== null) {
    for (const asset of sampleAssets) {
      const option = document.createElement("option");
      option.value = asset.id;
      option.textContent = asset.label;
      assetSelect.append(option);
    }

    assetSelect.value = initialSampleSelection.asset.id;
    assetSelect.addEventListener("change", () => {
      loadSelectedAsset(aperture, app, scene).catch((error) => {
        scene.loadState = failure(
          "glb-viewer-load-failed",
          error instanceof Error ? error.message : "GLB asset load failed.",
        );
      });
    });
  }

  if (customUrlForm !== null) {
    if (
      customUrlInput instanceof HTMLInputElement &&
      initialCustomUrl !== null
    ) {
      customUrlInput.value = initialCustomUrl.href;
    }

    customUrlForm.addEventListener("submit", (event) => {
      event.preventDefault();
      loadCustomUrlAsset(aperture, app, scene).catch((error) => {
        scene.loadState = failure(
          "glb-viewer-load-failed",
          error instanceof Error ? error.message : "GLB URL load failed.",
        );
      });
    });
  }

  if (cameraResetButton instanceof HTMLButtonElement) {
    cameraResetButton.addEventListener("click", () => {
      resetOrbitToFit(scene.orbit);
      updateOrbitCamera(aperture, cameraEntity, scene.orbit);
    });
  }

  bindShadowControlInputs(aperture, scene);
  bindIblControlInputs(aperture, scene);
  bindAnimationControlInputs(aperture, scene);
  bindLightControlInputs(aperture, scene);
  updateShadowControlInputs(scene);
  updateIblControlInputs(scene);
  updateAnimationControlInputs(scene);

  return scene;
}

async function loadInitialAsset(aperture, app, scene) {
  if (scene.initialCustomUrl !== null) {
    scene.sampleSelection = emptySampleSelectionStatus();
    await loadAsset(aperture, app, scene, {
      id: "custom-url",
      label: "Custom URL",
      url: scene.initialCustomUrl,
      source: "custom",
    });
    return;
  }

  await loadAsset(aperture, app, scene, scene.asset);
}

async function loadSelectedAsset(aperture, app, scene) {
  const asset =
    sampleAssets.find((entry) => entry.id === assetSelect?.value) ??
    sampleAssets[0];

  scene.sampleSelection = {
    requestedAssetId: asset.id,
    activeAssetId: asset.id,
    diagnostics: [],
  };
  await loadAsset(aperture, app, scene, asset);
}

async function loadCustomUrlAsset(aperture, app, scene) {
  if (!(customUrlInput instanceof HTMLInputElement)) {
    throw new Error("Custom GLB URL input is unavailable.");
  }

  const rawUrl = customUrlInput.value.trim();

  if (rawUrl.length === 0) {
    throw new Error("Custom GLB URL is empty.");
  }

  const url = new URL(rawUrl, globalThis.location.href);

  if (!url.pathname.toLowerCase().endsWith(".glb")) {
    throw new Error("Custom GLB URL must end in .glb.");
  }

  scene.sampleSelection = emptySampleSelectionStatus();
  await loadAsset(aperture, app, scene, {
    id: "custom-url",
    label: "Custom URL",
    url,
    source: "custom",
  });
}

async function loadAsset(aperture, app, scene, asset) {
  const loadSequence = scene.loadSequence + 1;
  const keyPrefix = `viewer-${asset.id}-${loadSequence}`;

  scene.loadSequence = loadSequence;
  scene.asset = asset;
  scene.loadState = {
    ok: true,
    phase: "loading",
    asset: {
      id: asset.id,
      label: asset.label,
      source: asset.source,
      url: formatAssetUrl(asset.url),
    },
  };
  setCameraResetEnabled(false);
  destroyActiveScene(scene);

  const loaded = await aperture.loadGlbFromUri(asset.url.href, {
    keyPrefix,
    createAssetMapping: true,
    createMeshAssets: true,
  });
  const importReport = loaded.loader?.glbImportReport.importReport ?? null;

  if (scene.loadSequence !== loadSequence) {
    return;
  }

  if (!loaded.ok || importReport === null) {
    throw new Error(loaded.diagnostics[0]?.message ?? "GLB did not load.");
  }

  if (
    importReport.assetMapping === null ||
    importReport.meshConstruction === null ||
    importReport.meshPrimitive === null
  ) {
    throw new Error("GLB did not produce renderable source assets.");
  }

  const registration = aperture.registerGltfSourceAssetsFromReports({
    registry: app.assets,
    assetMapping: importReport.assetMapping,
    meshConstruction: importReport.meshConstruction,
  });
  const sourceRegistration = registration.sourceRegistration;
  const meshRegistration = registration.meshRegistration;

  if (sourceRegistration === null || meshRegistration === null) {
    throw new Error("GLB source registration was not produced.");
  }

  const primitiveMaterials =
    aperture.createGltfPrimitiveMaterialResolutionReport({
      primitiveReport: importReport.meshPrimitive,
      registrationReport: sourceRegistration,
      keyPrefix,
    });
  const commandPlan = aperture.createGltfEcsAuthoringCommandPlan({
    traversalReport: importReport.sceneTraversal,
    meshRegistrationReport: meshRegistration,
    primitiveMaterialReport: primitiveMaterials,
  });
  const replay = aperture.applyGltfEcsCommandPlanToApp({
    app,
    plan: commandPlan,
  });
  const animation = createGltfAnimationState({
    aperture,
    root: loaded.loader.glbImportReport.container.container.json,
    binary: loaded.loader.glbImportReport.container.container.binaryChunk,
    keyPrefix,
    replay,
  });

  updateActiveAnimation(aperture, animation, 0);
  aperture.resolveWorldTransforms(app.world);
  const fit = fitOrbitToReplayBounds(aperture, app, replay, scene.orbit);
  const shadowScene =
    asset.id === "brass"
      ? createBrassShadowScene(aperture, app, replay, fit)
      : null;

  scene.active = {
    asset,
    keyPrefix,
    loaded,
    registration,
    primitiveMaterials,
    commandPlan,
    replay,
    animation,
    fit,
    shadowScene,
  };
  scene.loadState = null;
  setCameraResetEnabled(fit.status === "ready");
  updateShadowControlInputs(scene);
  updateIblControlInputs(scene);
  updateAnimationControlInputs(scene);
}

function destroyActiveScene(scene) {
  if (scene.active === null) {
    return;
  }

  for (const entity of scene.active.replay.entitiesByKey.values()) {
    entity.destroy();
  }

  for (const entity of scene.active.shadowScene?.entities ?? []) {
    entity.destroy();
  }

  scene.active = null;
  updateShadowControlInputs(scene);
  updateIblControlInputs(scene);
  updateAnimationControlInputs(scene);
}

function createBrassShadowScene(aperture, app, replay, fit) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const environmentMap =
    aperture.createEnvironmentMapHandle("glb-viewer-studio");
  const floorWidth = Math.max(2.4, fit.size[0] * 2.6);
  const floorDepth = Math.max(1.8, fit.size[2] * 2.4);
  const floorHeight = 0.12;
  const floorMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "GlbViewerShadowReceiverFloor",
      width: floorWidth,
      height: floorHeight,
      depth: floorDepth,
    }),
    { id: "glb-viewer-shadow-floor" },
  );
  const floorMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "GlbViewerShadowReceiverFloorStandard",
      baseColorFactor: new Float32Array([0.82, 0.86, 0.78, 1]),
      metallicFactor: 0,
      roughnessFactor: 0.82,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "glb-viewer-shadow-floor-standard" },
  );
  const context = { app, world: app.world, assets: app.assets };
  const replayMeshEntities = [];
  const iblResources = enableIblSampling
    ? createGlbViewerIblResources(aperture, app)
    : null;

  if (enableIblSampling) {
    app.assets.register(environmentMap, { label: "GLB viewer studio IBL" });
    app.assets.markReady(environmentMap, {
      label: "GLB viewer studio IBL",
      diffuseResourceKey: "glb-viewer-studio/diffuse",
      specularResourceKey: "glb-viewer-studio/specular-proof",
    });
  }

  for (const entity of replay.entitiesByKey.values()) {
    if (
      !entity.hasComponent(aperture.Mesh) ||
      !entity.hasComponent(aperture.Material)
    ) {
      continue;
    }

    replayMeshEntities.push(entity);

    if (entity.hasComponent(aperture.ShadowCaster)) {
      entity.setValue(
        aperture.ShadowCaster,
        "enabled",
        shadowControls.casterEnabled,
      );
    } else {
      aperture.withShadowCaster(shadowControls.casterEnabled)(entity, context);
    }

    if (entity.hasComponent(aperture.ShadowReceiver)) {
      entity.setValue(aperture.ShadowReceiver, "enabled", false);
    } else {
      aperture.withShadowReceiver(false)(entity, context);
    }
  }

  const floorEntity = app.spawn(
    aperture.withTransform({
      translation: [
        fit.center[0],
        fit.center[1] - Math.max(0.62, fit.size[1] * 0.62),
        fit.center[2] - 0.12,
      ],
    }),
    aperture.withMesh(floorMesh),
    aperture.withMaterial(floorMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withShadowCaster(false),
    aperture.withShadowReceiver(shadowControls.receiverEnabled),
  );
  const lightEntity = app.spawn(
    aperture.withTransform({
      rotation: [-0.330366, -0.24321, -0.088521, 0.907673],
    }),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 1.8,
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
  const environmentEntity = enableIblSampling
    ? app.spawn(
        aperture.withEnvironmentMap(environmentMap, {
          color: [1, 1, 1, 1],
          intensity: iblControls.enabled ? 0.52 : 0,
          layerMask: 1,
        }),
      )
    : null;

  if (environmentEntity !== null) {
    setEnvironmentMapComponent(
      aperture,
      environmentEntity,
      aperture.assetHandleKey(environmentMap),
      iblControls.enabled,
    );
  }

  return {
    controls: shadowControls,
    casterEntities: replayMeshEntities,
    receiverEntities: [floorEntity],
    iblControls,
    iblAvailable: enableIblSampling,
    specularIblAvailable: enableIblSampling && enableSpecularIblSampling,
    environmentEntity,
    environmentMapKey: aperture.assetHandleKey(environmentMap),
    iblResources,
    floorMeshKey: aperture.assetHandleKey(floorMesh),
    floorMaterialKey: aperture.assetHandleKey(floorMaterial),
    casterCount: replayMeshEntities.length,
    entities:
      environmentEntity === null
        ? [floorEntity, lightEntity]
        : [floorEntity, lightEntity, environmentEntity],
  };
}

function createGlbViewerIblResources(aperture, app) {
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const device = app.initialization.device;
  const diffuseResourceKey = "texture:glb-viewer-studio:diffuse:texture";
  const specularResourceKey =
    "texture:glb-viewer-studio:specular-proof:texture";
  const samplerResourceKey = "texture:glb-viewer-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let specularTexture = cache.specularTextures.get(specularResourceKey);
  let iblSampler = cache.samplers.get(samplerResourceKey);

  if (diffuseTexture === undefined) {
    diffuseTexture = createFaceColoredDiffuseCubeTexture(
      device,
      diffuseResourceKey,
    );
    cache.diffuseTextures.set(diffuseResourceKey, diffuseTexture);
  }

  if (enableSpecularIblSampling && specularTexture === undefined) {
    specularTexture = createFaceColoredSpecularCubeTexture(
      device,
      specularResourceKey,
    );
    cache.specularTextures.set(specularResourceKey, specularTexture);
  }

  if (iblSampler === undefined) {
    iblSampler = createDiffuseIblSampler(device, samplerResourceKey);
    cache.samplers.set(samplerResourceKey, iblSampler);
  }

  return {
    bindGroupResource: {
      ready: true,
      status: "available",
      standardMaterialCount: 1,
      group: 4,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 1,
      sections: {
        descriptorPlan: true,
        layoutResource: true,
        textureResources: true,
        samplerResource: true,
        bindGroupResource: true,
        shaderSampling: true,
      },
      resource: {
        group: 4,
        resourceKey: "bind-group:standard/ibl/group-4/glb-viewer-studio",
        layoutKey: "standard/ibl/group-4",
        bindGroup: { label: "standard/ibl/group-4/glb-viewer-studio" },
        entryResourceKeys:
          specularTexture === undefined
            ? [diffuseResourceKey, samplerResourceKey]
            : [diffuseResourceKey, specularResourceKey, samplerResourceKey],
      },
      diagnostics: [],
    },
    diffuseTextureResource: {
      ready: true,
      status: "available",
      textureSlotCount: 1,
      diffuseSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        diffuseTextureResource: true,
        gpuAllocation: true,
        specularPrefiltering: false,
        shaderSampling: true,
      },
      resources: [{ valid: true, resource: diffuseTexture, diagnostics: [] }],
      diagnostics: [],
    },
    ...(specularTexture === undefined
      ? {}
      : {
          specularTextureResource: {
            ready: true,
            status: "available",
            textureSlotCount: 1,
            specularSlotCount: 1,
            createdTextureCount: 1,
            reusedTextureCount: 0,
            sections: {
              texturePreparation: true,
              specularTextureResource: true,
              gpuAllocation: true,
              proofUpload: true,
              prefiltering: false,
              bindGroupResource: false,
              shaderSampling: true,
            },
            resources: [
              { valid: true, resource: specularTexture, diagnostics: [] },
            ],
            diagnostics: [
              {
                code: "iblTextureResource.specularPrefilteringDeferred",
                severity: "warning",
                message:
                  "Specular IBL texture resource uses a deterministic minimal mip chain; full PMREM/GGX prefiltering remains deferred.",
              },
            ],
          },
        }),
    samplerResource: {
      ready: true,
      status: "available",
      samplerDescriptorCount: 1,
      createdSamplerCount: 1,
      reusedSamplerCount: 0,
      sections: {
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: true,
        shaderSampling: true,
      },
      resources: [{ valid: true, resource: iblSampler, diagnostics: [] }],
      diagnostics: [],
    },
  };
}

function createFaceColoredDiffuseCubeTexture(device, resourceKey) {
  const texture = device.createTexture({
    label: "glb-viewer-studio:diffuse-ibl",
    size: [1, 1, 6],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount: 1,
  });
  const faceColors = [
    [238, 122, 56, 255],
    [48, 138, 230, 255],
    [235, 226, 126, 255],
    [38, 82, 74, 255],
    [198, 88, 218, 255],
    [72, 80, 126, 255],
  ];

  faceColors.forEach((color, face) => {
    const data = new Uint8Array(256);
    data.set(color, 0);
    device.queue.writeTexture(
      { texture, origin: [0, 0, face] },
      data,
      { bytesPerRow: 256, rowsPerImage: 1 },
      [1, 1, 1],
    );
  });

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "glb-viewer-studio:diffuse-ibl-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "glb-viewer-studio:diffuse-ibl",
      size: [1, 1, 6],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      mipLevelCount: 1,
    },
    viewDescriptor: { dimension: "cube" },
  };
}

function createFaceColoredSpecularCubeTexture(device, resourceKey) {
  const baseSize = 8;
  const mipLevelCount = 4;
  const texture = device.createTexture({
    label: "glb-viewer-studio:specular-ibl-minimal-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount,
  });
  const mipFaceColors = [
    [
      [255, 246, 214, 255],
      [82, 116, 168, 255],
      [245, 238, 184, 255],
      [28, 44, 56, 255],
      [248, 214, 255, 255],
      [44, 50, 76, 255],
    ],
    [
      [218, 202, 178, 255],
      [94, 118, 150, 255],
      [220, 212, 172, 255],
      [50, 66, 74, 255],
      [214, 184, 220, 255],
      [64, 70, 92, 255],
    ],
    [
      [118, 114, 106, 255],
      [84, 92, 106, 255],
      [118, 116, 106, 255],
      [62, 70, 76, 255],
      [114, 104, 120, 255],
      [68, 72, 84, 255],
    ],
    [
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
    ],
  ];

  mipFaceColors.forEach((faceColors, mipLevel) => {
    const mipSize = Math.max(1, baseSize >> mipLevel);

    faceColors.forEach((color, face) => {
      const data = new Uint8Array(256 * mipSize);

      for (let row = 0; row < mipSize; row += 1) {
        for (let column = 0; column < mipSize; column += 1) {
          data.set(color, row * 256 + column * 4);
        }
      }

      device.queue.writeTexture(
        { texture, mipLevel, origin: [0, 0, face] },
        data,
        { bytesPerRow: 256, rowsPerImage: mipSize },
        [mipSize, mipSize, 1],
      );
    });
  });

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "glb-viewer-studio:specular-ibl-minimal-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "glb-viewer-studio:specular-ibl-minimal-mip-chain",
      size: [baseSize, baseSize, 6],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      mipLevelCount,
    },
    viewDescriptor: { dimension: "cube" },
  };
}

function createDiffuseIblSampler(device, resourceKey) {
  const descriptor = {
    label: "glb-viewer-studio:diffuse-ibl-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 3,
    maxAnisotropy: 1,
  };

  return {
    resourceKey,
    sampler: device.createSampler(descriptor),
    descriptor,
  };
}

function startRendering(aperture, app, scene) {
  let frame = 0;
  let standardMaterialShadowReceiverResources = null;

  const render = async () => {
    try {
      frame += 1;
      updateActiveAnimation(
        aperture,
        scene.active?.animation ?? null,
        frame / 60,
      );
      updateAnimationControlInputs(scene);
      updateOrbitCamera(aperture, scene.cameraEntity, scene.orbit);
      const step = app.step(0, frame / 60);
      const report = await app.render({
        frame,
        clearColor,
        label: "glb-viewer-app",
        ...(scene.active?.shadowScene?.controls.receiverEnabled !== true ||
        scene.active.shadowScene.controls.casterEnabled !== true ||
        standardMaterialShadowReceiverResources === null
          ? {}
          : { standardMaterialShadowReceiverResources }),
        ...(scene.active?.shadowScene?.iblResources === null ||
        scene.active?.shadowScene?.iblResources === undefined ||
        scene.active.shadowScene.iblControls.enabled !== true
          ? {}
          : {
              standardMaterialIblResources:
                scene.active.shadowScene.iblResources,
            }),
      });

      const nextFrameResources = await createStatus(
        aperture,
        app,
        scene,
        step,
        report,
        frame,
      );

      standardMaterialShadowReceiverResources =
        nextFrameResources.standardMaterialShadowReceiverResources;
      requestAnimationFrame(render);
    } catch (error) {
      publishStatus(
        failure(
          "glb-viewer-render-failed",
          error instanceof Error ? error.message : "GLB viewer render failed.",
        ),
      );
    }
  };

  requestAnimationFrame(render);
}

async function createStatus(aperture, app, scene, step, report, frame) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const active = scene.active;
  const shadowFrame = await createViewerShadowFrame({
    aperture,
    app,
    report,
    reportJson,
    active,
  });

  publishStatus({
    example: "glb-viewer",
    ok: report.ok,
    phase: "render",
    renderingBackend: "webgpu-explicit",
    frame,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    selectedAsset: {
      id: scene.asset.id,
      label: scene.asset.label,
      source: scene.asset.source,
      url: formatAssetUrl(scene.asset.url),
      loading: scene.loadState?.phase === "loading",
      materialFamilies: createMaterialFamilyStatus(aperture, app, active),
    },
    selection: {
      ...scene.sampleSelection,
      activeAssetId: scene.asset.id,
    },
    source: {
      url: formatAssetUrl(active?.asset.url ?? scene.asset.url),
      ok: active?.loaded.ok ?? false,
      byteLength: active?.loaded.byteLength ?? null,
      status: active?.loaded.loader?.status ?? null,
      outputSummary: active?.loaded.loader?.outputSummary ?? null,
      diagnostics: active?.loaded.diagnostics ?? [],
    },
    gltf: {
      registration: {
        valid: active?.registration.valid ?? false,
        diagnostics: active?.registration.diagnostics.length ?? 0,
      },
      primitiveMaterials: {
        valid: active?.primitiveMaterials.valid ?? false,
        resolved: active?.primitiveMaterials.resolved.length ?? 0,
        diagnostics: active?.primitiveMaterials.diagnostics.length ?? 0,
        families: createMaterialFamilyStatus(aperture, app, active),
        resolutions: createPrimitiveMaterialResolutionStatus(
          aperture,
          app,
          active,
        ),
      },
      commandPlan: {
        valid: active?.commandPlan.valid ?? false,
        commands: active?.commandPlan.commands.length ?? 0,
        dependencies: active?.commandPlan.dependencies.length ?? 0,
      },
      replay: {
        valid: active?.replay.valid ?? false,
        created: active?.replay.created.length ?? 0,
        diagnostics: active?.replay.diagnostics.length ?? 0,
      },
      metadata: createGltfMetadataStatus(active),
    },
    orbit: {
      yaw: Number(scene.orbit.yaw.toFixed(4)),
      elevation: Number(scene.orbit.elevation.toFixed(4)),
      distance: Number(scene.orbit.distance.toFixed(3)),
      target: roundTuple(scene.orbit.target, 3),
      fit: scene.orbit.fit,
      resetAvailable: scene.orbit.fit.status === "ready",
      dragging: scene.orbit.dragging,
    },
    lighting: createLightingControlStatus(aperture, scene, report.snapshot),
    animation: createAnimationStatus(active?.animation ?? null),
    hierarchy: createHierarchyStatus(aperture, active),
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      environments: report.snapshot.environments.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    ibl: createIblStatus(aperture, active, reportJson),
    shadow: createShadowStatus(
      aperture,
      active,
      report.snapshot.meshDraws,
      shadowFrame,
    ),
    renderState: createRenderStateStatus(report.snapshot.meshDraws),
    draw: {
      packages: report.counts.drawPackages,
      drawCalls: reportJson.counts.drawCalls,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    report: reportJson,
    step,
    canvas: {
      width: canvas?.width ?? 0,
      height: canvas?.height ?? 0,
    },
  });

  return {
    standardMaterialShadowReceiverResources:
      active?.shadowScene?.controls.receiverEnabled === true &&
      active.shadowScene.controls.casterEnabled === true &&
      shadowFrame !== null &&
      shadowFrame.receiverResources !== null
        ? shadowFrame.receiverResources
        : null,
  };
}

async function createViewerShadowFrame({
  aperture,
  app,
  report,
  reportJson,
  active,
}) {
  const shadowScene = active?.shadowScene ?? null;

  if (shadowScene === null) {
    return null;
  }

  const shadowRequests = report.snapshot.shadowRequests.filter(
    (request) => request.lightKind === "directional",
  );
  const shadowDescriptor = aperture.shadowMapDescriptorReportToJsonValue(
    aperture.createShadowMapDescriptorReport({
      shadowRequests,
      descriptors: shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        mapSize: shadowIntent.mapSize,
        depthBias: shadowIntent.depthBias,
        normalBias: shadowIntent.normalBias,
      })),
    }),
  );
  const shadowTextures = aperture.shadowTextureResourceReportToJsonValue(
    aperture.createShadowTextureResourceReport({
      descriptors: shadowDescriptor,
    }),
  );

  shadowDepthTextureResourceReport ??=
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
    });

  const shadowDepthTextureResources =
    aperture.shadowDepthTextureResourceReportToJsonValue(
      shadowDepthTextureResourceReport,
    );
  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:glb-viewer-directional",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowSamplerResource = aperture.shadowSamplerResourceReportToJsonValue(
    shadowSamplerResourceReport,
  );
  const shadowPassPlan = aperture.shadowPassPlanReportToJsonValue(
    aperture.createShadowPassPlanReport({
      shadowRequests,
      textures: shadowTextures,
      submission: "ready",
    }),
  );
  const shadowPassAttachments =
    aperture.shadowPassAttachmentDescriptorReportToJsonValue(
      aperture.createShadowPassAttachmentDescriptorReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
      }),
    );
  const shadowViewProjection =
    aperture.directionalShadowViewProjectionPlanReportToJsonValue(
      aperture.createDirectionalShadowViewProjectionPlanReport({
        shadowRequests,
        lights: report.snapshot.lights,
        shadowPassPlan,
        computation: "ready",
      }),
    );
  const shadowMatrixComputation =
    aperture.directionalShadowMatrixComputationReportToJsonValue(
      aperture.createDirectionalShadowMatrixComputationReport({
        viewProjection: shadowViewProjection,
        transforms: report.snapshot.transforms,
      }),
    );
  const shadowMatrixBuffer =
    aperture.shadowMatrixBufferDescriptorReportToJsonValue(
      aperture.createShadowMatrixBufferDescriptorReport({
        viewProjection: shadowViewProjection,
        upload: "ready",
        resourceKey: "shadow-matrix-buffer:glb-viewer-directional",
        label: "GlbViewerDirectionalShadowMatrices/storage",
      }),
    );
  const shadowMatrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: shadowMatrixBuffer,
      matrices: shadowMatrixComputation,
    });
  const shadowMatrixBufferResource =
    aperture.shadowMatrixBufferResourceReportToJsonValue(
      shadowMatrixBufferResourceReport,
    );
  const shadowCasterDrawList =
    aperture.shadowCasterDrawListPlanReportToJsonValue(
      aperture.createShadowCasterDrawListPlanReport({
        shadowRequests,
        meshDraws: report.snapshot.meshDraws,
        shadowPassPlan,
        commandEncoding: "ready",
      }),
    );
  const shadowCommandPlan =
    aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
      aperture.createShadowCasterCommandPlanReadinessReport({
        shadowPassPlan,
        viewProjection: shadowViewProjection,
        matrixBuffer: shadowMatrixBuffer,
        casterDrawList: shadowCasterDrawList,
        commandEncoding: "ready",
      }),
    );
  const shadowPassCommandEncoding =
    aperture.shadowPassCommandEncodingReportToJsonValue(
      aperture.createShadowPassCommandEncodingReport({
        shadowPassPlan,
        depthTextureResources: shadowDepthTextureResourceReport,
        matrixBufferResource: shadowMatrixBufferResourceReport,
        casterDrawList: shadowCasterDrawList,
        commandPlan: shadowCommandPlan,
        commandEncoding: "ready",
      }),
    );
  const shadowCasterPipelineDescriptor =
    aperture.shadowCasterPipelineDescriptorReportToJsonValue(
      aperture.createShadowCasterPipelineDescriptorReport({
        commandEncoding: shadowPassCommandEncoding,
      }),
    );
  const shadowCasterPipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: shadowCasterPipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const shadowCasterPipelineResource =
    aperture.shadowCasterPipelineResourceReportToJsonValue(
      shadowCasterPipelineResourceReport,
    );
  const shadowCasterMatrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      layout:
        shadowCasterPipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const shadowCasterMatrixBindGroupResource =
    aperture.shadowCasterMatrixBindGroupResourceReportToJsonValue(
      shadowCasterMatrixBindGroupResourceReport,
    );
  const shadowCasterFrameResources =
    aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
      aperture.createShadowCasterFrameResourceReadinessReport({
        casterDrawList: shadowCasterDrawList,
        preparedMeshes: createShadowCasterPreparedMeshViews(report),
        matrixBufferResource: shadowMatrixBufferResourceReport,
        pipelineDescriptor: shadowCasterPipelineDescriptor,
      }),
    );
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources: shadowCasterFrameResources,
      commandPlan: shadowCommandPlan,
      pipelines:
        shadowCasterPipelineResourceReport.resource === null
          ? []
          : [
              {
                pipelineKey:
                  shadowCasterPipelineResourceReport.resource.pipelineKey,
                resourceKey:
                  shadowCasterPipelineResourceReport.resource.resourceKey,
                pipeline: shadowCasterPipelineResourceReport.resource.pipeline,
              },
            ],
      matrixBindGroups:
        shadowCasterMatrixBindGroupResourceReport.resource === null
          ? []
          : [
              {
                matrixResourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .matrixResourceKey,
                resourceKey:
                  shadowCasterMatrixBindGroupResourceReport.resource
                    .resourceKey,
                group: shadowCasterMatrixBindGroupResourceReport.resource.group,
                bindGroup:
                  shadowCasterMatrixBindGroupResourceReport.resource.bindGroup,
              },
            ],
      meshes: createShadowCasterExecutableMeshViews(report),
    });
  const shadowCasterCommandRecords =
    aperture.shadowCasterCommandRecordPlanReportToJsonValue(
      shadowCasterCommandRecordPlan,
    );
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: "shadow-pass:glb-viewer-directional",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: shadowPassAttachments,
      frameResources: shadowCasterFrameResources,
      commandEncoding: shadowPassCommandEncoding,
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        resolveShadowDepthView(shadowDepthTextureResourceReport, attachment),
    });
  const shadowPassEncoderAssembly =
    aperture.shadowPassEncoderAssemblyReportToJsonValue(
      shadowPassEncoderAssemblyReport,
    );
  const shadowPassCommandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: shadowPassEncoderAssemblyReport,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: "shadow-pass:glb-viewer-directional",
      submit: shadowScene.controls.casterEnabled,
    });
  const shadowPassCommandBufferSubmission =
    aperture.shadowPassCommandBufferSubmissionReportToJsonValue(
      shadowPassCommandBufferSubmissionReport,
    );
  const route = findDirectionalShadowRoute(reportJson);
  const receiverResources =
    shadowMatrixBufferResourceReport.resource !== null &&
    shadowDepthTextureResourceReport.resources.some(
      (resource) => resource.allocation.resource !== null,
    ) &&
    shadowSamplerResourceReport.resource !== null
      ? {
          shadowKind: "directional",
          matrixBufferResource: shadowMatrixBufferResourceReport,
          depthTextureResources: shadowDepthTextureResourceReport,
          samplerResource: shadowSamplerResourceReport,
        }
      : null;

  return {
    descriptor: shadowDescriptor,
    textures: shadowTextures,
    depthTextureResources: shadowDepthTextureResources,
    samplerResource: shadowSamplerResource,
    passPlan: shadowPassPlan,
    passAttachments: shadowPassAttachments,
    viewProjection: shadowViewProjection,
    matrixComputation: shadowMatrixComputation,
    matrixBuffer: shadowMatrixBuffer,
    matrixBufferResource: shadowMatrixBufferResource,
    casterDrawList: shadowCasterDrawList,
    commandPlan: shadowCommandPlan,
    commandEncoding: shadowPassCommandEncoding,
    pipelineDescriptor: shadowCasterPipelineDescriptor,
    pipelineResource: shadowCasterPipelineResource,
    matrixBindGroupResource: shadowCasterMatrixBindGroupResource,
    frameResources: shadowCasterFrameResources,
    commandRecords: shadowCasterCommandRecords,
    encoderAssembly: shadowPassEncoderAssembly,
    commandBufferSubmission: shadowPassCommandBufferSubmission,
    commandBufferSubmissionReport: shadowPassCommandBufferSubmissionReport,
    route,
    receiverResources,
  };
}

function createIblStatus(aperture, active, reportJson) {
  const shadowScene = active?.shadowScene ?? null;
  const resources = shadowScene?.iblResources ?? null;
  const pipelineKeys = routedPipelineKeys(reportJson);
  const diffuseKey =
    resources?.diffuseTextureResource.resources[0]?.resource?.resourceKey ??
    null;
  const specularKey =
    resources?.specularTextureResource?.resources[0]?.resource?.resourceKey ??
    null;
  const samplerKey =
    resources?.samplerResource.resources[0]?.resource?.resourceKey ?? null;
  const diffuseRoute = pipelineKeys.find((key) => key.includes("iblDiffuse"));
  const specularRoute = pipelineKeys.find((key) =>
    key.includes("iblSpecularProof"),
  );

  return {
    enabled:
      shadowScene?.iblAvailable === true &&
      shadowScene.iblControls.enabled === true,
    controls: {
      enabled: shadowScene?.iblControls.enabled ?? iblControls.enabled,
      available: shadowScene?.iblAvailable === true,
    },
    ecs: createIblEcsStatus(aperture, shadowScene),
    specularProof:
      shadowScene?.specularIblAvailable === true &&
      shadowScene.iblControls.enabled === true,
    environmentMapKey: shadowScene?.environmentMapKey ?? null,
    resources: {
      diffuseTexture: diffuseKey,
      specularTexture: specularKey,
      sampler: samplerKey,
    },
    rendering: {
      supported:
        shadowScene?.iblAvailable === true &&
        shadowScene.iblControls.enabled === true &&
        diffuseRoute !== undefined,
      diffusePipelineKey: diffuseRoute ?? null,
      specularPipelineKey: specularRoute ?? null,
      pipelineKeys,
    },
  };
}

function createIblEcsStatus(aperture, shadowScene) {
  const environmentEntity = shadowScene?.environmentEntity ?? null;

  if (environmentEntity === null) {
    return {
      environmentMapKey: null,
      intensity: null,
      environmentEntityCount: 0,
    };
  }

  const environmentMapId =
    environmentEntity.getValue(aperture.Light, "environmentMapId") ?? "";

  return {
    environmentMapKey: environmentMapId === "" ? null : environmentMapId,
    intensity: Number(
      (environmentEntity.getValue(aperture.Light, "intensity") ?? 0).toFixed(3),
    ),
    environmentEntityCount: 1,
  };
}

function createShadowStatus(aperture, active, meshDraws, shadowFrame) {
  const shadowScene = active?.shadowScene ?? null;

  if (shadowScene === null) {
    return {
      enabled: false,
      controls: {
        receiverEnabled: shadowControls.receiverEnabled,
        casterEnabled: shadowControls.casterEnabled,
      },
      ecs: {
        casterEnabled: null,
        receiverEnabled: null,
        casterEntityCount: 0,
        receiverEntityCount: 0,
        enabledCasterEntityCount: 0,
        enabledReceiverEntityCount: 0,
      },
      authoring: createShadowAuthoringStatus(meshDraws),
      requests: [],
      rendering: {
        supported: false,
        mode: "absent",
        pipelineKey: null,
      },
    };
  }

  return {
    enabled: true,
    controls: {
      receiverEnabled: shadowScene.controls.receiverEnabled,
      casterEnabled: shadowScene.controls.casterEnabled,
    },
    ecs: createShadowEcsStatus(aperture, shadowScene),
    floor: {
      meshKey: shadowScene.floorMeshKey,
      materialKey: shadowScene.floorMaterialKey,
    },
    authoring: createShadowAuthoringStatus(meshDraws),
    requests:
      shadowFrame?.passPlan.passes.map((pass) => ({
        shadowId: pass.shadowId,
        lightId: pass.lightId,
        casterLayerMask: pass.casterLayerMask,
        receiverLayerMask: pass.receiverLayerMask,
      })) ?? [],
    descriptor: shadowFrame?.descriptor ?? null,
    depthTextureResources: shadowFrame?.depthTextureResources ?? null,
    samplerResource: shadowFrame?.samplerResource ?? null,
    passPlan: shadowFrame?.passPlan ?? null,
    viewProjection: shadowFrame?.viewProjection ?? null,
    matrixComputation: shadowFrame?.matrixComputation ?? null,
    casterDrawList: shadowFrame?.casterDrawList ?? null,
    commandEncoding: shadowFrame?.commandEncoding ?? null,
    pipelineResource: shadowFrame?.pipelineResource ?? null,
    frameResources: shadowFrame?.frameResources ?? null,
    encoderAssembly: shadowFrame?.encoderAssembly ?? null,
    commandBufferSubmission: shadowFrame?.commandBufferSubmission ?? null,
    rendering: {
      supported:
        shadowScene.controls.receiverEnabled &&
        shadowScene.controls.casterEnabled &&
        shadowFrame?.commandBufferSubmissionReport.status === "submitted" &&
        shadowFrame.route !== null,
      mode: "directional-depth-compare",
      filter: "pcf-3x3",
      pipelineKey: shadowFrame?.route?.pipelineKey ?? null,
    },
  };
}

function createShadowEcsStatus(aperture, shadowScene) {
  const casterValues = shadowScene.casterEntities.map((entity) =>
    entity.hasComponent(aperture.ShadowCaster)
      ? entity.getValue(aperture.ShadowCaster, "enabled") !== false
      : true,
  );
  const receiverValues = shadowScene.receiverEntities.map((entity) =>
    entity.hasComponent(aperture.ShadowReceiver)
      ? entity.getValue(aperture.ShadowReceiver, "enabled") !== false
      : true,
  );

  return {
    casterEnabled:
      casterValues.length > 0 && casterValues.every((enabled) => enabled),
    receiverEnabled:
      receiverValues.length > 0 && receiverValues.every((enabled) => enabled),
    casterEntityCount: casterValues.length,
    receiverEntityCount: receiverValues.length,
    enabledCasterEntityCount: casterValues.filter(Boolean).length,
    enabledReceiverEntityCount: receiverValues.filter(Boolean).length,
  };
}

function createLightingControlStatus(aperture, scene, snapshot) {
  const ambientPacket = snapshot.lights.find(
    (light) => light.kind === aperture.LightKind.Ambient,
  );
  const pointPacket = snapshot.lights.find(
    (light) => light.kind === aperture.LightKind.Point,
  );

  return {
    controls: {
      ambientIntensity: Number(scene.lightControls.ambientIntensity.toFixed(3)),
      pointIntensity: Number(scene.lightControls.pointIntensity.toFixed(3)),
    },
    ecs: {
      ambientIntensity: Number(
        (
          scene.ambientLightEntity.getValue(aperture.Light, "intensity") ?? 0
        ).toFixed(3),
      ),
      pointIntensity: Number(
        (
          scene.pointLightEntity.getValue(aperture.Light, "intensity") ?? 0
        ).toFixed(3),
      ),
    },
    extracted: {
      ambientIntensity:
        ambientPacket === undefined
          ? null
          : Number(ambientPacket.intensity.toFixed(3)),
      pointIntensity:
        pointPacket === undefined
          ? null
          : Number(pointPacket.intensity.toFixed(3)),
    },
  };
}

function bindShadowControlInputs(aperture, scene) {
  if (shadowReceiverToggle instanceof HTMLInputElement) {
    shadowReceiverToggle.checked = shadowControls.receiverEnabled;
    shadowReceiverToggle.addEventListener("change", () => {
      setSceneShadowReceiverEnabled(
        aperture,
        scene,
        shadowReceiverToggle.checked,
      );
    });
  }

  if (shadowCasterToggle instanceof HTMLInputElement) {
    shadowCasterToggle.checked = shadowControls.casterEnabled;
    shadowCasterToggle.addEventListener("change", () => {
      setSceneShadowCasterEnabled(aperture, scene, shadowCasterToggle.checked);
    });
  }
}

function updateShadowControlInputs(scene) {
  const shadowScene = scene.active?.shadowScene ?? null;
  const hasShadowScene = shadowScene !== null;
  const receiverEnabled =
    shadowScene?.controls.receiverEnabled ?? shadowControls.receiverEnabled;
  const casterEnabled =
    shadowScene?.controls.casterEnabled ?? shadowControls.casterEnabled;

  if (shadowReceiverToggle instanceof HTMLInputElement) {
    shadowReceiverToggle.checked = receiverEnabled;
    shadowReceiverToggle.disabled = !hasShadowScene;
  }

  if (shadowCasterToggle instanceof HTMLInputElement) {
    shadowCasterToggle.checked = casterEnabled;
    shadowCasterToggle.disabled = !hasShadowScene;
  }
}

function setSceneShadowReceiverEnabled(aperture, scene, enabled) {
  shadowControls.receiverEnabled = enabled;
  const shadowScene = scene.active?.shadowScene ?? null;

  if (shadowScene !== null) {
    shadowScene.controls.receiverEnabled = enabled;
    for (const entity of shadowScene.receiverEntities) {
      setShadowReceiverComponent(aperture, entity, enabled);
    }
  }

  updateShadowControlInputs(scene);
}

function setSceneShadowCasterEnabled(aperture, scene, enabled) {
  shadowControls.casterEnabled = enabled;
  const shadowScene = scene.active?.shadowScene ?? null;

  if (shadowScene !== null) {
    shadowScene.controls.casterEnabled = enabled;
    for (const entity of shadowScene.casterEntities) {
      setShadowCasterComponent(aperture, entity, enabled);
    }
  }

  updateShadowControlInputs(scene);
}

function setShadowCasterComponent(aperture, entity, enabled) {
  if (entity.hasComponent(aperture.ShadowCaster)) {
    entity.setValue(aperture.ShadowCaster, "enabled", enabled);
    return;
  }

  entity.addComponent(aperture.ShadowCaster, { enabled });
}

function setShadowReceiverComponent(aperture, entity, enabled) {
  if (entity.hasComponent(aperture.ShadowReceiver)) {
    entity.setValue(aperture.ShadowReceiver, "enabled", enabled);
    return;
  }

  entity.addComponent(aperture.ShadowReceiver, { enabled });
}

function bindIblControlInputs(aperture, scene) {
  if (iblToggle instanceof HTMLInputElement) {
    iblToggle.checked = iblControls.enabled;
    iblToggle.addEventListener("change", () => {
      setSceneIblEnabled(aperture, scene, iblToggle.checked);
    });
  }
}

function updateIblControlInputs(scene) {
  const shadowScene = scene.active?.shadowScene ?? null;
  const hasIblControls = shadowScene?.iblAvailable === true;
  const enabled = shadowScene?.iblControls.enabled ?? iblControls.enabled;

  if (iblToggle instanceof HTMLInputElement) {
    iblToggle.checked = enabled;
    iblToggle.disabled = !hasIblControls;
  }
}

function setSceneIblEnabled(aperture, scene, enabled) {
  iblControls.enabled = enabled;
  const shadowScene = scene.active?.shadowScene ?? null;

  if (shadowScene !== null && shadowScene.iblAvailable) {
    shadowScene.iblControls.enabled = enabled;

    if (shadowScene.environmentEntity !== null) {
      setEnvironmentMapComponent(
        aperture,
        shadowScene.environmentEntity,
        shadowScene.environmentMapKey,
        enabled,
      );
    }
  }

  updateIblControlInputs(scene);
}

function setEnvironmentMapComponent(
  aperture,
  entity,
  environmentMapKey,
  enabled,
) {
  entity.setValue(
    aperture.Light,
    "environmentMapId",
    enabled ? environmentMapKey : "",
  );
  entity.setValue(aperture.Light, "intensity", enabled ? 0.52 : 0);
}

function bindAnimationControlInputs(aperture, scene) {
  if (animationToggleButton instanceof HTMLButtonElement) {
    animationToggleButton.addEventListener("click", () => {
      toggleActiveAnimationPlayback(aperture, scene);
    });
  }

  if (animationScrubInput instanceof HTMLInputElement) {
    animationScrubInput.addEventListener("input", () => {
      scrubActiveAnimation(
        aperture,
        scene,
        numberInputValue(animationScrubInput, 0),
      );
    });
  }
}

function updateAnimationControlInputs(scene) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;
  const hasAnimation = animation !== null && clip !== null;

  if (animationToggleButton instanceof HTMLButtonElement) {
    animationToggleButton.disabled = !hasAnimation;
    animationToggleButton.textContent =
      animation?.status === "paused" ? "play" : "pause";
  }

  if (animationScrubInput instanceof HTMLInputElement) {
    animationScrubInput.disabled = !hasAnimation;
    animationScrubInput.max =
      clip === null ? "0" : String(Number(clip.duration.toFixed(3)));
    animationScrubInput.value =
      animation === null ? "0" : String(Number(animation.time.toFixed(3)));
  }
}

function toggleActiveAnimationPlayback(aperture, scene) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    updateAnimationControlInputs(scene);
    return;
  }

  if (animation.status === "paused") {
    animation.status = "playing";
    animation.playbackOffset = animation.time - animation.lastElapsedSeconds;
  } else {
    animation.status = "paused";
    updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  }

  updateAnimationControlInputs(scene);
}

function scrubActiveAnimation(aperture, scene, time) {
  const animation = scene.active?.animation ?? null;
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    updateAnimationControlInputs(scene);
    return;
  }

  const duration = Math.max(0, clip.duration);
  animation.status = "paused";
  animation.time = clamp(time, 0, duration);
  animation.playbackOffset = animation.time - animation.lastElapsedSeconds;
  updateActiveAnimation(aperture, animation, animation.lastElapsedSeconds);
  updateAnimationControlInputs(scene);
}

function bindLightControlInputs(aperture, scene) {
  if (pointLightIntensityInput instanceof HTMLInputElement) {
    pointLightIntensityInput.value = String(scene.lightControls.pointIntensity);
    pointLightIntensityInput.addEventListener("input", () => {
      setScenePointLightIntensity(
        aperture,
        scene,
        numberInputValue(
          pointLightIntensityInput,
          scene.lightControls.pointIntensity,
        ),
      );
    });
  }

  if (ambientIntensityInput instanceof HTMLInputElement) {
    ambientIntensityInput.value = String(scene.lightControls.ambientIntensity);
    ambientIntensityInput.addEventListener("input", () => {
      setSceneAmbientIntensity(
        aperture,
        scene,
        numberInputValue(
          ambientIntensityInput,
          scene.lightControls.ambientIntensity,
        ),
      );
    });
  }
}

function setScenePointLightIntensity(aperture, scene, value) {
  scene.lightControls.pointIntensity = clamp(value, 0, 36);
  scene.pointLightEntity.setValue(
    aperture.Light,
    "intensity",
    scene.lightControls.pointIntensity,
  );
}

function setSceneAmbientIntensity(aperture, scene, value) {
  scene.lightControls.ambientIntensity = clamp(value, 0, 1);
  scene.ambientLightEntity.setValue(
    aperture.Light,
    "intensity",
    scene.lightControls.ambientIntensity,
  );
}

function numberInputValue(input, fallback) {
  const value = Number(input.value);

  return Number.isFinite(value) ? value : fallback;
}

function routedPipelineKeys(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return pipelines.flatMap((pipeline) =>
    typeof pipeline.pipelineKey === "string" ? [pipeline.pipelineKey] : [],
  );
}

function createShadowAuthoringStatus(meshDraws) {
  const casterCount = meshDraws.filter(
    (draw) => draw.castsShadow !== false,
  ).length;
  const receiverCount = meshDraws.filter(
    (draw) => draw.receivesShadow !== false,
  ).length;

  return {
    drawCount: meshDraws.length,
    casterCount,
    receiverCount,
    disabledCasterCount: meshDraws.length - casterCount,
    disabledReceiverCount: meshDraws.length - receiverCount,
  };
}

function createShadowCasterPreparedMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBufferResourceKeys: resource.vertexBuffers.map(
        (buffer) => buffer.resourceKey,
      ),
      indexBufferResourceKey: resource.indexBuffer?.resourceKey ?? null,
    });
  }

  return [...meshResourceByKey.values()];
}

function createShadowCasterExecutableMeshViews(report) {
  const meshResources = report.resources?.resources?.meshResources ?? [];
  const preparedMeshEntries =
    report.resourceReuse?.preparedMeshFacade?.entries ?? [];
  const meshResourceByLabel = new Map(
    meshResources.map((resource) => [resource.resourceKey, resource]),
  );
  const meshResourceByKey = new Map();

  for (const entry of preparedMeshEntries) {
    const resource = meshResourceByLabel.get(`mesh-buffer:${entry.label}`);

    if (resource === undefined) {
      continue;
    }

    meshResourceByKey.set(entry.assetKey, {
      meshKey: entry.assetKey,
      meshResourceKey: resource.resourceKey,
      vertexBuffers: resource.vertexBuffers.map((buffer) => ({
        resourceKey: buffer.resourceKey,
        buffer: buffer.buffer,
        vertexCount: buffer.vertexCount,
      })),
      indexBuffer:
        resource.indexBuffer === undefined
          ? null
          : {
              resourceKey: resource.indexBuffer.resourceKey,
              buffer: resource.indexBuffer.buffer,
              format: resource.indexBuffer.format,
              indexCount: resource.indexBuffer.indexCount,
            },
    });
  }

  return [...meshResourceByKey.values()];
}

function resolveShadowDepthView(depthTextureResourceReport, attachment) {
  for (const resource of depthTextureResourceReport.resources) {
    if (
      resource.shadowId !== attachment.shadowId ||
      resource.lightId !== attachment.lightId
    ) {
      continue;
    }

    const attachmentView = resource.attachmentViews.find(
      (view) => view.viewKey === attachment.viewKey,
    );

    if (attachmentView !== undefined) {
      return attachmentView.view;
    }

    return resource.allocation.resource?.view ?? null;
  }

  return null;
}

function findDirectionalShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find(
      (pipeline) =>
        pipeline.pipelineKey.includes("shadowMap") &&
        !pipeline.pipelineKey.includes("pointShadowMap"),
    ) ?? null
  );
}

function createGltfAnimationState(options) {
  const clips = parseGltfAnimationClips(options);
  const activeClip = clips[0] ?? null;

  return {
    status: activeClip === null ? "absent" : "playing",
    clipCount: clips.length,
    activeClip,
    time: 0,
    playbackOffset: 0,
    lastElapsedSeconds: 0,
    animatedNodes: [],
  };
}

function parseGltfAnimationClips({
  aperture,
  root,
  binary,
  keyPrefix,
  replay,
}) {
  if (!isRecord(root) || !Array.isArray(root.animations)) {
    return [];
  }

  const clips = [];

  root.animations.forEach((animation, animationIndex) => {
    if (!isRecord(animation)) {
      return;
    }

    const samplers = Array.isArray(animation.samplers)
      ? animation.samplers
      : [];
    const channels = Array.isArray(animation.channels)
      ? animation.channels
      : [];
    const parsedChannels = [];

    channels.forEach((channel) => {
      if (!isRecord(channel) || !isRecord(channel.target)) {
        return;
      }

      const samplerIndex = integerOrNull(channel.sampler);
      const nodeIndex = integerOrNull(channel.target.node);
      const path = channel.target.path;

      if (
        samplerIndex === null ||
        nodeIndex === null ||
        path !== "translation"
      ) {
        return;
      }

      const sampler = samplers[samplerIndex];
      if (!isRecord(sampler)) {
        return;
      }

      const inputAccessor = integerOrNull(sampler.input);
      const outputAccessor = integerOrNull(sampler.output);
      if (inputAccessor === null || outputAccessor === null) {
        return;
      }

      const times = readGltfFloatAccessorTuples(
        root,
        binary,
        inputAccessor,
        "SCALAR",
      ).map((tuple) => tuple[0]);
      const translations = readGltfFloatAccessorTuples(
        root,
        binary,
        outputAccessor,
        "VEC3",
      );
      const entityKey = `${keyPrefix}:node:${nodeIndex}`;
      const entity = replay.entitiesByKey.get(entityKey) ?? null;

      if (
        times.length < 2 ||
        times.length !== translations.length ||
        entity === null ||
        !entity.hasComponent(aperture.LocalTransform)
      ) {
        return;
      }

      parsedChannels.push({
        nodeIndex,
        entityKey,
        path,
        times,
        translations,
        entity,
      });
    });

    if (parsedChannels.length === 0) {
      return;
    }

    clips.push({
      name:
        typeof animation.name === "string" && animation.name.length > 0
          ? animation.name
          : `Animation${animationIndex}`,
      duration: Math.max(
        ...parsedChannels.map((channel) => channel.times.at(-1) ?? 0),
      ),
      channels: parsedChannels,
    });
  });

  return clips;
}

function updateActiveAnimation(aperture, animation, elapsedSeconds) {
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    return;
  }

  const duration = Math.max(0, clip.duration);
  animation.lastElapsedSeconds = elapsedSeconds;
  const localTime =
    animation.status === "paused"
      ? clamp(animation.time, 0, duration)
      : duration > 0
        ? wrapTime(elapsedSeconds + animation.playbackOffset, duration)
        : 0;
  applyAnimationAtTime(aperture, animation, clip, localTime);
}

function applyAnimationAtTime(aperture, animation, clip, localTime) {
  const animatedNodes = [];

  for (const channel of clip.channels) {
    const translation = sampleTranslationChannel(channel, localTime);

    channel.entity
      .getVectorView(aperture.LocalTransform, "translation")
      .set(translation);
    animatedNodes.push({
      nodeIndex: channel.nodeIndex,
      entityKey: channel.entityKey,
      path: channel.path,
      value: roundTuple(translation, 3),
    });
  }

  animation.time = Number(localTime.toFixed(3));
  animation.animatedNodes = animatedNodes;
}

function wrapTime(time, duration) {
  return duration > 0 ? ((time % duration) + duration) % duration : 0;
}

function sampleTranslationChannel(channel, time) {
  if (time <= channel.times[0]) {
    return channel.translations[0];
  }

  for (let index = 1; index < channel.times.length; index += 1) {
    const nextTime = channel.times[index];

    if (time > nextTime) {
      continue;
    }

    const previousTime = channel.times[index - 1];
    const previous = channel.translations[index - 1];
    const next = channel.translations[index];
    const t =
      nextTime === previousTime
        ? 0
        : (time - previousTime) / (nextTime - previousTime);

    return [
      previous[0] + (next[0] - previous[0]) * t,
      previous[1] + (next[1] - previous[1]) * t,
      previous[2] + (next[2] - previous[2]) * t,
    ];
  }

  return channel.translations.at(-1) ?? [0, 0, 0];
}

function createAnimationStatus(animation) {
  const clip = animation?.activeClip ?? null;

  if (animation === null || clip === null) {
    return {
      status: "absent",
      clipCount: 0,
      activeClipName: null,
      time: 0,
      duration: 0,
      channelCount: 0,
      animatedNodes: [],
    };
  }

  return {
    status: animation.status,
    clipCount: animation.clipCount,
    activeClipName: clip.name,
    time: animation.time,
    duration: Number(clip.duration.toFixed(3)),
    channelCount: clip.channels.length,
    animatedNodes: animation.animatedNodes,
  };
}

function readGltfFloatAccessorTuples(
  root,
  binary,
  accessorIndex,
  expectedType,
) {
  if (binary === null || !isRecord(root) || !Array.isArray(root.accessors)) {
    return [];
  }

  const accessor = root.accessors[accessorIndex];
  const bufferViews = Array.isArray(root.bufferViews) ? root.bufferViews : [];

  if (!isRecord(accessor)) {
    return [];
  }

  const bufferViewIndex = integerOrNull(accessor.bufferView);
  const count = integerOrNull(accessor.count);
  const componentType = accessor.componentType;
  const type = accessor.type;
  const componentCount = componentCountForAccessorType(type);

  if (
    bufferViewIndex === null ||
    count === null ||
    count <= 0 ||
    componentType !== 5126 ||
    type !== expectedType ||
    componentCount === null
  ) {
    return [];
  }

  const bufferView = bufferViews[bufferViewIndex];
  if (!isRecord(bufferView)) {
    return [];
  }

  const viewOffset = integerOrZero(bufferView.byteOffset);
  const accessorOffset = integerOrZero(accessor.byteOffset);
  const viewLength = integerOrNull(bufferView.byteLength);
  const elementByteLength = componentCount * 4;
  const stride = integerOrNull(bufferView.byteStride) ?? elementByteLength;
  const start = viewOffset + accessorOffset;

  if (
    viewLength === null ||
    start < 0 ||
    stride < elementByteLength ||
    accessorOffset + (count - 1) * stride + elementByteLength > viewLength ||
    start + (count - 1) * stride + elementByteLength > binary.byteLength
  ) {
    return [];
  }

  const data = new DataView(
    binary.buffer,
    binary.byteOffset,
    binary.byteLength,
  );
  const tuples = [];

  for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
    const itemOffset = start + itemIndex * stride;
    const tuple = [];

    for (let component = 0; component < componentCount; component += 1) {
      tuple.push(data.getFloat32(itemOffset + component * 4, true));
    }

    if (tuple.every(Number.isFinite)) {
      tuples.push(tuple);
    }
  }

  return tuples;
}

function componentCountForAccessorType(type) {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC3":
      return 3;
    default:
      return null;
  }
}

function createHierarchyStatus(aperture, active) {
  if (active === null) {
    return { nodes: [] };
  }

  const nodes =
    active.loaded.loader?.glbImportReport.importReport?.sceneTraversal.nodes ??
    [];

  return {
    nodes: nodes.map((node) => {
      const entity = active.replay.entitiesByKey.get(node.entityKey) ?? null;
      const worldMatrix =
        entity === null || !entity.hasComponent(aperture.WorldTransform)
          ? null
          : readWorldMatrix(aperture, entity);

      return {
        nodeIndex: node.nodeIndex,
        entityKey: node.entityKey,
        parentEntityKey: node.parentEntityKey,
        localTranslation:
          entity === null || !entity.hasComponent(aperture.LocalTransform)
            ? null
            : roundTuple(
                Array.from(
                  entity.getVectorView(aperture.LocalTransform, "translation"),
                ),
                3,
              ),
        worldTranslation:
          worldMatrix === null
            ? null
            : roundTuple(
                [worldMatrix[12], worldMatrix[13], worldMatrix[14]],
                3,
              ),
      };
    }),
  };
}

function createGltfMetadataStatus(active) {
  const glbImportReport = active?.loaded.loader?.glbImportReport ?? null;
  const importReport = glbImportReport?.importReport ?? null;
  const root = glbImportReport?.container.container?.json ?? null;

  if (!isRecord(root)) {
    return {
      status: "absent",
      counts: {
        scenes: 0,
        nodes: 0,
        meshes: 0,
        primitives: 0,
        materials: 0,
        animations: 0,
      },
      extensions: {
        used: [],
        required: [],
      },
      unsupportedFeatureDiagnostics: [],
    };
  }

  const meshes = arrayEntries(root.meshes);
  const primitives = meshes.flatMap((mesh) =>
    isRecord(mesh) ? arrayEntries(mesh.primitives) : [],
  );
  const extensionsUsed = stringArray(root.extensionsUsed);
  const extensionsRequired = stringArray(root.extensionsRequired);

  return {
    status: "ready",
    counts: {
      scenes: arrayEntries(root.scenes).length,
      nodes: arrayEntries(root.nodes).length,
      meshes: meshes.length,
      primitives: primitives.length,
      materials: arrayEntries(root.materials).length,
      animations: arrayEntries(root.animations).length,
    },
    extensions: {
      used: extensionsUsed,
      required: extensionsRequired,
    },
    unsupportedFeatureDiagnostics: createGltfUnsupportedFeatureDiagnostics({
      root,
      primitives,
      extensionsUsed,
      extensionsRequired,
      importReport,
      glbImportReport,
    }),
  };
}

function createGltfUnsupportedFeatureDiagnostics(input) {
  const diagnostics = [
    ...rootExtensionDiagnostics(input.extensionsUsed, input.extensionsRequired),
    ...rootFeatureDiagnostics(input.root, input.primitives),
    ...unsupportedImportDiagnostics(input.importReport),
    ...unsupportedGlbDiagnostics(input.glbImportReport),
  ];
  const seen = new Set();

  return diagnostics.filter((diagnostic) => {
    const key = JSON.stringify(diagnostic);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function rootExtensionDiagnostics(extensionsUsed, extensionsRequired) {
  const required = new Set(extensionsRequired);
  const diagnostics = [];

  for (const extensionName of extensionsUsed) {
    if (supportedMetadataExtensions.has(extensionName)) {
      continue;
    }

    diagnostics.push({
      code: required.has(extensionName)
        ? "gltfMetadata.unsupportedRequiredExtension"
        : "gltfMetadata.unsupportedOptionalExtension",
      severity: required.has(extensionName) ? "error" : "warning",
      extensionName,
      message: `glTF extension '${extensionName}' is not handled by the current GLB viewer import path.`,
    });
  }

  return diagnostics;
}

function rootFeatureDiagnostics(root, primitives) {
  const diagnostics = [];
  const skins = arrayEntries(root.skins);
  const cameras = arrayEntries(root.cameras);
  const morphTargetPrimitiveCount = primitives.filter(
    (primitive) =>
      isRecord(primitive) && arrayEntries(primitive.targets).length > 0,
  ).length;

  if (skins.length > 0) {
    diagnostics.push({
      code: "gltfMetadata.unsupportedSkins",
      severity: "warning",
      count: skins.length,
      message:
        "GLB viewer metadata detected skins; skinning is not replayed yet.",
    });
  }

  if (cameras.length > 0) {
    diagnostics.push({
      code: "gltfMetadata.unsupportedCameras",
      severity: "warning",
      count: cameras.length,
      message:
        "GLB viewer metadata detected cameras; imported cameras are not replayed yet.",
    });
  }

  if (morphTargetPrimitiveCount > 0) {
    diagnostics.push({
      code: "gltfMetadata.unsupportedMorphTargets",
      severity: "warning",
      count: morphTargetPrimitiveCount,
      message:
        "GLB viewer metadata detected morph targets; morph animation is not replayed yet.",
    });
  }

  return diagnostics;
}

function unsupportedImportDiagnostics(importReport) {
  if (importReport === null) {
    return [];
  }

  return [
    ...filterUnsupportedDiagnostics(importReport.root?.diagnostics ?? []),
    ...filterUnsupportedDiagnostics(
      importReport.meshPrimitive?.diagnostics ?? [],
    ),
    ...filterUnsupportedDiagnostics(
      importReport.accessorValidation?.diagnostics ?? [],
    ),
    ...filterUnsupportedDiagnostics(importReport.sceneTraversal.diagnostics),
    ...filterUnsupportedDiagnostics(importReport.diagnostics),
  ];
}

function unsupportedGlbDiagnostics(glbImportReport) {
  if (glbImportReport === null) {
    return [];
  }

  return [
    ...filterUnsupportedDiagnostics(glbImportReport.container.diagnostics),
    ...filterUnsupportedDiagnostics(glbImportReport.diagnostics),
  ];
}

function filterUnsupportedDiagnostics(diagnostics) {
  return diagnostics
    .filter(
      (diagnostic) =>
        isRecord(diagnostic) &&
        typeof diagnostic.code === "string" &&
        diagnostic.code.toLowerCase().includes("unsupported"),
    )
    .map((diagnostic) => ({
      code: diagnostic.code,
      severity:
        diagnostic.severity === "error" || diagnostic.severity === "warning"
          ? diagnostic.severity
          : "warning",
      message: typeof diagnostic.message === "string" ? diagnostic.message : "",
      ...diagnosticField(diagnostic, "field"),
      ...diagnosticField(diagnostic, "extensionName"),
      ...diagnosticNumberField(diagnostic, "meshIndex"),
      ...diagnosticNumberField(diagnostic, "primitiveIndex"),
      ...diagnosticNumberField(diagnostic, "accessorIndex"),
    }));
}

function diagnosticField(diagnostic, field) {
  return typeof diagnostic[field] === "string"
    ? { [field]: diagnostic[field] }
    : {};
}

function diagnosticNumberField(diagnostic, field) {
  return typeof diagnostic[field] === "number" &&
    Number.isFinite(diagnostic[field])
    ? { [field]: diagnostic[field] }
    : {};
}

function createMaterialFamilyStatus(aperture, app, active) {
  if (active === null) {
    return [];
  }

  const counts = new Map();

  for (const material of active.primitiveMaterials.resolved) {
    const family =
      materialAssetFromHandleKey(aperture, app, material.materialHandleKey)
        ?.kind ?? "missing";

    counts.set(family, (counts.get(family) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, count]) => ({ family, count }));
}

function createPrimitiveMaterialResolutionStatus(aperture, app, active) {
  if (active === null) {
    return [];
  }

  return active.primitiveMaterials.resolved
    .map((resolution) => {
      const material = materialAssetFromHandleKey(
        aperture,
        app,
        resolution.materialHandleKey,
      );
      const renderState = material?.renderState ?? null;

      return {
        meshIndex: resolution.meshIndex,
        primitiveIndex: resolution.primitiveIndex,
        materialIndex: resolution.materialIndex,
        materialHandleKey: resolution.materialHandleKey,
        family: material?.kind ?? "missing",
        alphaMode: renderState?.alphaMode ?? null,
        blendPreset: renderState?.blend?.preset ?? null,
        depthWrite: renderState?.depth?.write ?? null,
        cullMode: renderState?.cullMode ?? null,
        pipelineKey: material === null ? null : materialPipelineKey(material),
      };
    })
    .sort(
      (a, b) =>
        a.meshIndex - b.meshIndex || a.primitiveIndex - b.primitiveIndex,
    );
}

function createRenderStateStatus(meshDraws) {
  return {
    queues: meshDraws.map((draw) => draw.sortKey.queue),
    pipelineKeys: meshDraws.map((draw) => draw.batchKey.pipelineKey),
  };
}

function materialAssetFromHandleKey(aperture, app, materialHandleKey) {
  const materialId = materialHandleKey.replace(/^material:/, "");

  return (
    app.assets.get(aperture.createMaterialHandle(materialId))?.asset ?? null
  );
}

function materialPipelineKey(material) {
  return [
    material.kind,
    ...materialPipelineFeatures(material),
    material.renderState.alphaMode,
    material.renderState.cullMode,
    material.renderState.depth.compare,
    material.renderState.blend.preset,
  ].join("|");
}

function materialPipelineFeatures(material) {
  const candidates = [
    ["baseColorTexture", material.baseColorTexture],
    ["metallicRoughnessTexture", material.metallicRoughnessTexture],
    ["normalTexture", material.normalTexture],
    ["occlusionTexture", material.occlusionTexture],
    ["emissiveTexture", material.emissiveTexture],
  ];
  const features = candidates
    .filter(
      ([, binding]) =>
        binding !== null && binding !== undefined && binding.texture !== null,
    )
    .map(([field]) => field);

  if (
    material.kind === "standard" &&
    candidates.some(
      ([, binding]) =>
        binding !== null &&
        binding !== undefined &&
        binding.texture !== null &&
        binding.texCoord === 1,
    )
  ) {
    features.push("uv1");
  }

  return features.sort();
}

function createOrbitControls(targetCanvas) {
  const state = {
    yaw: 0,
    elevation: 0.28,
    distance: 3.4,
    minDistance: 1.8,
    maxDistance: 6,
    target: [0, 0, 0],
    fit: {
      status: "default",
      center: [0, 0, 0],
      size: [1, 1, 1],
      yaw: 0,
      elevation: 0.28,
      distance: 3.4,
      minDistance: 1.8,
      maxDistance: 6,
    },
    dragging: false,
    lastX: 0,
  };

  targetCanvas.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.lastX = event.clientX;
    targetCanvas.setPointerCapture(event.pointerId);
  });
  targetCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) {
      return;
    }

    const deltaX = event.clientX - state.lastX;
    state.lastX = event.clientX;
    state.yaw = wrapRadians(state.yaw - deltaX * 0.006);
  });
  targetCanvas.addEventListener("pointerup", (event) => {
    state.dragging = false;
    targetCanvas.releasePointerCapture(event.pointerId);
  });
  targetCanvas.addEventListener("pointercancel", () => {
    state.dragging = false;
  });
  globalThis.addEventListener("pointerup", () => {
    state.dragging = false;
  });
  targetCanvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      state.distance = clamp(
        state.distance + event.deltaY * 0.004,
        state.minDistance,
        state.maxDistance,
      );
    },
    { passive: false },
  );

  return state;
}

function updateOrbitCamera(aperture, cameraEntity, orbit) {
  const elevation = orbit.elevation ?? 0;
  const elevationDistance = Math.cos(elevation) * orbit.distance;
  const x = orbit.target[0] + Math.sin(orbit.yaw) * elevationDistance;
  const y = orbit.target[1] + Math.sin(elevation) * orbit.distance;
  const z = orbit.target[2] + Math.cos(orbit.yaw) * elevationDistance;
  const halfYaw = orbit.yaw * 0.5;
  const halfPitch = -elevation * 0.5;
  const yawSin = Math.sin(halfYaw);
  const yawCos = Math.cos(halfYaw);
  const pitchSin = Math.sin(halfPitch);
  const pitchCos = Math.cos(halfPitch);

  cameraEntity
    .getVectorView(aperture.LocalTransform, "translation")
    .set([x, y, z]);
  cameraEntity
    .getVectorView(aperture.LocalTransform, "rotation")
    .set([
      yawCos * pitchSin,
      yawSin * pitchCos,
      -yawSin * pitchSin,
      yawCos * pitchCos,
    ]);
}

function resetOrbitToFit(orbit) {
  const fit = orbit.fit;

  if (fit.status !== "ready") {
    return false;
  }

  orbit.dragging = false;
  orbit.yaw = fit.yaw;
  orbit.elevation = fit.elevation;
  orbit.distance = fit.distance;
  orbit.minDistance = fit.minDistance;
  orbit.maxDistance = fit.maxDistance;
  orbit.target = [...fit.center];
  return true;
}

function fitOrbitToReplayBounds(aperture, app, replay, orbit) {
  const bounds = computeReplayWorldBounds(aperture, app, replay);

  if (bounds === null) {
    orbit.fit = {
      status: "missing-bounds",
      center: roundTuple(orbit.target, 3),
      size: [0, 0, 0],
      yaw: Number(orbit.yaw.toFixed(4)),
      elevation: Number(orbit.elevation.toFixed(4)),
      distance: Number(orbit.distance.toFixed(3)),
      minDistance: Number(orbit.minDistance.toFixed(3)),
      maxDistance: Number(orbit.maxDistance.toFixed(3)),
    };
    return orbit.fit;
  }

  const center = [
    (bounds.min[0] + bounds.max[0]) * 0.5,
    (bounds.min[1] + bounds.max[1]) * 0.5,
    (bounds.min[2] + bounds.max[2]) * 0.5,
  ];
  const size = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const aspect = Math.max(1, (canvas?.width ?? 1) / (canvas?.height ?? 1));
  const fovY = Math.PI / 3;
  const fitOffset = 1.35;
  const fitHeightDistance = size[1] / (2 * Math.tan(fovY * 0.5));
  const fitWidthDistance = size[0] / (2 * Math.tan(fovY * 0.5) * aspect);
  const fitDepthDistance = size[2] * 1.2;
  const distance = Math.max(
    1.2,
    fitOffset * Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance),
  );

  orbit.target = center;
  orbit.distance = distance;
  orbit.minDistance = Math.max(0.25, distance * 0.25);
  orbit.maxDistance = Math.max(distance * 4, orbit.minDistance + 0.25);
  orbit.fit = {
    status: "ready",
    center: roundTuple(center, 3),
    size: roundTuple(size, 3),
    yaw: Number(orbit.yaw.toFixed(4)),
    elevation: Number(orbit.elevation.toFixed(4)),
    distance: Number(distance.toFixed(3)),
    minDistance: Number(orbit.minDistance.toFixed(3)),
    maxDistance: Number(orbit.maxDistance.toFixed(3)),
  };

  return orbit.fit;
}

function setCameraResetEnabled(enabled) {
  if (cameraResetButton instanceof HTMLButtonElement) {
    cameraResetButton.disabled = !enabled;
  }
}

function computeReplayWorldBounds(aperture, app, replay) {
  let bounds = null;

  for (const entity of replay.entitiesByKey.values()) {
    if (
      !entity.hasComponent(aperture.Mesh) ||
      !entity.hasComponent(aperture.WorldTransform)
    ) {
      continue;
    }

    const meshId = entity.getValue(aperture.Mesh, "meshId") ?? "";

    if (!meshId.startsWith("mesh:")) {
      continue;
    }

    const meshEntry = app.assets.get(
      aperture.createMeshHandle(meshId.slice(5)),
    );
    const mesh = meshEntry?.asset ?? null;

    if (meshEntry?.status !== "ready" || mesh?.localAabb === undefined) {
      continue;
    }

    const worldBounds = transformAabb(
      mesh.localAabb,
      readWorldMatrix(aperture, entity),
    );

    bounds = bounds === null ? worldBounds : unionAabb(bounds, worldBounds);
  }

  return bounds;
}

function readWorldMatrix(aperture, entity) {
  const matrix = new Float32Array(16);

  matrix.set(entity.getVectorView(aperture.WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(aperture.WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(aperture.WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(aperture.WorldTransform, "col3"), 12);
  return matrix;
}

function transformAabb(aabb, matrix) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const x of [aabb.min[0], aabb.max[0]]) {
    for (const y of [aabb.min[1], aabb.max[1]]) {
      for (const z of [aabb.min[2], aabb.max[2]]) {
        const tx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
        const ty = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
        const tz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];

        minX = Math.min(minX, tx);
        minY = Math.min(minY, ty);
        minZ = Math.min(minZ, tz);
        maxX = Math.max(maxX, tx);
        maxY = Math.max(maxY, ty);
        maxZ = Math.max(maxZ, tz);
      }
    }
  }

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

function unionAabb(a, b) {
  return {
    min: [
      Math.min(a.min[0], b.min[0]),
      Math.min(a.min[1], b.min[1]),
      Math.min(a.min[2], b.min[2]),
    ],
    max: [
      Math.max(a.max[0], b.max[0]),
      Math.max(a.max[1], b.max[1]),
      Math.max(a.max[2], b.max[2]),
    ],
  };
}

function roundTuple(values, digits) {
  return values.map((value) => Number(value.toFixed(digits)));
}

function wrapRadians(value) {
  const twoPi = Math.PI * 2;
  return ((((value + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function integerOrNull(value) {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : null;
}

function integerOrZero(value) {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : 0;
}

function arrayEntries(value) {
  return Array.isArray(value) ? value : [];
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string").sort()
    : [];
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readInitialCustomUrl() {
  const rawUrl = exampleParams.get("url");

  if (rawUrl === null || rawUrl.trim().length === 0) {
    return null;
  }

  const url = new URL(rawUrl.trim(), globalThis.location.href);

  if (!url.pathname.toLowerCase().endsWith(".glb")) {
    return null;
  }

  return url;
}

function readInitialSampleSelection() {
  const requestedAssetId = exampleParams.get("asset")?.trim() ?? null;

  if (requestedAssetId === null || requestedAssetId.length === 0) {
    const asset = sampleAssets[0];

    return {
      asset,
      status: {
        requestedAssetId: null,
        activeAssetId: asset.id,
        diagnostics: [],
      },
    };
  }

  const asset = sampleAssets.find((entry) => entry.id === requestedAssetId);

  if (asset !== undefined) {
    return {
      asset,
      status: {
        requestedAssetId,
        activeAssetId: asset.id,
        diagnostics: [],
      },
    };
  }

  const fallback = sampleAssets[0];

  return {
    asset: fallback,
    status: {
      requestedAssetId,
      activeAssetId: fallback.id,
      diagnostics: [
        {
          code: "glbViewerSelection.unknownSampleAsset",
          severity: "warning",
          requestedAssetId,
          fallbackAssetId: fallback.id,
          message: `Sample asset '${requestedAssetId}' is not available; loaded '${fallback.id}'.`,
        },
      ],
    },
  };
}

function emptySampleSelectionStatus() {
  return {
    requestedAssetId: null,
    activeAssetId: null,
    diagnostics: [],
  };
}

function formatAssetUrl(url) {
  if (url.origin === globalThis.location.origin) {
    return url.pathname;
  }

  return url.href;
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return {
    example: "glb-viewer",
    ok: false,
    phase: "initialize",
    reason,
    message,
  };
}
