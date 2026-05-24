const clearColor = [0.012, 0.016, 0.022, 1];
const localLightGrid = { columns: 8, rows: 8 };
const shadowMetadataLightIndices = new Set([28, 29, 36, 37]);
const pointCookieLightIndex = 36;
const primaryShadowCasterPosition = [-0.755, -0.074, 0.52];
const spotShadowCasterPosition = [1.12, -0.18, 0.54];

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
      scene = createWorkerScene(
        aperture,
        data.canvas ?? { width: 960, height: 540 },
        finiteInteger(data.cameraFrameOffset, 0),
        data.clusteredCookieEnabled === true,
        data.clusteredSpotCookieEnabled === true,
        data.clusteredPointCookieEnabled === true,
        data.clusteredCookieOnlyEnabled === true,
      );
      self.postMessage({
        type: "ready",
        scene: {
          meshKey: aperture.assetHandleKey(scene.panelMesh),
          materialKey: aperture.assetHandleKey(scene.panelMaterial),
          secondaryMaterialKey: aperture.assetHandleKey(
            scene.secondaryPanelMaterial,
          ),
          casterMeshKey: aperture.assetHandleKey(scene.casterMesh),
          casterMaterialKey: aperture.assetHandleKey(scene.casterMaterial),
          spotCasterMeshKey: aperture.assetHandleKey(scene.spotCasterMesh),
          spotCasterMaterialKey: aperture.assetHandleKey(
            scene.spotCasterMaterial,
          ),
          cookieTextureKey: aperture.assetHandleKey(scene.cookieTexture),
          cookieSamplerKey: aperture.assetHandleKey(scene.cookieSampler),
          pointCookieTextureKey: aperture.assetHandleKey(
            scene.pointCookieTexture,
          ),
          pointCookieSamplerKey: aperture.assetHandleKey(
            scene.pointCookieSampler,
          ),
          localLights: scene.localLightCount,
          routeLocalLights: scene.routeLocalLightCount,
          routeShadowMetadataLights: scene.routeShadowMetadataLightCount,
          clusteredCookieEnabled: scene.clusteredCookieEnabled,
          clusteredSpotCookieEnabled: scene.clusteredSpotCookieEnabled,
          clusteredPointCookieEnabled: scene.clusteredPointCookieEnabled,
          clusteredCookieOnlyEnabled: scene.clusteredCookieOnlyEnabled,
        },
      });
      return;
    }

    if (data?.type === "frame") {
      if (scene === null) {
        throw new Error("Worker scene has not been initialized.");
      }

      const frame = finiteInteger(data.frame, 0);
      const cameraX = updateClusterCamera(aperture, scene, frame);
      const snapshot = scene.app.stepAndExtract(0, frame / 60, frame);

      self.postMessage(
        {
          type: "snapshot",
          frame,
          snapshot,
          workerStep: {
            transforms: snapshot.transforms.length / 16,
            meshDraws: snapshot.meshDraws.length,
            lights: snapshot.lights.length,
            localLights: scene.localLightCount,
            routeLocalLights: scene.routeLocalLightCount,
            cameraX,
            diagnostics: snapshot.diagnostics.length,
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
  apertureModulePromise ??= import("@aperture-engine/core");
  return apertureModulePromise;
}

function createWorkerScene(
  aperture,
  canvasSize,
  cameraFrameOffset,
  clusteredCookieEnabled,
  clusteredSpotCookieEnabled,
  clusteredPointCookieEnabled,
  clusteredCookieOnlyEnabled,
) {
  const app = aperture.createExtractionApp({
    worldOptions: { entityCapacity: 180 },
  });
  const assets = registerClusteredLightAssets(aperture, app.assets);

  const primaryCamera = app.spawn(
    aperture.withTransform({ translation: [-0.4, 0, 4.8] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
      viewport: [0, 0, 0.5, 1],
      scissor: [0, 0, 0.5, 1],
    }),
  );
  const secondaryCamera = app.spawn(
    aperture.withTransform({ translation: [0.4, 0, 4.8] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 2,
      viewport: [0.5, 0, 0.5, 1],
      scissor: [0.5, 0, 0.5, 1],
    }),
  );
  app.spawn(
    aperture.withTransform({ translation: [-1.1, 0, 0] }),
    aperture.withMesh(assets.panelMesh),
    aperture.withMaterial(assets.primaryPanelMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: [1.1, 0, 0] }),
    aperture.withMesh(assets.panelMesh),
    aperture.withMaterial(assets.secondaryPanelMaterial),
    aperture.withRenderLayer(2),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: primaryShadowCasterPosition }),
    aperture.withMesh(assets.casterMesh),
    aperture.withMaterial(assets.casterMaterial),
    aperture.withRenderLayer(1),
    aperture.withShadowCaster(true),
    aperture.withShadowReceiver(false),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withTransform({ translation: spotShadowCasterPosition }),
    aperture.withMesh(assets.spotCasterMesh),
    aperture.withMaterial(assets.spotCasterMaterial),
    aperture.withRenderLayer(2),
    aperture.withShadowCaster(!clusteredCookieEnabled),
    aperture.withShadowReceiver(false),
    aperture.withVisibility(true),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.35, 0.39, 0.46, 1],
      intensity: 0.08,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.35, 0.39, 0.46, 1],
      intensity: 0.08,
      layerMask: 2,
    }),
  );

  spawnPointLightGrid(aperture, app, { layerMask: 1, xOffset: -1.1 });
  spawnPointLightGrid(aperture, app, {
    layerMask: 2,
    xOffset: 1.1,
    intensity: clusteredCookieEnabled ? 0.35 : 16,
    cookieLightIndex: clusteredPointCookieEnabled ? pointCookieLightIndex : -1,
    cookieTexture: assets.pointCookieTexture,
    cookieSampler: assets.pointCookieSampler,
    cookieIntensity: 1,
    cookieLightIntensity: 34,
  });
  const spotLightComponents = [
    aperture.withTransform({ translation: [1.12, -0.18, 1.92] }),
    aperture.withLight({
      kind: aperture.LightKind.Spot,
      color: [0.88, 0.96, 1, 1],
      intensity: clusteredSpotCookieEnabled ? 260 : 68,
      range: 4.2,
      innerConeAngle: 0.18,
      outerConeAngle: 0.54,
      layerMask: 2,
    }),
  ];

  if (!clusteredCookieOnlyEnabled && !clusteredPointCookieEnabled) {
    spotLightComponents.push(
      aperture.withLightShadowSettings({
        enabled: true,
        mapSize: 256,
        bias: 0.002,
        normalBias: 0.01,
        casterLayerMask: 2,
        receiverLayerMask: 2,
      }),
    );
  }

  if (clusteredSpotCookieEnabled) {
    spotLightComponents.push(
      aperture.withLightCookie(assets.cookieTexture, {
        sampler: assets.cookieSampler,
        intensity: 1,
      }),
    );
  }

  app.spawn(...spotLightComponents);

  return {
    app,
    primaryCamera,
    secondaryCamera,
    panelMesh: assets.panelMesh,
    panelMaterial: assets.primaryPanelMaterial,
    secondaryPanelMaterial: assets.secondaryPanelMaterial,
    casterMesh: assets.casterMesh,
    casterMaterial: assets.casterMaterial,
    spotCasterMesh: assets.spotCasterMesh,
    spotCasterMaterial: assets.spotCasterMaterial,
    cookieTexture: assets.cookieTexture,
    cookieSampler: assets.cookieSampler,
    pointCookieTexture: assets.pointCookieTexture,
    pointCookieSampler: assets.pointCookieSampler,
    cameraFrameOffset,
    clusteredCookieEnabled,
    clusteredSpotCookieEnabled,
    clusteredPointCookieEnabled,
    clusteredCookieOnlyEnabled,
    localLightCount: localLightGrid.columns * localLightGrid.rows * 2 + 1,
    routeLocalLightCount: localLightGrid.columns * localLightGrid.rows,
    routeShadowMetadataLightCount: 4,
  };
}

function updateClusterCamera(aperture, scene, frame) {
  const cameraFrame = frame + scene.cameraFrameOffset;
  const cameraX = cameraFrame % 2 === 0 ? 0.52 : -0.52;

  scene.primaryCamera
    .getVectorView(aperture.LocalTransform, "translation")
    .set([-0.4 + cameraX, 0, 4.8]);
  scene.secondaryCamera
    .getVectorView(aperture.LocalTransform, "translation")
    .set([0.4 - cameraX, 0, 4.8]);

  return cameraX;
}

function registerClusteredLightAssets(aperture, registry) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const panelMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "ClusteredLightsPanel",
      width: 5.2,
      height: 2.8,
    }),
    { id: "clustered-lights-panel" },
  );
  const primaryPanelMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandard",
      baseColorFactor: new Float32Array([0.78, 0.8, 0.72, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard" },
  );
  const secondaryPanelMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredLightsStandardSecondary",
      baseColorFactor: new Float32Array([0.68, 0.76, 0.88, 1]),
      metallicFactor: 0.02,
      roughnessFactor: 0.84,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-standard-secondary" },
  );
  const casterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ClusteredPointShadowCaster",
      width: 0.52,
      height: 0.52,
      depth: 0.52,
    }),
    { id: "clustered-lights-point-shadow-caster" },
  );
  const casterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredPointShadowCasterStandard",
      baseColorFactor: new Float32Array([0.95, 0.58, 0.24, 1]),
      metallicFactor: 0.04,
      roughnessFactor: 0.58,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-point-shadow-caster-standard" },
  );
  const spotCasterMesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "ClusteredSpotShadowCaster",
      width: 0.48,
      height: 0.48,
      depth: 0.48,
    }),
    { id: "clustered-lights-spot-shadow-caster" },
  );
  const spotCasterMaterial = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ClusteredSpotShadowCasterStandard",
      baseColorFactor: new Float32Array([0.36, 0.86, 0.92, 1]),
      metallicFactor: 0.04,
      roughnessFactor: 0.56,
      emissiveFactor: [0, 0, 0],
    }),
    { id: "clustered-lights-spot-shadow-caster-standard" },
  );
  const cookieTexture = aperture.createTextureHandle(
    "clustered-lights-spot-cookie",
  );
  const cookieSampler = aperture.createSamplerHandle(
    "clustered-lights-spot-cookie-linear",
  );
  const pointCookieTexture = aperture.createTextureHandle(
    "clustered-lights-point-cookie-cube",
  );
  const pointCookieSampler = aperture.createSamplerHandle(
    "clustered-lights-point-cookie-linear",
  );

  registry.register(cookieTexture);
  registry.register(cookieSampler);
  registry.register(pointCookieTexture);
  registry.register(pointCookieSampler);
  registry.markReady(cookieTexture, createSpotCookieTextureAsset(aperture));
  registry.markReady(cookieSampler, createSpotCookieSamplerAsset(aperture));
  registry.markReady(
    pointCookieTexture,
    createPointCookieTextureAsset(aperture),
  );
  registry.markReady(
    pointCookieSampler,
    createSpotCookieSamplerAsset(aperture),
  );

  return {
    panelMesh,
    primaryPanelMaterial,
    secondaryPanelMaterial,
    casterMesh,
    casterMaterial,
    spotCasterMesh,
    spotCasterMaterial,
    cookieTexture,
    cookieSampler,
    pointCookieTexture,
    pointCookieSampler,
  };
}

function createSpotCookieTextureAsset(aperture) {
  const width = 8;
  const height = 8;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const checker = (Math.floor(x / 2) + Math.floor(y / 2)) % 2;
      const stripe = x === y || x + y === width - 1;
      const value = stripe ? 255 : checker === 0 ? 24 : 230;

      bytes[index + 0] = value;
      bytes[index + 1] = value;
      bytes[index + 2] = value;
      bytes[index + 3] = 255;
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredSpotCookie",
    dimension: "2d",
    width,
    height,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: width * 4,
      rowsPerImage: height,
    },
  });
}

function createPointCookieTextureAsset(aperture) {
  const faceSize = 8;
  const faceBytes = faceSize * faceSize * 4;
  const bytes = new Uint8Array(faceBytes * 6);

  for (let face = 0; face < 6; face += 1) {
    for (let y = 0; y < faceSize; y += 1) {
      for (let x = 0; x < faceSize; x += 1) {
        const index = face * faceBytes + (y * faceSize + x) * 4;
        const checker = (Math.floor(x / 2) + Math.floor(y / 2) + face) % 2;
        const negativeZFace = face === 5;
        const value = negativeZFace
          ? checker === 0
            ? 18
            : 255
          : checker === 0
            ? 160
            : 230;

        bytes[index + 0] = value;
        bytes[index + 1] = negativeZFace ? value : Math.round(value * 0.82);
        bytes[index + 2] = negativeZFace ? value : 255;
        bytes[index + 3] = 255;
      }
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredPointCookieCube",
    dimension: "cube",
    width: faceSize,
    height: faceSize,
    depthOrLayers: 6,
    format: "rgba8unorm",
    colorSpace: "linear",
    semantic: "data",
    usage: ["sampled", "copy-dst"],
    sourceData: {
      bytes,
      bytesPerRow: faceSize * 4,
      rowsPerImage: faceSize,
    },
  });
}

function createSpotCookieSamplerAsset(aperture) {
  return aperture.createSamplerAsset({
    label: "ClusteredSpotCookieLinearClamp",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });
}

function spawnPointLightGrid(aperture, app, options) {
  const palette = [
    [1, 0.3, 0.22, 1],
    [0.2, 0.65, 1, 1],
    [0.24, 1, 0.48, 1],
    [1, 0.86, 0.22, 1],
  ];

  for (let y = 0; y < localLightGrid.rows; y += 1) {
    for (let x = 0; x < localLightGrid.columns; x += 1) {
      const index = y * localLightGrid.columns + x;
      const color = palette[index % palette.length] ?? [1, 1, 1, 1];
      const hasShadowMetadata = shadowMetadataLightIndices.has(index);
      const hasCookie = options.cookieLightIndex === index;
      const components = [
        aperture.withTransform({
          translation: [
            ...pointLightGridPosition({
              layerMask: options.layerMask,
              xOffset: options.xOffset,
              index,
              z: 1.15 + ((x + y) % 2) * 0.18,
            }),
          ],
        }),
        aperture.withLight({
          kind: aperture.LightKind.Point,
          color,
          intensity:
            hasCookie && options.cookieLightIntensity !== undefined
              ? options.cookieLightIntensity
              : (options.intensity ?? 16),
          range: 1.08,
          layerMask: options.layerMask,
        }),
      ];

      if (hasShadowMetadata) {
        components.push(
          aperture.withLightShadowSettings({
            enabled: true,
            mapSize: 256,
            casterLayerMask: options.layerMask,
            receiverLayerMask: options.layerMask,
          }),
        );
      }

      if (hasCookie) {
        components.push(
          aperture.withLightCookie(options.cookieTexture, {
            sampler: options.cookieSampler,
            intensity: options.cookieIntensity ?? 1,
          }),
        );
      }

      app.spawn(...components);
    }
  }
}

function pointLightGridPosition(options) {
  const x = options.index % localLightGrid.columns;
  const y = Math.floor(options.index / localLightGrid.columns);
  const u = localLightGrid.columns <= 1 ? 0 : x / (localLightGrid.columns - 1);
  const v = localLightGrid.rows <= 1 ? 0 : y / (localLightGrid.rows - 1);

  return [options.xOffset - 2.25 + u * 4.5, -1.15 + v * 2.3, options.z];
}

function finiteInteger(value, fallback) {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
