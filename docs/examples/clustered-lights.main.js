import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.012, 0.016, 0.022, 1];
const exampleParams = new URLSearchParams(globalThis.location.search);
const clusteredPressureHistoryEnabled = exampleParams.has(
  "enable-cluster-pressure-history",
);
const clusteredCookieOnlyEnabled =
  exampleParams.has("enable-cluster-cookie-only") &&
  !exampleParams.has("disable-cluster-cookie");
const clusteredMixedCookieEnabled =
  exampleParams.has("enable-cluster-mixed-cookie") &&
  !exampleParams.has("disable-cluster-cookie");
const clusteredGpuCookieAtlasUpdateEnabled =
  exampleParams.has("enable-cluster-gpu-cookie-atlas-update") &&
  !exampleParams.has("disable-cluster-cookie") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredShadowCacheEnabled =
  (exampleParams.has("enable-cluster-shadow-cache") ||
    clusteredPressureHistoryEnabled) &&
  !exampleParams.has("disable-cluster-cookie") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredBufferCacheEnabled =
  (exampleParams.has("enable-cluster-buffer-cache") ||
    clusteredPressureHistoryEnabled) &&
  !exampleParams.has("disable-cluster-cookie");
const clusteredDynamicShadowCookieAtlasEnabled =
  (exampleParams.has("enable-cluster-dynamic-shadow-cookie-atlas") ||
    clusteredGpuCookieAtlasUpdateEnabled ||
    (clusteredShadowCacheEnabled && !clusteredPressureHistoryEnabled)) &&
  !exampleParams.has("disable-cluster-cookie") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredShadowCookieAtlasEnabled =
  (exampleParams.has("enable-cluster-shadow-cookie-atlas") ||
    clusteredPressureHistoryEnabled ||
    clusteredDynamicShadowCookieAtlasEnabled) &&
  !exampleParams.has("disable-cluster-cookie") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredAtlasCookieEnabled =
  (exampleParams.has("enable-cluster-cookie-atlas") ||
    clusteredShadowCookieAtlasEnabled) &&
  !exampleParams.has("disable-cluster-cookie");
const clusteredShadowCookiePointArrayEnabled =
  exampleParams.has("enable-cluster-shadow-cookie-point-array") &&
  !exampleParams.has("disable-cluster-cookie") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredShadowCookieEnabled =
  (exampleParams.has("enable-cluster-shadow-cookie") ||
    clusteredShadowCookiePointArrayEnabled ||
    clusteredShadowCookieAtlasEnabled) &&
  !exampleParams.has("disable-cluster-cookie") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredMultiCookieEnabled =
  (exampleParams.has("enable-cluster-multi-cookie") ||
    clusteredMixedCookieEnabled ||
    (clusteredAtlasCookieEnabled && !clusteredShadowCookieAtlasEnabled)) &&
  !exampleParams.has("disable-cluster-cookie");
const clusteredPointCookieEnabled =
  (exampleParams.has("enable-cluster-point-cookie") ||
    clusteredMixedCookieEnabled) &&
  !exampleParams.has("disable-cluster-cookie");
const clusteredShadowSoftnessEnabled =
  exampleParams.has("enable-cluster-shadow-softness") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredShadowSoftnessAtlasEnabled =
  exampleParams.has("enable-cluster-shadow-softness-atlas") &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredMultiPointShadowEnabled =
  (exampleParams.has("enable-cluster-multi-point-shadow") ||
    clusteredShadowCookiePointArrayEnabled) &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredPackedSpotShadowArrayEnabled =
  (exampleParams.has("enable-cluster-packed-shadow") ||
    (clusteredShadowCookieEnabled && !clusteredShadowCookieAtlasEnabled) ||
    clusteredShadowSoftnessEnabled ||
    clusteredMultiPointShadowEnabled) &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredPackedSpotShadowAtlasEnabled =
  (exampleParams.has("enable-cluster-packed-shadow-atlas") ||
    clusteredShadowSoftnessAtlasEnabled ||
    clusteredShadowCookieAtlasEnabled) &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredPackedSpotShadowEnabled =
  clusteredPackedSpotShadowArrayEnabled ||
  clusteredPackedSpotShadowAtlasEnabled;
const clusteredMixedShadowEnabled =
  (exampleParams.has("enable-cluster-mixed-shadow") ||
    clusteredPackedSpotShadowEnabled) &&
  !exampleParams.has("disable-cluster-point-shadow") &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredSpotShadowAtlasEnabled =
  (exampleParams.has("enable-cluster-spot-shadow-atlas") ||
    clusteredPackedSpotShadowAtlasEnabled) &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredMultiSpotShadowEnabled =
  (exampleParams.has("enable-cluster-multi-spot-shadow") ||
    clusteredPackedSpotShadowArrayEnabled ||
    clusteredSpotShadowAtlasEnabled) &&
  !exampleParams.has("disable-cluster-spot-shadow") &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredPointShadowEnabled =
  !exampleParams.has("disable-cluster-point-shadow") &&
  !clusteredDynamicShadowCookieAtlasEnabled &&
  (!clusteredMultiSpotShadowEnabled || clusteredPackedSpotShadowEnabled) &&
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled;
const clusteredSpotCookieEnabled =
  (exampleParams.has("enable-cluster-cookie") ||
    clusteredShadowCookieEnabled ||
    clusteredCookieOnlyEnabled ||
    clusteredMultiCookieEnabled ||
    clusteredAtlasCookieEnabled) &&
  !exampleParams.has("disable-cluster-cookie");
const clusteredCookieEnabled =
  clusteredSpotCookieEnabled ||
  clusteredPointCookieEnabled ||
  clusteredMultiCookieEnabled;
const clusteredSpotShadowEnabled =
  !clusteredCookieOnlyEnabled &&
  !clusteredMultiCookieEnabled &&
  !clusteredPointCookieEnabled &&
  (clusteredMixedShadowEnabled ||
    clusteredMultiSpotShadowEnabled ||
    exampleParams.has("enable-cluster-spot-shadow") ||
    clusteredSpotCookieEnabled) &&
  !exampleParams.has("disable-cluster-spot-shadow");
const clusteredPointShadowIntent = {
  mapSize: 256,
  depthBias: 0.0001,
  normalBias: 0.01,
  filterRadiusTexels: 0,
  casterLayerMask: 1,
  receiverLayerMask: 1,
};
const clusteredSpotShadowIntent = {
  mapSize: 256,
  depthBias: 0.002,
  normalBias: 0.01,
  filterRadiusTexels: 1,
  casterLayerMask: 2,
  receiverLayerMask: 2,
};
const clusteredSpotShadowAtlasMapSizes = [256, 128];
const clusteredDynamicSpotShadowAtlas = {
  width: 512,
  height: 256,
  staleGenerations: 1,
  mapSizes: [256, 128, 128, 64],
  resizedMapSizes: [128, 128, 128, 64],
};
const clusteredShadowCacheTransformInvalidationFrame = 4;
const clusteredShadowSoftnessPointFilterRadiusTexels = 3;
const clusteredShadowSoftnessSpotFilterRadiiTexels = [0, 5];
const clusterPressureHistoryFrameCount = 30;
const clusterPressureStableFrameStart = 6;
const maxStatusWarmupFrames = 90;
const maxTransparentReadbackWarmupFrames = 150;
const readbackSamples = [
  { id: "left-bank", x: 0.26, y: 0.5 },
  { id: "center", x: 0.5, y: 0.5 },
  { id: "right-bank", x: 0.74, y: 0.5 },
  { id: "right-cookie-upper", x: 0.72, y: 0.43 },
  { id: "right-cookie-lower", x: 0.82, y: 0.57 },
  { id: "right-cookie-second-upper", x: 0.58, y: 0.38 },
  { id: "right-cookie-second-lower", x: 0.66, y: 0.62 },
];

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      // M3-T4: ?graph=1 routes the forward frame through the single-encoder graph.
      ...(exampleParams.get("graph") === "1" ? { useFrameGraph: true } : {}),
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = registerClusteredLightAssets(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "clustered-lights-failed",
      error instanceof Error
        ? error.message
        : "Clustered lights example failed.",
    ),
  );
}

function registerClusteredLightAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const panelMesh = assets.meshes.add(
    aperture.createPlaneMeshAsset({
      label: "ClusteredLightsPanel",
      width: 5.2,
      height: 2.8,
    }),
    { id: "clustered-lights-panel" },
  );
  const panelMaterial = assets.materials.standard.add(
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
  const secondCookieTexture = aperture.createTextureHandle(
    "clustered-lights-spot-cookie-alt",
  );
  const atlasCookieTexture = aperture.createTextureHandle(
    "clustered-lights-spot-cookie-atlas-wide",
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

  sourceAssets.register(cookieTexture);
  sourceAssets.register(secondCookieTexture);
  sourceAssets.register(atlasCookieTexture);
  sourceAssets.register(cookieSampler);
  sourceAssets.register(pointCookieTexture);
  sourceAssets.register(pointCookieSampler);
  sourceAssets.markReady(cookieTexture, createSpotCookieTextureAsset(aperture));
  sourceAssets.markReady(
    secondCookieTexture,
    createSecondSpotCookieTextureAsset(aperture),
  );
  sourceAssets.markReady(
    atlasCookieTexture,
    createAtlasSpotCookieTextureAsset(aperture),
  );
  sourceAssets.markReady(cookieSampler, createSpotCookieSamplerAsset(aperture));
  sourceAssets.markReady(
    pointCookieTexture,
    createPointCookieTextureAsset(aperture),
  );
  sourceAssets.markReady(
    pointCookieSampler,
    createSpotCookieSamplerAsset(aperture),
  );

  return {
    meshKey: aperture.assetHandleKey(panelMesh),
    materialKey: aperture.assetHandleKey(panelMaterial),
    secondaryMaterialKey: aperture.assetHandleKey(secondaryPanelMaterial),
    casterMeshKey: aperture.assetHandleKey(casterMesh),
    casterMaterialKey: aperture.assetHandleKey(casterMaterial),
    spotCasterMeshKey: aperture.assetHandleKey(spotCasterMesh),
    spotCasterMaterialKey: aperture.assetHandleKey(spotCasterMaterial),
    cookieTextureKey: aperture.assetHandleKey(cookieTexture),
    secondCookieTextureKey: aperture.assetHandleKey(secondCookieTexture),
    atlasCookieTextureKey: aperture.assetHandleKey(atlasCookieTexture),
    cookieSamplerKey: aperture.assetHandleKey(cookieSampler),
    pointCookieTextureKey: aperture.assetHandleKey(pointCookieTexture),
    pointCookieSamplerKey: aperture.assetHandleKey(pointCookieSampler),
    clusteredPointShadowEnabled,
    clusteredSpotShadowEnabled,
    clusteredCookieEnabled,
    clusteredSpotCookieEnabled,
    clusteredPointCookieEnabled,
    clusteredMultiCookieEnabled,
    clusteredAtlasCookieEnabled,
    clusteredShadowCookieEnabled,
    clusteredShadowCookieAtlasEnabled,
    clusteredDynamicShadowCookieAtlasEnabled,
    clusteredGpuCookieAtlasUpdateEnabled,
    clusteredShadowCacheEnabled,
    clusteredBufferCacheEnabled,
    clusteredPressureHistoryEnabled,
    clusteredShadowCookiePointArrayEnabled,
    clusteredCookieOnlyEnabled,
    clusteredMixedShadowEnabled,
    clusteredPackedSpotShadowArrayEnabled,
    clusteredPackedSpotShadowAtlasEnabled,
    clusteredMultiPointShadowEnabled,
    clusteredShadowSoftnessEnabled,
    clusteredShadowSoftnessAtlasEnabled,
    clusteredSpotShadowAtlasEnabled,
    clusteredMultiSpotShadowEnabled,
    gpuCookieAtlasTexturePhase: "initial",
    updateGpuCookieAtlasTextureForFrame(frame) {
      if (clusteredGpuCookieAtlasUpdateEnabled !== true) {
        return false;
      }

      const nextPhase = frame >= 5 ? "alternate" : "initial";

      if (this.gpuCookieAtlasTexturePhase === nextPhase) {
        return false;
      }

      sourceAssets.markReady(
        atlasCookieTexture,
        nextPhase === "alternate"
          ? createAlternateAtlasSpotCookieTextureAsset(aperture)
          : createAtlasSpotCookieTextureAsset(aperture),
      );
      this.gpuCookieAtlasTexturePhase = nextPhase;

      return true;
    },
    cameraFrameOffset:
      clusteredPointShadowEnabled || clusteredSpotShadowEnabled ? 0 : 1,
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

function createSecondSpotCookieTextureAsset(aperture) {
  const width = 8;
  const height = 8;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const ring = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const verticalStripe = x === 2 || x === 5;
      const value = ring ? 255 : verticalStripe ? 42 : 210;

      bytes[index + 0] = value;
      bytes[index + 1] = Math.max(24, Math.round(value * 0.86));
      bytes[index + 2] = Math.max(24, Math.round(value * 0.62));
      bytes[index + 3] = 255;
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredSpotCookieAlt",
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

function createAtlasSpotCookieTextureAsset(aperture) {
  const width = 12;
  const height = 4;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const brightBand = x >= 3 && x <= 8;
      const edge = y === 0 || y === height - 1;
      const value = edge ? 255 : brightBand ? 44 : 220;

      bytes[index + 0] = Math.max(24, Math.round(value * 0.74));
      bytes[index + 1] = value;
      bytes[index + 2] = Math.max(24, Math.round(value * 0.9));
      bytes[index + 3] = 255;
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredSpotCookieAtlasWide",
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

function createAlternateAtlasSpotCookieTextureAsset(aperture) {
  const width = 12;
  const height = 4;
  const bytes = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const darkBand = x >= 3 && x <= 8;
      const diagonal = x === y || x + y === width - 1;
      const value = diagonal ? 255 : darkBand ? 230 : 34;

      bytes[index + 0] = value;
      bytes[index + 1] = Math.max(24, Math.round(value * 0.58));
      bytes[index + 2] = Math.max(24, Math.round(value * 0.72));
      bytes[index + 3] = 255;
    }
  }

  return aperture.createTextureAsset({
    label: "ClusteredSpotCookieAtlasWideAlternate",
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

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/clustered-lights.worker.js",
    {
      name: "aperture-clustered-lights-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    previousClusterOccupancy: null,
    standardMaterialShadowReceiverResources: null,
    pointShadowDepthTextureResourceCache: new Map(),
    spotShadowDepthTextureResourceCache: new Map(),
    pointShadowDepthTextureResourceReport: null,
    spotShadowDepthTextureResourceReport: null,
    pointShadowRenderCache: null,
    spotShadowRenderCache: null,
    clusteredShadowCacheStatus: null,
    clusterBufferCacheStatus: null,
    shadowStatus: null,
    dynamicSpotShadowAtlasState: null,
    dynamicSpotShadowAtlasStatus: null,
    gpuCookieAtlasUpdateStatus: null,
    clusterPressureHistoryStatus: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    cameraFrameOffset: scene.cameraFrameOffset,
    clusteredCookieEnabled: scene.clusteredCookieEnabled,
    clusteredSpotCookieEnabled: scene.clusteredSpotCookieEnabled,
    clusteredPointCookieEnabled: scene.clusteredPointCookieEnabled,
    clusteredMultiCookieEnabled: scene.clusteredMultiCookieEnabled,
    clusteredAtlasCookieEnabled: scene.clusteredAtlasCookieEnabled,
    clusteredShadowCookieEnabled: scene.clusteredShadowCookieEnabled,
    clusteredShadowCookieAtlasEnabled: scene.clusteredShadowCookieAtlasEnabled,
    clusteredDynamicShadowCookieAtlasEnabled:
      scene.clusteredDynamicShadowCookieAtlasEnabled,
    clusteredGpuCookieAtlasUpdateEnabled:
      scene.clusteredGpuCookieAtlasUpdateEnabled,
    clusteredShadowCacheEnabled: scene.clusteredShadowCacheEnabled,
    clusteredBufferCacheEnabled: scene.clusteredBufferCacheEnabled,
    clusteredPressureHistoryEnabled: scene.clusteredPressureHistoryEnabled,
    clusteredShadowCookiePointArrayEnabled:
      scene.clusteredShadowCookiePointArrayEnabled,
    clusteredCookieOnlyEnabled: scene.clusteredCookieOnlyEnabled,
    clusteredSpotShadowAtlasEnabled: scene.clusteredSpotShadowAtlasEnabled,
    clusteredMultiSpotShadowEnabled: scene.clusteredMultiSpotShadowEnabled,
    clusteredPackedSpotShadowArrayEnabled:
      scene.clusteredPackedSpotShadowArrayEnabled,
    clusteredPackedSpotShadowAtlasEnabled:
      scene.clusteredPackedSpotShadowAtlasEnabled,
    clusteredMultiPointShadowEnabled: scene.clusteredMultiPointShadowEnabled,
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const frame = message.frame ?? loop.frame;
  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  updateClusteredGpuCookieAtlasProofTexture(scene, frame);
  const report = await app.renderSnapshot(message.snapshot, {
    frame,
    clearColor,
    label: "clustered-lights",
    readbackSamples,
    ...(loop.standardMaterialShadowReceiverResources === null
      ? {}
      : {
          standardMaterialShadowReceiverResources:
            loop.standardMaterialShadowReceiverResources,
        }),
  });
  const status = statusFromReport(
    aperture,
    report,
    scene,
    loop,
    message,
    typedSnapshot,
  );
  const nextShadowResources = await createClusteredShadowReceiverResources(
    aperture,
    app,
    scene,
    loop,
    report,
    frame,
  );

  loop.standardMaterialShadowReceiverResources =
    nextShadowResources?.standardMaterialShadowReceiverResources ?? null;
  loop.shadowStatus = nextShadowResources?.shadowStatus ?? null;

  const transparentReadbackWarmup =
    status.readbackStatus?.reason === "transparent-zero-readback" &&
    frame < maxTransparentReadbackWarmupFrames;

  if (
    status.ok !== true &&
    (frame < maxStatusWarmupFrames || transparentReadbackWarmup)
  ) {
    requestWorkerFrame(worker, loop);
    return;
  }

  publishStatus(status);
  worker.terminate();
}

function updateClusteredGpuCookieAtlasProofTexture(scene, frame) {
  if (
    scene.clusteredGpuCookieAtlasUpdateEnabled !== true ||
    typeof scene.updateGpuCookieAtlasTextureForFrame !== "function"
  ) {
    return false;
  }

  return scene.updateGpuCookieAtlasTextureForFrame(frame) === true;
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

function statusFromReport(
  aperture,
  report,
  scene,
  loop,
  message,
  typedSnapshot,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const pipelineKeys = report.snapshot.meshDraws.map(
    (draw) => draw.batchKey.pipelineKey,
  );
  const localLightClusters = reportJson.localLightClusters ?? null;
  const localLightCookies = reportJson.localLightCookies ?? null;
  const readbackStatus = createReadbackStatus(reportJson.readback);
  const gpuCookieAtlasUpdateStatus = createGpuCookieAtlasUpdateStatus(
    loop,
    scene.clusteredGpuCookieAtlasUpdateEnabled,
    localLightCookies,
    readbackStatus,
    report.snapshot.frame,
  );
  const clusterBufferCacheStatus = createClusterBufferCacheStatus(
    loop,
    scene.clusteredBufferCacheEnabled,
    reportJson.resourceReuse,
    report.snapshot.frame,
    scene.clusteredPressureHistoryEnabled,
  );
  const clusterPressureHistoryStatus = createClusterPressureHistoryStatus({
    loop,
    enabled: scene.clusteredPressureHistoryEnabled,
    frame: report.snapshot.frame,
    resourceReuse: reportJson.resourceReuse,
    localLightCookies,
    shadowStatus: loop.shadowStatus,
    readbackStatus,
  });
  const clusterStatus = createClusterStatus(
    localLightClusters,
    pipelineKeys,
    loop,
    loop.shadowStatus,
    scene.clusteredPointShadowEnabled,
    scene.clusteredSpotShadowEnabled,
    scene.clusteredCookieEnabled,
    scene.clusteredMultiCookieEnabled,
    scene.clusteredPointCookieEnabled,
    scene.clusteredAtlasCookieEnabled,
    scene.clusteredSpotShadowAtlasEnabled,
    scene.clusteredMultiSpotShadowEnabled,
    scene.clusteredPackedSpotShadowArrayEnabled,
    scene.clusteredPackedSpotShadowAtlasEnabled,
    scene.clusteredMultiPointShadowEnabled,
    scene.clusteredShadowCookieEnabled,
    scene.clusteredShadowCookiePointArrayEnabled,
    scene.clusteredShadowCookieAtlasEnabled,
    scene.clusteredDynamicShadowCookieAtlasEnabled,
    scene.clusteredGpuCookieAtlasUpdateEnabled,
    gpuCookieAtlasUpdateStatus,
    scene.clusteredShadowCacheEnabled,
    scene.clusteredBufferCacheEnabled,
    clusterBufferCacheStatus,
    scene.clusteredPressureHistoryEnabled,
    scene.clusteredShadowSoftnessEnabled ||
      scene.clusteredShadowSoftnessAtlasEnabled,
  );
  const shadowSoftnessReadbackStatus = createShadowSoftnessReadbackStatus(
    readbackStatus,
    loop.shadowStatus,
    scene.clusteredShadowSoftnessEnabled ||
      scene.clusteredShadowSoftnessAtlasEnabled,
  );
  recordClusterOccupancy(loop, localLightClusters);

  return {
    example: "clustered-lights",
    ok:
      report.ok &&
      reportJson.counts.diagnostics === 0 &&
      clusterStatus.ok &&
      clusterPressureHistoryStatus.ready &&
      shadowSoftnessReadbackStatus.ok &&
      readbackStatus.ok,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: "webgpu-explicit",
    clearColor: colorStatus(clearColor),
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    scene,
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    pipelineKeys,
    localLightClusters,
    localLightCookies,
    clusterStatus,
    clusterPressureHistoryStatus,
    shadowStatus: loop.shadowStatus,
    gpuCookieAtlasUpdateStatus,
    clusterBufferCacheStatus,
    shadowSoftnessReadbackStatus,
    readbackStatus,
    readback: reportJson.readback ?? null,
    resourceReuse: reportJson.resourceReuse,
    counts: reportJson.counts,
    diagnostics: reportJson.diagnostics,
  };
}

function createClusterPressureHistoryStatus({
  loop,
  enabled,
  frame,
  resourceReuse,
  localLightCookies,
  shadowStatus,
  readbackStatus,
}) {
  if (enabled !== true) {
    return {
      enabled: false,
      ready: true,
      requiredFrames: 0,
      observedFrames: 0,
      rollingWindowSize: 0,
      baselineMode: "disabled",
      cachedPath: emptyClusterPressureWork(),
      noCacheBaseline: emptyClusterPressureWork(),
      avoided: emptyClusterPressureWork(),
      reduction: {
        cachedWork: 0,
        baselineWork: 0,
        avoidedWork: 0,
      },
      stablePixels: {
        ready: true,
        baselineFrame: null,
        baselineLuminance: null,
        latestLuminance: null,
        maxLuminanceDelta: 0,
        sampleCount: 0,
      },
      samples: [],
    };
  }

  const previous = loop.clusterPressureHistoryStatus ?? null;
  const atlasUpdate = localLightCookies?.atlasUpdate ?? null;
  const actualClusterBufferWrites =
    resourceReuse?.localLightClusterBufferWrites ?? 0;
  const avoidedClusterBufferWrites =
    resourceReuse?.localLightClusterBufferWritesSkipped ?? 0;
  const actualCookieAtlasTileUpdates = atlasUpdate?.updatedTileCount ?? 0;
  const avoidedCookieAtlasTileUpdates = atlasUpdate?.cachedTileCount ?? 0;
  const shadowWork = clusteredShadowFrameWork(shadowStatus);
  const sample = {
    frame,
    cachedPath: {
      clusterBufferWrites: actualClusterBufferWrites,
      cookieAtlasTileUpdates: actualCookieAtlasTileUpdates,
      localShadowSubmissions: shadowWork.submittedCommandBuffers,
    },
    noCacheBaseline: {
      clusterBufferWrites:
        actualClusterBufferWrites + avoidedClusterBufferWrites,
      cookieAtlasTileUpdates:
        actualCookieAtlasTileUpdates + avoidedCookieAtlasTileUpdates,
      localShadowSubmissions:
        shadowWork.submittedCommandBuffers + shadowWork.skippedCommandBuffers,
    },
    avoided: {
      clusterBufferWrites: avoidedClusterBufferWrites,
      cookieAtlasTileUpdates: avoidedCookieAtlasTileUpdates,
      localShadowSubmissions: shadowWork.skippedCommandBuffers,
    },
  };
  const samples = [...(previous?.samples ?? []), sample].slice(
    -clusterPressureHistoryFrameCount,
  );
  const cachedPath = sumClusterPressureWork(samples, "cachedPath");
  const noCacheBaseline = sumClusterPressureWork(samples, "noCacheBaseline");
  const avoided = sumClusterPressureWork(samples, "avoided");
  const latestLuminance = averageReadbackLuminance(readbackStatus, [
    "left-bank",
    "center",
    "right-bank",
    "right-cookie-upper",
    "right-cookie-lower",
  ]);
  const previousStable = previous?.stablePixels ?? null;
  const baselineLuminance =
    previousStable?.baselineLuminance ??
    (frame >= clusterPressureStableFrameStart ? latestLuminance : null);
  const baselineFrame =
    previousStable?.baselineFrame ??
    (baselineLuminance === null ? null : frame);
  const currentDelta =
    baselineLuminance === null || latestLuminance === null
      ? 0
      : Math.abs(latestLuminance - baselineLuminance);
  const stableSampleCount =
    (previousStable?.sampleCount ?? 0) +
    (frame >= clusterPressureStableFrameStart && latestLuminance !== null
      ? 1
      : 0);
  const maxLuminanceDelta = Math.max(
    previousStable?.maxLuminanceDelta ?? 0,
    currentDelta,
  );
  const stablePixels = {
    ready:
      stableSampleCount >=
        clusterPressureHistoryFrameCount - clusterPressureStableFrameStart &&
      baselineLuminance !== null &&
      latestLuminance !== null &&
      maxLuminanceDelta <= 6,
    baselineFrame,
    baselineLuminance,
    latestLuminance,
    maxLuminanceDelta,
    sampleCount: stableSampleCount,
  };
  const cachedWork = totalClusterPressureWork(cachedPath);
  const baselineWork = totalClusterPressureWork(noCacheBaseline);
  const avoidedWork = totalClusterPressureWork(avoided);
  const status = {
    enabled: true,
    ready:
      samples.length >= clusterPressureHistoryFrameCount &&
      avoided.clusterBufferWrites > 0 &&
      avoided.cookieAtlasTileUpdates > 0 &&
      avoided.localShadowSubmissions > 0 &&
      baselineWork > cachedWork &&
      stablePixels.ready,
    requiredFrames: clusterPressureHistoryFrameCount,
    observedFrames: samples.length,
    rollingWindowSize: clusterPressureHistoryFrameCount,
    baselineMode: "derived-no-cache",
    firstFrame: samples[0]?.frame ?? frame,
    lastFrame: samples[samples.length - 1]?.frame ?? frame,
    cachedPath,
    noCacheBaseline,
    avoided,
    reduction: {
      cachedWork,
      baselineWork,
      avoidedWork,
    },
    latest: sample,
    stablePixels,
    samples,
  };

  loop.clusterPressureHistoryStatus = status;

  return status;
}

function emptyClusterPressureWork() {
  return {
    clusterBufferWrites: 0,
    cookieAtlasTileUpdates: 0,
    localShadowSubmissions: 0,
  };
}

function sumClusterPressureWork(samples, field) {
  return samples.reduce((total, sample) => {
    const work = sample[field] ?? {};

    return {
      clusterBufferWrites:
        total.clusterBufferWrites + (work.clusterBufferWrites ?? 0),
      cookieAtlasTileUpdates:
        total.cookieAtlasTileUpdates + (work.cookieAtlasTileUpdates ?? 0),
      localShadowSubmissions:
        total.localShadowSubmissions + (work.localShadowSubmissions ?? 0),
    };
  }, emptyClusterPressureWork());
}

function totalClusterPressureWork(work) {
  return (
    (work.clusterBufferWrites ?? 0) +
    (work.cookieAtlasTileUpdates ?? 0) +
    (work.localShadowSubmissions ?? 0)
  );
}

function clusteredShadowFrameWork(shadowStatus) {
  const caches = [shadowStatus?.point?.cache, shadowStatus?.spot?.cache].filter(
    (cache) => cache?.enabled === true,
  );

  return caches.reduce(
    (total, cache) => ({
      submittedCommandBuffers:
        total.submittedCommandBuffers + (cache.submittedCommandBuffers ?? 0),
      skippedCommandBuffers:
        total.skippedCommandBuffers + (cache.skippedCommandBuffers ?? 0),
    }),
    { submittedCommandBuffers: 0, skippedCommandBuffers: 0 },
  );
}

function createClusterStatus(
  localLightClusters,
  pipelineKeys,
  loop,
  shadowStatus,
  pointShadowEnabled,
  spotShadowEnabled,
  cookieEnabled,
  multiCookieEnabled,
  pointCookieEnabled,
  atlasCookieEnabled,
  spotShadowAtlasEnabled,
  multiSpotShadowEnabled,
  packedSpotShadowArrayEnabled,
  packedSpotShadowAtlasEnabled,
  multiPointShadowEnabled,
  shadowCookieEnabled,
  shadowCookiePointArrayEnabled,
  shadowCookieAtlasEnabled,
  dynamicShadowCookieAtlasEnabled,
  gpuCookieAtlasUpdateEnabled,
  gpuCookieAtlasUpdateStatus,
  shadowCacheEnabled,
  bufferCacheEnabled,
  clusterBufferCacheStatus,
  pressureHistoryEnabled,
  shadowSoftnessEnabled,
) {
  const clusterPipelineUsed = pipelineKeys.some((pipelineKey) =>
    pipelineKey.includes("clusteredLocalLights"),
  );
  const clusterRoutes = clusterRoutesFromReport(localLightClusters);
  const primaryRoute = clusterRoutes[0] ?? null;
  const totalLocalLights = primaryRoute?.totalLocalLights ?? 0;
  const averageLights =
    primaryRoute?.averageLightsPerPopulatedCell ?? totalLocalLights;
  const occupancyHash = primaryRoute?.occupancyHash ?? null;
  const previousOccupancyHash = loop.previousClusterOccupancy?.hash ?? null;
  const occupancyChanged =
    occupancyHash !== null &&
    previousOccupancyHash !== null &&
    occupancyHash !== previousOccupancyHash;
  const occupancyRequirementOk =
    bufferCacheEnabled === true
      ? clusterBufferCacheStatus.observedClusterInvalidation === true
      : occupancyChanged;
  const routeViewIds = clusterRoutes.map((route) => route.viewId ?? null);
  const routeOccupancyHashes = clusterRoutes.map(
    (route) => route.occupancyHash ?? null,
  );
  const distinctViewIds = new Set(
    routeViewIds.filter((viewId) => viewId !== null),
  ).size;
  const distinctOccupancyHashes = new Set(
    routeOccupancyHashes.filter((hash) => hash !== null),
  ).size;
  const routePressureOk =
    clusterRoutes.length > 0 &&
    clusterRoutes.every((route) => {
      const routeTotalLocalLights = route.totalLocalLights ?? 0;
      const buildPressure = route.buildPressure ?? {};
      const naiveCellLightPairTests =
        buildPressure.naiveCellLightPairTests ?? 0;
      const lightCellRangeTests = buildPressure.lightCellRangeTests ?? 0;
      const lightCellWriteAttempts =
        buildPressure.lightCellWriteAttempts ?? naiveCellLightPairTests;

      return (
        route.enabled === true &&
        route.coordinateSpace === "view-depth" &&
        routeTotalLocalLights >= 64 &&
        (route.maxLightsPerPopulatedCell ?? routeTotalLocalLights) <
          routeTotalLocalLights &&
        (route.averageLightsPerPopulatedCell ?? routeTotalLocalLights) <
          routeTotalLocalLights &&
        buildPressure.assignmentStrategy === "light-range" &&
        lightCellRangeTests === route.clusteredLocalLights &&
        lightCellWriteAttempts < naiveCellLightPairTests
      );
    });
  const routeShadowStates = clusterRoutes.map((route) => {
    const shadow = route.shadowCookieMetadata?.shadow ?? null;

    return {
      status: shadow?.status ?? null,
      samplingSupported: shadow?.samplingSupported === true,
      localRequestCount: shadow?.localRequestCount ?? 0,
      clusteredLightCount: shadow?.clusteredLightCount ?? 0,
      supportedLightCount: shadow?.supportedLightCount ?? 0,
      hardFilterLightCount: shadow?.hardFilterLightCount ?? 0,
      softFilterLightCount: shadow?.softFilterLightCount ?? 0,
      maxFilterRadiusTexels: shadow?.maxFilterRadiusTexels ?? 0,
      fallbackReason: shadow?.fallbackReason ?? null,
    };
  });
  const routeCookieStates = clusterRoutes.map((route) => {
    const cookie = route.shadowCookieMetadata?.cookie ?? null;

    return {
      status: cookie?.status ?? null,
      samplingSupported: cookie?.samplingSupported === true,
      localRequestCount: cookie?.localRequestCount ?? 0,
      clusteredLightCount: cookie?.clusteredLightCount ?? 0,
      supportedLightCount: cookie?.supportedLightCount ?? 0,
      fallbackReason: cookie?.fallbackReason ?? null,
    };
  });
  const expectedShadowRequestCount =
    (pointShadowEnabled === true ? 4 : 0) +
    (spotShadowEnabled === true
      ? dynamicShadowCookieAtlasEnabled === true
        ? 4
        : multiSpotShadowEnabled === true
          ? 2
          : 1
      : 0);
  const requiredSpotShadowSupportedCount =
    spotShadowEnabled === true
      ? dynamicShadowCookieAtlasEnabled === true
        ? 4
        : multiSpotShadowEnabled === true
          ? 2
          : 1
      : 0;
  const requiredPointShadowSupportedCount =
    pointShadowEnabled === true
      ? multiPointShadowEnabled === true
        ? 2
        : 1
      : 0;
  const routePointShadowSamplingOk =
    pointShadowEnabled === true &&
    routeShadowStates.some(
      (shadow) =>
        shadow.status === "sampling-ready" &&
        shadow.samplingSupported === true &&
        shadow.localRequestCount >= 4 &&
        shadow.clusteredLightCount >= 4 &&
        shadow.supportedLightCount >= requiredPointShadowSupportedCount,
    );
  const routeSpotShadowSamplingOk =
    spotShadowEnabled === true &&
    routeShadowStates.some(
      (shadow) =>
        shadow.status === "sampling-ready" &&
        shadow.samplingSupported === true &&
        shadow.localRequestCount >= expectedShadowRequestCount &&
        shadow.clusteredLightCount >= expectedShadowRequestCount &&
        shadow.supportedLightCount >= requiredSpotShadowSupportedCount,
    );
  const routeMultiSpotShadowSamplingOk =
    multiSpotShadowEnabled === true && routeSpotShadowSamplingOk;
  const routeSpotShadowAtlasSamplingOk =
    spotShadowAtlasEnabled === true &&
    routeSpotShadowSamplingOk &&
    shadowStatus?.spot?.mode === "clustered-spot-atlas-depth-compare" &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("shadowMap") &&
        !pipelineKey.includes("clusteredLocalLightArrayShadows"),
    );
  const mixedShadowEnabled =
    pointShadowEnabled === true && spotShadowEnabled === true;
  const mixedShadowMode = shadowStatus?.mode ?? null;
  const mixedShadowModeOk =
    mixedShadowMode === "clustered-point-spot-depth-compare" ||
    mixedShadowMode === "clustered-point-spot-array-depth-compare" ||
    mixedShadowMode === "clustered-point-spot-atlas-depth-compare" ||
    mixedShadowMode === "clustered-point-array-spot-depth-compare" ||
    mixedShadowMode === "clustered-point-array-spot-array-depth-compare" ||
    mixedShadowMode === "clustered-point-array-spot-atlas-depth-compare";
  const routeMixedShadowSamplingOk =
    mixedShadowEnabled === true &&
    routePointShadowSamplingOk &&
    routeSpotShadowSamplingOk &&
    shadowStatus?.supported === true &&
    mixedShadowModeOk &&
    shadowStatus?.point?.supported === true &&
    shadowStatus?.spot?.supported === true;
  const routeMixedPackedSpotShadowSamplingOk =
    packedSpotShadowArrayEnabled === true &&
    routeMixedShadowSamplingOk &&
    shadowStatus?.spot?.mode === "clustered-spot-array-depth-compare" &&
    (mixedShadowMode === "clustered-point-spot-array-depth-compare" ||
      mixedShadowMode === "clustered-point-array-spot-array-depth-compare") &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightArrayShadows") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap"),
    );
  const routeMixedPackedSpotShadowAtlasSamplingOk =
    packedSpotShadowAtlasEnabled === true &&
    routeMixedShadowSamplingOk &&
    shadowStatus?.spot?.mode === "clustered-spot-atlas-depth-compare" &&
    mixedShadowMode === "clustered-point-spot-atlas-depth-compare" &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap") &&
        !pipelineKey.includes("clusteredLocalLightArrayShadows"),
    );
  const routePackedSpotShadowAtlasSamplingOk =
    packedSpotShadowAtlasEnabled === true &&
    shadowStatus?.spot?.mode === "clustered-spot-atlas-depth-compare" &&
    (mixedShadowEnabled === true
      ? routeMixedPackedSpotShadowAtlasSamplingOk
      : routeSpotShadowAtlasSamplingOk) &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("shadowMap") &&
        !pipelineKey.includes("clusteredLocalLightArrayShadows"),
    );
  const routeMultiPointShadowSamplingOk =
    multiPointShadowEnabled === true &&
    routePointShadowSamplingOk &&
    shadowStatus?.point?.supported === true &&
    (shadowStatus.point.supportedLightCount ?? 0) >=
      requiredPointShadowSupportedCount &&
    shadowStatus.point.mode === "clustered-point-depth-2d-array-compare" &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightPointArrayShadows") &&
        pipelineKey.includes("pointShadowMap"),
    );
  const routeShadowHardFilterReady = routeShadowStates.some(
    (shadow) =>
      shadow.status === "sampling-ready" && shadow.hardFilterLightCount >= 1,
  );
  const routeShadowSoftFilterReady = routeShadowStates.some(
    (shadow) =>
      shadow.status === "sampling-ready" &&
      shadow.softFilterLightCount >= 1 &&
      shadow.maxFilterRadiusTexels >= 2,
  );
  const routePointShadowSoftnessReady =
    shadowSoftnessEnabled === true &&
    shadowStatus?.point?.supported === true &&
    (shadowStatus.point.filterRadiusTexels ?? 0) >=
      clusteredShadowSoftnessPointFilterRadiusTexels;
  const routeSpotShadowArraySoftnessReady =
    shadowSoftnessEnabled === true &&
    shadowStatus?.spot?.supported === true &&
    shadowStatus.spot.mode === "clustered-spot-array-depth-compare" &&
    Array.isArray(shadowStatus.spot.filterRadiusTexels) &&
    shadowStatus.spot.filterRadiusTexels.some((radius) => radius <= 0) &&
    shadowStatus.spot.filterRadiusTexels.some((radius) => radius >= 2) &&
    routeShadowHardFilterReady &&
    routeShadowSoftFilterReady;
  const routeSpotShadowAtlasSoftnessReady =
    shadowSoftnessEnabled === true &&
    shadowStatus?.spot?.supported === true &&
    shadowStatus.spot.mode === "clustered-spot-atlas-depth-compare" &&
    Array.isArray(shadowStatus.spot.filterRadiusTexels) &&
    shadowStatus.spot.filterRadiusTexels.some((radius) => radius <= 0) &&
    shadowStatus.spot.filterRadiusTexels.some((radius) => radius >= 2) &&
    routeShadowHardFilterReady &&
    routeShadowSoftFilterReady;
  const routeShadowSoftnessSamplingOk =
    shadowSoftnessEnabled !== true ||
    (routePointShadowSoftnessReady &&
      (spotShadowAtlasEnabled === true
        ? routeSpotShadowAtlasSoftnessReady
        : routeSpotShadowArraySoftnessReady));
  const requiredCookieSupportedCount =
    dynamicShadowCookieAtlasEnabled === true
      ? 4
      : (multiCookieEnabled === true ? 2 : 0) +
          (pointCookieEnabled === true ? 1 : 0) ||
        (cookieEnabled === true ? 1 : 0);
  const routeCookieSamplingOk =
    cookieEnabled === true &&
    routeCookieStates.some(
      (cookie) =>
        cookie.status === "sampling-ready" &&
        cookie.samplingSupported === true &&
        cookie.localRequestCount >= requiredCookieSupportedCount &&
        cookie.clusteredLightCount >= requiredCookieSupportedCount &&
        cookie.supportedLightCount >= requiredCookieSupportedCount,
    );
  const routeCookieAtlasSamplingOk =
    atlasCookieEnabled === true &&
    routeCookieSamplingOk &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLightCookies") &&
        !pipelineKey.includes("clusteredLocalLightArrayCookies") &&
        !pipelineKey.includes("clusteredLocalLightCubeCookies"),
    );
  const routeMetadataOk =
    clusterRoutes.length > 0 &&
    clusterRoutes.every((route) => {
      const shadow = route.shadowCookieMetadata?.shadow ?? null;
      const cookie = route.shadowCookieMetadata?.cookie ?? null;
      const shadowSamplingEnabled =
        pointShadowEnabled === true || spotShadowEnabled === true;
      const routeLayerMask = route.layerMask ?? 0;
      const pointShadowReceiverLayerMask =
        shadowCookieEnabled === true
          ? clusteredSpotShadowIntent.receiverLayerMask
          : clusteredPointShadowIntent.receiverLayerMask;
      const routeExpectedPointShadowSupportedCount =
        pointShadowEnabled === true &&
        (routeLayerMask & pointShadowReceiverLayerMask) !== 0
          ? requiredPointShadowSupportedCount
          : 0;
      const routeExpectedSpotShadowSupportedCount =
        spotShadowEnabled === true &&
        (routeLayerMask & clusteredSpotShadowIntent.receiverLayerMask) !== 0
          ? requiredSpotShadowSupportedCount
          : 0;
      const routeLayerShadowExpectedCount =
        routeExpectedPointShadowSupportedCount +
        routeExpectedSpotShadowSupportedCount;
      const routeExpectedShadowSupportedCount =
        routeLayerShadowExpectedCount > 0
          ? routeLayerShadowExpectedCount
          : (shadow?.localRequestCount ?? 0) >= expectedShadowRequestCount
            ? Math.max(
                1,
                requiredPointShadowSupportedCount +
                  requiredSpotShadowSupportedCount,
              )
            : 1;
      const shadowReady = shadowSamplingEnabled
        ? (shadow?.status === "sampling-ready" &&
            shadow.samplingSupported === true &&
            (shadow.supportedLightCount ?? 0) >=
              routeExpectedShadowSupportedCount) ||
          (shadow?.status === "metadata-only" &&
            shadow.samplingSupported === false &&
            shadow.fallbackReason ===
              "clustered-local-shadow-sampling-not-implemented")
        : (shadow?.status === "metadata-only" &&
            shadow.samplingSupported === false &&
            shadow.fallbackReason ===
              "clustered-local-shadow-sampling-not-implemented") ||
          (shadow?.status === "not-requested" &&
            shadow.samplingSupported === false &&
            (shadow.localRequestCount ?? 0) === 0 &&
            (shadow.clusteredLightCount ?? 0) === 0);

      const minimumRouteShadowRequestCount =
        mixedShadowEnabled === true ? 4 : expectedShadowRequestCount;
      const shadowCountsReady =
        expectedShadowRequestCount === 0 ||
        ((shadow?.localRequestCount ?? 0) >= minimumRouteShadowRequestCount &&
          (shadow?.clusteredLightCount ?? 0) >= minimumRouteShadowRequestCount);
      const cookieReady =
        cookieEnabled === true
          ? (cookie?.status === "sampling-ready" &&
              cookie.samplingSupported === true &&
              (cookie.supportedLightCount ?? 0) >=
                requiredCookieSupportedCount) ||
            (cookie?.status === "not-requested" &&
              cookie.samplingSupported === false &&
              (cookie.localRequestCount ?? 0) === 0 &&
              (cookie.clusteredLightCount ?? 0) === 0)
          : cookie?.status === "not-requested" &&
            cookie.samplingSupported === false &&
            (cookie.localRequestCount ?? 0) === 0 &&
            (cookie.clusteredLightCount ?? 0) === 0;

      return shadowReady && shadowCountsReady && cookieReady;
    });
  const routePackedShadowCookieShadowReady =
    shadowCookieEnabled === true &&
    clusterRoutes.some((route) => {
      const shadow = route.shadowCookieMetadata?.shadow ?? null;
      const routeLayerMask = route.layerMask ?? 0;

      return (
        (routeLayerMask & clusteredSpotShadowIntent.receiverLayerMask) !== 0 &&
        shadow?.status === "sampling-ready" &&
        shadow.samplingSupported === true &&
        (shadow.localRequestCount ?? 0) >= expectedShadowRequestCount &&
        (shadow.clusteredLightCount ?? 0) >= expectedShadowRequestCount &&
        (shadow.supportedLightCount ?? 0) >=
          requiredPointShadowSupportedCount + requiredSpotShadowSupportedCount
      );
    });
  const routePackedShadowCookieCookieReady =
    shadowCookieEnabled === true &&
    clusterRoutes.some((route) => {
      const cookie = route.shadowCookieMetadata?.cookie ?? null;
      const routeLayerMask = route.layerMask ?? 0;

      return (
        (routeLayerMask & clusteredSpotShadowIntent.receiverLayerMask) !== 0 &&
        cookie?.status === "sampling-ready" &&
        cookie.samplingSupported === true &&
        (cookie.localRequestCount ?? 0) >= requiredCookieSupportedCount &&
        (cookie.clusteredLightCount ?? 0) >= requiredCookieSupportedCount &&
        (cookie.supportedLightCount ?? 0) >= requiredCookieSupportedCount
      );
    });
  const routePackedShadowCookiePipelineOk =
    shadowCookieEnabled === true &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightCookies") &&
        pipelineKey.includes("clusteredLocalLightShadowCookies") &&
        (packedSpotShadowAtlasEnabled === true ||
          pipelineKey.includes("clusteredLocalLightArrayShadows")) &&
        (pointShadowEnabled !== true ||
          pipelineKey.includes("pointShadowMap")) &&
        pipelineKey.includes("shadowMap"),
    );
  const routePackedShadowCookiePointArrayReady =
    shadowCookiePointArrayEnabled === true &&
    routePackedShadowCookieShadowReady &&
    routeMultiPointShadowSamplingOk &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLightShadowCookies") &&
        pipelineKey.includes("clusteredLocalLightPointArrayShadows") &&
        pipelineKey.includes("clusteredLocalLightArrayShadows") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap"),
    );
  const routePackedShadowCookieAtlasShadowReady =
    shadowCookieAtlasEnabled === true &&
    routePackedShadowCookieShadowReady &&
    routePackedSpotShadowAtlasSamplingOk;
  const routePackedShadowCookieAtlasCookieReady =
    shadowCookieAtlasEnabled === true && routeCookieAtlasSamplingOk;
  const routePackedShadowCookieAtlasShadowAligned =
    shadowCookieAtlasEnabled === true &&
    routePackedShadowCookieAtlasCookieReady &&
    pipelineKeys.some(
      (pipelineKey) =>
        pipelineKey.includes("clusteredLocalLightShadowCookies") &&
        (pointShadowEnabled !== true ||
          pipelineKey.includes("pointShadowMap")) &&
        pipelineKey.includes("shadowMap") &&
        !pipelineKey.includes("clusteredLocalLightArrayShadows"),
    );
  const routePackedShadowCookieSamplingOk =
    shadowCookieEnabled !== true ||
    (routePackedShadowCookieShadowReady &&
      routePackedShadowCookieCookieReady &&
      routePackedShadowCookiePipelineOk &&
      (packedSpotShadowAtlasEnabled === true
        ? routePackedSpotShadowAtlasSamplingOk
        : routeMixedPackedSpotShadowSamplingOk) &&
      routeCookieSamplingOk);
  const routePackedShadowCookiePointArraySamplingOk =
    shadowCookiePointArrayEnabled !== true ||
    (routePackedShadowCookiePointArrayReady &&
      routePackedShadowCookieCookieReady &&
      routePackedShadowCookieSamplingOk);
  const routePackedShadowCookieAtlasSamplingOk =
    shadowCookieAtlasEnabled !== true ||
    (routePackedShadowCookieAtlasShadowReady &&
      routePackedShadowCookieAtlasCookieReady &&
      routePackedShadowCookieAtlasShadowAligned &&
      routePackedShadowCookieSamplingOk);
  const dynamicShadowCookieAtlasStatus = createDynamicShadowCookieAtlasStatus(
    loop,
    dynamicShadowCookieAtlasEnabled,
  );
  const routeDynamicShadowCookieAtlasReady =
    dynamicShadowCookieAtlasEnabled !== true ||
    (dynamicShadowCookieAtlasStatus.ready === true &&
      dynamicShadowCookieAtlasStatus.assignedSlotCount >=
        requiredSpotShadowSupportedCount &&
      dynamicShadowCookieAtlasStatus.maxReusedSlotCount >= 3 &&
      dynamicShadowCookieAtlasStatus.maxStaleSlotCount >= 1 &&
      dynamicShadowCookieAtlasStatus.maxEvictedSlotCount >= 1 &&
      dynamicShadowCookieAtlasStatus.shadowAligned === true &&
      dynamicShadowCookieAtlasStatus.diagnosticsCount === 0);
  const routeGpuCookieAtlasUpdateReady =
    gpuCookieAtlasUpdateEnabled !== true ||
    (gpuCookieAtlasUpdateStatus?.ready === true &&
      gpuCookieAtlasUpdateStatus.textureLayout === "atlas" &&
      gpuCookieAtlasUpdateStatus.observedGpuBlit === true &&
      gpuCookieAtlasUpdateStatus.observedChangedTileGpuBlit === true &&
      gpuCookieAtlasUpdateStatus.maxGpuBlitTileCount >= 1 &&
      gpuCookieAtlasUpdateStatus.maxCpuUploadTileCount === 0);
  const spotShadowCacheStatus = shadowStatus?.spot?.cache ?? null;
  const routeClusteredShadowCacheReady =
    shadowCacheEnabled !== true ||
    (spotShadowCacheStatus?.enabled === true &&
      spotShadowCacheStatus.lastAction === "hit" &&
      spotShadowCacheStatus.hitCount >= 1 &&
      spotShadowCacheStatus.missCount >= 1 &&
      spotShadowCacheStatus.skippedShadowPassCount >= 1 &&
      spotShadowCacheStatus.submittedShadowPassCount >= 1 &&
      (pressureHistoryEnabled === true ||
        spotShadowCacheStatus.maxReusedTextureCount >= 1) &&
      (pressureHistoryEnabled === true ||
        spotShadowCacheStatus.observedCasterTransformInvalidation === true) &&
      spotShadowCacheStatus.cachedShadowCount >=
        requiredSpotShadowSupportedCount);
  const routeClusteredBufferCacheReady =
    bufferCacheEnabled !== true ||
    (clusterBufferCacheStatus.ready === true &&
      clusterBufferCacheStatus.observedClusterInvalidation === true &&
      (pressureHistoryEnabled === true ||
        clusterBufferCacheStatus.observedBufferWrites === true) &&
      clusterBufferCacheStatus.observedSkippedWrites === true &&
      clusterBufferCacheStatus.latestWrites === 0 &&
      clusterBufferCacheStatus.latestSkippedWrites >= 4);

  return {
    ok:
      clusterPipelineUsed &&
      clusterRoutes.length >= 2 &&
      distinctViewIds >= 2 &&
      distinctOccupancyHashes >= 2 &&
      routePressureOk &&
      routeMetadataOk &&
      (pointShadowEnabled !== true || routePointShadowSamplingOk) &&
      (spotShadowEnabled !== true || routeSpotShadowSamplingOk) &&
      (multiSpotShadowEnabled !== true || routeMultiSpotShadowSamplingOk) &&
      (spotShadowAtlasEnabled !== true || routeSpotShadowAtlasSamplingOk) &&
      (mixedShadowEnabled !== true || routeMixedShadowSamplingOk) &&
      (packedSpotShadowArrayEnabled !== true ||
        routeMixedPackedSpotShadowSamplingOk) &&
      (packedSpotShadowAtlasEnabled !== true ||
        routePackedSpotShadowAtlasSamplingOk) &&
      (multiPointShadowEnabled !== true || routeMultiPointShadowSamplingOk) &&
      routePackedShadowCookieSamplingOk &&
      routePackedShadowCookiePointArraySamplingOk &&
      routePackedShadowCookieAtlasSamplingOk &&
      routeDynamicShadowCookieAtlasReady &&
      routeGpuCookieAtlasUpdateReady &&
      routeClusteredShadowCacheReady &&
      routeClusteredBufferCacheReady &&
      routeShadowSoftnessSamplingOk &&
      (cookieEnabled !== true || routeCookieSamplingOk) &&
      occupancyRequirementOk &&
      (localLightClusters?.resourceReuse?.buffersReused ?? 0) >= 8,
    clusterPipelineUsed,
    coordinateSpace: primaryRoute?.coordinateSpace ?? null,
    viewId: primaryRoute?.viewId ?? null,
    totalLocalLights,
    populatedCells: primaryRoute?.populatedCells ?? null,
    averageLightsPerPopulatedCell: averageLights,
    maxLightsPerPopulatedCell: primaryRoute?.maxLightsPerPopulatedCell ?? null,
    totalAssignedLightReferences:
      primaryRoute?.totalAssignedLightReferences ?? null,
    occupancyHash,
    previousOccupancyHash,
    occupancyChanged,
    occupancyRequirementOk,
    routeCount: clusterRoutes.length,
    routeViewIds,
    routeOccupancyHashes,
    distinctViewIds,
    distinctOccupancyHashes,
    routePressureOk,
    routeMetadataOk,
    routePointShadowSamplingOk,
    routeSpotShadowSamplingOk,
    routeMultiSpotShadowSamplingOk,
    routeSpotShadowAtlasSamplingOk,
    routeMixedShadowSamplingOk,
    routeMixedPackedSpotShadowSamplingOk,
    routeMixedPackedSpotShadowAtlasSamplingOk,
    routePackedSpotShadowAtlasSamplingOk,
    routeMultiPointShadowSamplingOk,
    routePackedShadowCookieShadowReady,
    routePackedShadowCookieCookieReady,
    routePackedShadowCookiePipelineOk,
    routePackedShadowCookieSamplingOk,
    routePackedShadowCookiePointArrayReady,
    routePackedShadowCookiePointArraySamplingOk,
    routePackedShadowCookieAtlasShadowReady,
    routePackedShadowCookieAtlasCookieReady,
    routePackedShadowCookieAtlasShadowAligned,
    routePackedShadowCookieAtlasSamplingOk,
    routeDynamicShadowCookieAtlasReady,
    dynamicShadowCookieAtlasStatus,
    routeGpuCookieAtlasUpdateReady,
    gpuCookieAtlasUpdateStatus,
    routeClusteredShadowCacheReady,
    shadowCacheStatus: spotShadowCacheStatus,
    routeClusteredBufferCacheReady,
    clusterBufferCacheStatus,
    routeShadowHardFilterReady,
    routeShadowSoftFilterReady,
    routePointShadowSoftnessReady,
    routeSpotShadowArraySoftnessReady,
    routeSpotShadowAtlasSoftnessReady,
    routeShadowSoftnessSamplingOk,
    routeCookieSamplingOk,
    routeCookieAtlasSamplingOk,
    requiredSpotShadowSupportedCount,
    requiredPointShadowSupportedCount,
    requiredCookieSupportedCount,
    routeShadowStates,
    routeCookieStates,
    routes: clusterRoutes.map((route) => ({
      enabled: route.enabled,
      layerMask: route.layerMask ?? null,
      lightSetKey: route.lightSetKey ?? null,
      coordinateSpace: route.coordinateSpace ?? null,
      viewId: route.viewId ?? null,
      totalLocalLights: route.totalLocalLights ?? 0,
      clusteredLocalLights: route.clusteredLocalLights ?? 0,
      populatedCells: route.populatedCells ?? null,
      averageLightsPerPopulatedCell:
        route.averageLightsPerPopulatedCell ?? null,
      maxLightsPerPopulatedCell: route.maxLightsPerPopulatedCell ?? null,
      totalAssignedLightReferences: route.totalAssignedLightReferences ?? null,
      occupancyHash: route.occupancyHash ?? null,
      buildPressure: route.buildPressure ?? null,
      shadowCookieMetadata: route.shadowCookieMetadata ?? null,
      resourceKey: route.resourceKey ?? null,
    })),
    buffersCreated: localLightClusters?.resourceReuse?.buffersCreated ?? 0,
    buffersReused: localLightClusters?.resourceReuse?.buffersReused ?? 0,
  };
}

function recordClusterOccupancy(loop, localLightClusters) {
  const primaryRoute = clusterRoutesFromReport(localLightClusters)[0] ?? null;

  if (primaryRoute?.enabled !== true) {
    return;
  }

  loop.previousClusterOccupancy = {
    hash: primaryRoute.occupancyHash ?? null,
    populatedCells: primaryRoute.populatedCells ?? null,
    totalAssignedLightReferences:
      primaryRoute.totalAssignedLightReferences ?? null,
  };
}

function createDynamicShadowCookieAtlasStatus(loop, enabled) {
  if (enabled !== true) {
    return {
      enabled: false,
      ready: true,
      shadowAligned: false,
      atlasWidth: 0,
      atlasHeight: 0,
      generation: 0,
      requestedSlotCount: 0,
      assignedSlotCount: 0,
      storedSlotCount: 0,
      reusedSlotCount: 0,
      reassignedSlotCount: 0,
      staleSlotCount: 0,
      evictedSlotCount: 0,
      maxReusedSlotCount: 0,
      maxStaleSlotCount: 0,
      maxEvictedSlotCount: 0,
      diagnosticsCount: 0,
      diagnostics: [],
      slotKeys: [],
      tiles: [],
    };
  }

  return (
    loop.dynamicSpotShadowAtlasStatus ?? {
      enabled: true,
      ready: false,
      shadowAligned: false,
      atlasWidth: clusteredDynamicSpotShadowAtlas.width,
      atlasHeight: clusteredDynamicSpotShadowAtlas.height,
      generation: 0,
      requestedSlotCount: 0,
      assignedSlotCount: 0,
      storedSlotCount: 0,
      reusedSlotCount: 0,
      reassignedSlotCount: 0,
      staleSlotCount: 0,
      evictedSlotCount: 0,
      maxReusedSlotCount: 0,
      maxStaleSlotCount: 0,
      maxEvictedSlotCount: 0,
      diagnosticsCount: 0,
      diagnostics: [],
      slotKeys: [],
      tiles: [],
    }
  );
}

function createGpuCookieAtlasUpdateStatus(
  loop,
  enabled,
  localLightCookies,
  readbackStatus,
  frame,
) {
  if (enabled !== true) {
    return {
      enabled: false,
      ready: true,
      textureLayout: null,
      updateMode: null,
      observedGpuBlit: false,
      observedChangedTileGpuBlit: false,
      maxGpuBlitTileCount: 0,
      maxCpuUploadTileCount: 0,
      baselineLuminance: null,
      updatedLuminance: null,
      sampleLuminanceDelta: 0,
    };
  }

  const previous = loop.gpuCookieAtlasUpdateStatus ?? null;
  const atlasUpdate = localLightCookies?.atlasUpdate ?? null;
  const averageLuminance = averageReadbackLuminance(readbackStatus, [
    "right-cookie-second-upper",
    "right-cookie-second-lower",
    "right-cookie-upper",
    "right-cookie-lower",
  ]);
  const baselineLuminance =
    previous?.baselineLuminance ?? (frame < 5 ? averageLuminance : null);
  const updatedLuminance =
    frame >= 5 && averageLuminance !== null
      ? averageLuminance
      : (previous?.updatedLuminance ?? null);
  const sampleLuminanceDelta =
    baselineLuminance === null || updatedLuminance === null
      ? 0
      : Math.abs(updatedLuminance - baselineLuminance);
  const observedGpuBlit =
    previous?.observedGpuBlit === true ||
    atlasUpdate?.updateMode === "gpu-blit";
  const observedChangedTileGpuBlit =
    previous?.observedChangedTileGpuBlit === true ||
    (frame >= 5 &&
      atlasUpdate?.updateMode === "gpu-blit" &&
      (atlasUpdate.gpuBlitTileCount ?? 0) >= 1 &&
      (atlasUpdate.cpuUploadTileCount ?? 0) === 0);
  const maxGpuBlitTileCount = Math.max(
    previous?.maxGpuBlitTileCount ?? 0,
    atlasUpdate?.gpuBlitTileCount ?? 0,
  );
  const maxCpuUploadTileCount = Math.max(
    previous?.maxCpuUploadTileCount ?? 0,
    atlasUpdate?.cpuUploadTileCount ?? 0,
  );
  const status = {
    enabled: true,
    ready:
      localLightCookies?.textureLayout === "atlas" &&
      observedGpuBlit &&
      observedChangedTileGpuBlit &&
      maxGpuBlitTileCount >= 1 &&
      maxCpuUploadTileCount === 0,
    textureLayout: localLightCookies?.textureLayout ?? null,
    textureViewDimension: localLightCookies?.textureViewDimension ?? null,
    supportedLightCount: localLightCookies?.supportedLightCount ?? 0,
    textureKey: localLightCookies?.textureKey ?? null,
    updateMode: atlasUpdate?.updateMode ?? null,
    atlasWidth: atlasUpdate?.atlasWidth ?? 0,
    atlasHeight: atlasUpdate?.atlasHeight ?? 0,
    requestedTileCount: atlasUpdate?.requestedTileCount ?? 0,
    updatedTileCount: atlasUpdate?.updatedTileCount ?? 0,
    gpuBlitTileCount: atlasUpdate?.gpuBlitTileCount ?? 0,
    cpuUploadTileCount: atlasUpdate?.cpuUploadTileCount ?? 0,
    cachedTileCount: atlasUpdate?.cachedTileCount ?? 0,
    observedGpuBlit,
    observedChangedTileGpuBlit,
    maxGpuBlitTileCount,
    maxCpuUploadTileCount,
    baselineLuminance,
    updatedLuminance,
    sampleLuminanceDelta,
  };

  loop.gpuCookieAtlasUpdateStatus = status;

  return status;
}

function createClusterBufferCacheStatus(
  loop,
  enabled,
  resourceReuse,
  frame,
  pressureHistoryEnabled,
) {
  if (enabled !== true) {
    return {
      enabled: false,
      ready: true,
      observedClusterInvalidation: false,
      observedBufferWrites: false,
      observedSkippedWrites: false,
      latestWrites: 0,
      latestSkippedWrites: 0,
      maxWrites: 0,
      maxSkippedWrites: 0,
    };
  }

  const previous = loop.clusterBufferCacheStatus ?? null;
  const latestWrites = resourceReuse?.localLightClusterBufferWrites ?? 0;
  const latestSkippedWrites =
    resourceReuse?.localLightClusterBufferWritesSkipped ?? 0;
  const observedClusterInvalidation =
    previous?.observedClusterInvalidation === true || frame >= 3;
  const observedBufferWrites =
    previous?.observedBufferWrites === true || latestWrites >= 4;
  const observedSkippedWrites =
    previous?.observedSkippedWrites === true || latestSkippedWrites >= 4;
  const maxWrites = Math.max(previous?.maxWrites ?? 0, latestWrites);
  const maxSkippedWrites = Math.max(
    previous?.maxSkippedWrites ?? 0,
    latestSkippedWrites,
  );
  const stablePressureHistoryReady =
    pressureHistoryEnabled === true &&
    observedClusterInvalidation &&
    observedSkippedWrites &&
    latestWrites === 0 &&
    latestSkippedWrites >= 4;
  const status = {
    enabled: true,
    ready:
      stablePressureHistoryReady ||
      (observedClusterInvalidation &&
        observedBufferWrites &&
        observedSkippedWrites &&
        latestWrites === 0 &&
        latestSkippedWrites >= 4),
    frame,
    baselineMode:
      pressureHistoryEnabled === true ? "stable-cache-hit" : "invalidation",
    observedClusterInvalidation,
    observedBufferWrites,
    observedSkippedWrites,
    latestWrites,
    latestSkippedWrites,
    maxWrites,
    maxSkippedWrites,
    localLightClusterBuffersReused:
      resourceReuse?.localLightClusterBuffersReused ?? 0,
    dynamicBufferWrites: resourceReuse?.dynamicBufferWrites ?? 0,
  };

  loop.clusterBufferCacheStatus = status;

  return status;
}

function averageReadbackLuminance(readbackStatus, sampleIds) {
  if (readbackStatus?.ok !== true || !Array.isArray(readbackStatus.samples)) {
    return null;
  }

  const samples = new Map(
    readbackStatus.samples.map((sample) => [sample.id, sample]),
  );
  let total = 0;
  let count = 0;

  for (const sampleId of sampleIds) {
    const sample = samples.get(sampleId);

    if (sample?.pixel === undefined) {
      continue;
    }

    total += luminance(sample.pixel);
    count += 1;
  }

  return count === 0 ? null : total / count;
}

function clusterRoutesFromReport(localLightClusters) {
  if (localLightClusters === null || localLightClusters === undefined) {
    return [];
  }

  if (
    Array.isArray(localLightClusters.routes) &&
    localLightClusters.routes.length > 0
  ) {
    return localLightClusters.routes;
  }

  return [localLightClusters];
}

function createShadowSoftnessReadbackStatus(
  readbackStatus,
  shadowStatus,
  shadowSoftnessEnabled,
) {
  if (shadowSoftnessEnabled !== true) {
    return { enabled: false, ok: true };
  }

  const samples = new Map(
    (readbackStatus?.samples ?? []).map((sample) => [sample.id, sample]),
  );
  const hardProbe = samples.get("right-cookie-upper") ?? null;
  const softProbe = samples.get("right-cookie-lower") ?? null;
  const hardLuminance = hardProbe === null ? null : luminance(hardProbe.pixel);
  const softLuminance = softProbe === null ? null : luminance(softProbe.pixel);
  const sampleLuminanceDelta =
    hardLuminance === null || softLuminance === null
      ? 0
      : Math.abs(hardLuminance - softLuminance);
  const spotFilterRadii = Array.isArray(shadowStatus?.spot?.filterRadiusTexels)
    ? shadowStatus.spot.filterRadiusTexels
    : [];

  return {
    enabled: true,
    ok:
      readbackStatus?.ok === true &&
      hardProbe !== null &&
      softProbe !== null &&
      sampleLuminanceDelta > 12 &&
      spotFilterRadii.some((radius) => radius <= 0) &&
      spotFilterRadii.some((radius) => radius >= 2),
    hardProbe: hardProbe?.id ?? null,
    softProbe: softProbe?.id ?? null,
    hardProbePixel: hardProbe?.pixel ?? null,
    softProbePixel: softProbe?.pixel ?? null,
    hardProbeLuminance: hardLuminance,
    softProbeLuminance: softLuminance,
    sampleLuminanceDelta,
    pointFilterRadiusTexels: shadowStatus?.point?.filterRadiusTexels ?? null,
    spotFilterRadiusTexels: spotFilterRadii,
  };
}

function createReadbackStatus(readback) {
  if (readback?.ok !== true || !Array.isArray(readback.samples)) {
    return { ok: false, reason: "readback-unavailable" };
  }

  const clearPixel = {
    r: Math.round((clearColor[0] ?? 0) * 255),
    g: Math.round((clearColor[1] ?? 0) * 255),
    b: Math.round((clearColor[2] ?? 0) * 255),
    a: Math.round((clearColor[3] ?? 1) * 255),
  };
  const allTransparentZero = readback.samples.every(
    (sample) =>
      sample.pixel.r === 0 &&
      sample.pixel.g === 0 &&
      sample.pixel.b === 0 &&
      sample.pixel.a === 0,
  );

  if (allTransparentZero) {
    return {
      ok: false,
      reason: "transparent-zero-readback",
      samples: readback.samples.map((sample) => ({
        id: sample.id,
        pixel: sample.pixel,
      })),
    };
  }

  const distances = readback.samples.map((sample) =>
    pixelDistance(sample.pixel, clearPixel),
  );
  const maxClearDistance = Math.max(...distances, 0);
  const sampleLuminance = readback.samples.map((sample) =>
    luminance(sample.pixel),
  );

  return {
    ok: maxClearDistance > 24,
    maxClearDistance,
    luminanceRange: Math.max(...sampleLuminance) - Math.min(...sampleLuminance),
    samples: readback.samples.map((sample) => ({
      id: sample.id,
      pixel: sample.pixel,
    })),
  };
}

async function createClusteredPointShadowReceiverResources(
  aperture,
  app,
  scene,
  loop,
  report,
) {
  const receiverLayerMask =
    scene.clusteredShadowCookieEnabled === true
      ? clusteredSpotShadowIntent.receiverLayerMask
      : clusteredPointShadowIntent.receiverLayerMask;
  const requests = report.snapshot.shadowRequests.filter(
    (candidate) =>
      candidate.lightKind === "point" &&
      (candidate.receiverLayerMask & receiverLayerMask) !== 0,
  );
  const requiredPointShadowCount =
    scene.clusteredMultiPointShadowEnabled === true ? 2 : 1;
  const shadowRequests = requests.slice(0, requiredPointShadowCount);

  if (shadowRequests.length < requiredPointShadowCount) {
    return {
      standardMaterialShadowReceiverResources: null,
      shadowStatus: {
        enabled: true,
        supported: false,
        reason: "point-shadow-request-unavailable",
        requiredPointShadowCount,
        requestCount: requests.length,
      },
    };
  }

  const pointArrayEnabled = requiredPointShadowCount > 1;
  const pointResourceKey = pointArrayEnabled
    ? "shadow-map:clustered-point-array"
    : undefined;
  const pointLayerCount = shadowRequests.length * 6;
  const shadowDescriptor = aperture.createShadowMapDescriptorReport({
    shadowRequests,
    descriptors: shadowRequests.map((request, index) => ({
      shadowId: request.shadowId,
      lightId: request.lightId,
      mapSize: clusteredPointShadowIntent.mapSize,
      depthBias: clusteredPointShadowIntent.depthBias,
      normalBias: clusteredPointShadowIntent.normalBias,
      filterRadiusTexels: clusteredPointShadowFilterRadiusTexels(scene),
      faceCount: 6,
      viewDimension: pointArrayEnabled ? "2d-array" : "cube",
      ...(pointResourceKey === undefined
        ? {}
        : {
            resourceKey: pointResourceKey,
            layerCount: pointLayerCount,
            layerBaseIndex: index * 6,
          }),
    })),
  });
  const shadowTextures = aperture.createShadowTextureResourceReport({
    descriptors: shadowDescriptor,
  });

  const pointShadowDepthTextureResourceReport =
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
      cache: loop.pointShadowDepthTextureResourceCache,
    });

  if (scene.clusteredShadowCacheEnabled === true) {
    loop.pointShadowDepthTextureResourceReport =
      pointShadowDepthTextureResourceReport;
  } else {
    loop.pointShadowDepthTextureResourceReport ??=
      pointShadowDepthTextureResourceReport;
  }

  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:clustered-point",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowPassPlan = aperture.createShadowPassPlanReport({
    shadowRequests,
    textures: shadowTextures,
    submission: "ready",
  });
  const shadowPassAttachments =
    aperture.createShadowPassAttachmentDescriptorReport({
      shadowPassPlan,
      depthTextureResources: loop.pointShadowDepthTextureResourceReport,
    });
  const shadowViewProjection =
    aperture.createPointShadowViewProjectionPlanReport({
      shadowRequests,
      lights: report.snapshot.lights,
      shadowPassPlan,
      computation: "ready",
    });
  const shadowMatrixComputation =
    aperture.createPointShadowMatrixComputationReport({
      viewProjection: shadowViewProjection,
      transforms: report.snapshot.transforms,
    });
  const shadowCasterMeshDraws = report.snapshot.meshDraws.filter(
    (draw) =>
      draw.sortKey.meshKey === scene.casterMeshKey &&
      draw.castsShadow !== false,
  );
  const shadowCasterDrawList = aperture.createShadowCasterDrawListPlanReport({
    shadowRequests,
    meshDraws: shadowCasterMeshDraws,
    shadowPassPlan,
    commandEncoding: "ready",
  });
  const shadowRenderCacheKey = createClusteredShadowRenderCacheKey({
    shadowRequests,
    shadowTextures,
    shadowMatrixComputation,
    shadowCasterDrawList,
    shadowCasterMeshDraws,
    transforms: report.snapshot.transforms,
    atlasTiles: [],
  });
  const cachedPointShadow =
    scene.clusteredShadowCacheEnabled === true &&
    loop.pointShadowRenderCache?.cacheKey === shadowRenderCacheKey
      ? loop.pointShadowRenderCache
      : null;

  if (
    cachedPointShadow !== null &&
    cachedPointShadow.standardMaterialShadowReceiverResources !== null &&
    shadowSamplerResourceReport.resource !== null &&
    loop.pointShadowDepthTextureResourceReport.ready === true
  ) {
    const standardMaterialShadowReceiverResources = {
      ...cachedPointShadow.standardMaterialShadowReceiverResources,
      depthTextureResources: loop.pointShadowDepthTextureResourceReport,
      samplerResource: shadowSamplerResourceReport,
    };
    const cacheStatus = recordClusteredShadowCacheStatus(loop, "point", {
      action: "hit",
      frame: report.snapshot.frame,
      cacheKey: shadowRenderCacheKey,
      shadowCount: shadowRequests.length,
      depthTextureResources: loop.pointShadowDepthTextureResourceReport,
      submission: "cached",
      submittedCommandBuffers: 0,
      skippedCommandBuffers: shadowPassPlan.passCount,
    });

    return {
      standardMaterialShadowReceiverResources,
      shadowStatus: {
        enabled: true,
        supported: true,
        mode: pointArrayEnabled
          ? "clustered-point-depth-2d-array-compare"
          : "clustered-point-depth-cube-compare",
        shadowId: shadowRequests[0]?.shadowId ?? null,
        lightId: shadowRequests[0]?.lightId ?? null,
        shadowIds: shadowRequests.map((request) => request.shadowId),
        lightIds: shadowRequests.map((request) => request.lightId),
        requiredPointShadowCount,
        supportedLightCount: shadowRequests.length,
        filterRadiusTexels: clusteredPointShadowFilterRadiusTexels(scene),
        layerCount: pointArrayEnabled ? pointLayerCount : 6,
        casterDraws: shadowCasterMeshDraws.length,
        faceCount: shadowPassPlan.passCount,
        submission: "cached",
        cache: cacheStatus,
      },
    };
  }

  const shadowMatrixBuffer = aperture.createShadowMatrixBufferDescriptorReport({
    viewProjection: shadowViewProjection,
    upload: "ready",
    resourceKey: pointArrayEnabled
      ? "shadow-matrix-buffer:clustered-point-array"
      : "shadow-matrix-buffer:clustered-point",
    label: "ClusteredPointShadowMatrices/storage",
  });
  const shadowMatrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: shadowMatrixBuffer,
      matrices: shadowMatrixComputation,
    });
  const shadowCommandPlan =
    aperture.createShadowCasterCommandPlanReadinessReport({
      shadowPassPlan,
      viewProjection: shadowViewProjection,
      matrixBuffer: shadowMatrixBuffer,
      casterDrawList: shadowCasterDrawList,
      commandEncoding: "ready",
    });
  const shadowPassCommandEncoding =
    aperture.createShadowPassCommandEncodingReport({
      shadowPassPlan,
      depthTextureResources: loop.pointShadowDepthTextureResourceReport,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      casterDrawList: shadowCasterDrawList,
      commandPlan: shadowCommandPlan,
      commandEncoding: "ready",
    });
  const shadowCasterPipelineDescriptor =
    aperture.createShadowCasterPipelineDescriptorReport({
      commandEncoding: shadowPassCommandEncoding,
    });
  const shadowCasterPipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: shadowCasterPipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const shadowCasterMatrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      layout:
        shadowCasterPipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const shadowCasterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const shadowCasterFrameResources =
    aperture.createShadowCasterFrameResourceReadinessReport({
      casterDrawList: shadowCasterDrawList,
      preparedMeshes: shadowCasterMeshViews.preparedMeshes,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      pipelineDescriptor: shadowCasterPipelineDescriptor,
    });
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources:
        aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
          shadowCasterFrameResources,
        ),
      commandPlan:
        aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
          shadowCommandPlan,
        ),
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
      meshes: shadowCasterMeshViews.executableMeshes,
    });
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: pointArrayEnabled
        ? "shadow-pass:clustered-point-array"
        : "shadow-pass:clustered-point",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: aperture.shadowPassAttachmentDescriptorReportToJsonValue(
        shadowPassAttachments,
      ),
      frameResources:
        aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
          shadowCasterFrameResources,
        ),
      commandEncoding: aperture.shadowPassCommandEncodingReportToJsonValue(
        shadowPassCommandEncoding,
      ),
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        aperture.resolveShadowDepthTextureAttachmentView(
          loop.pointShadowDepthTextureResourceReport,
          attachment,
        ),
    });
  const shadowPassCommandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: shadowPassEncoderAssemblyReport,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: pointArrayEnabled
        ? "shadow-pass:clustered-point-array"
        : "shadow-pass:clustered-point",
      submit: true,
    });
  const supported =
    shadowPassCommandBufferSubmissionReport.status === "submitted" &&
    shadowMatrixBufferResourceReport.resource !== null &&
    shadowRequests.every((request, index) =>
      loop.pointShadowDepthTextureResourceReport.resources.some(
        (resource) =>
          resource.shadowId === request.shadowId &&
          resource.lightId === request.lightId &&
          resource.viewDimension ===
            (pointArrayEnabled ? "2d-array" : "cube") &&
          resource.allocation.resource !== null &&
          (!pointArrayEnabled ||
            ((resource.layerCount ?? 0) >= pointLayerCount &&
              resource.layerBaseIndex === index * 6)),
      ),
    ) &&
    shadowSamplerResourceReport.resource !== null;
  const standardMaterialShadowReceiverResources = supported
    ? {
        shadowKind: pointArrayEnabled ? "point-array" : "point",
        matrixBufferResource: shadowMatrixBufferResourceReport,
        depthTextureResources: loop.pointShadowDepthTextureResourceReport,
        samplerResource: shadowSamplerResourceReport,
      }
    : null;
  const cacheStatus =
    scene.clusteredShadowCacheEnabled === true
      ? recordClusteredShadowCacheStatus(loop, "point", {
          action: "miss",
          frame: report.snapshot.frame,
          cacheKey: shadowRenderCacheKey,
          shadowCount: shadowRequests.length,
          depthTextureResources: loop.pointShadowDepthTextureResourceReport,
          submission: shadowPassCommandBufferSubmissionReport.status,
          submittedCommandBuffers:
            shadowPassCommandBufferSubmissionReport.counts
              .submittedCommandBuffers,
          skippedCommandBuffers:
            shadowPassCommandBufferSubmissionReport.counts.skippedSubmissions,
        })
      : null;

  if (
    scene.clusteredShadowCacheEnabled === true &&
    supported &&
    standardMaterialShadowReceiverResources !== null
  ) {
    loop.pointShadowRenderCache = {
      cacheKey: shadowRenderCacheKey,
      standardMaterialShadowReceiverResources,
    };
  }

  return {
    standardMaterialShadowReceiverResources,
    shadowStatus: {
      enabled: true,
      supported,
      mode: pointArrayEnabled
        ? "clustered-point-depth-2d-array-compare"
        : "clustered-point-depth-cube-compare",
      shadowId: shadowRequests[0]?.shadowId ?? null,
      lightId: shadowRequests[0]?.lightId ?? null,
      shadowIds: shadowRequests.map((request) => request.shadowId),
      lightIds: shadowRequests.map((request) => request.lightId),
      requiredPointShadowCount,
      supportedLightCount: supported ? shadowRequests.length : 0,
      filterRadiusTexels: clusteredPointShadowFilterRadiusTexels(scene),
      layerCount: pointArrayEnabled ? pointLayerCount : 6,
      casterDraws: shadowCasterMeshDraws.length,
      faceCount: shadowPassPlan.passCount,
      submission: shadowPassCommandBufferSubmissionReport.status,
      ...(cacheStatus === null ? {} : { cache: cacheStatus }),
    },
  };
}

async function createClusteredShadowReceiverResources(
  aperture,
  app,
  scene,
  loop,
  report,
  frame,
) {
  const pointResult = scene.clusteredPointShadowEnabled
    ? await createClusteredPointShadowReceiverResources(
        aperture,
        app,
        scene,
        loop,
        report,
      )
    : {
        standardMaterialShadowReceiverResources: null,
        shadowStatus: {
          enabled: false,
          supported: false,
          reason: "disabled",
        },
      };
  const spotResult = scene.clusteredSpotShadowEnabled
    ? await createClusteredSpotShadowReceiverResources(
        aperture,
        app,
        scene,
        loop,
        report,
        frame,
      )
    : {
        standardMaterialShadowReceiverResources: null,
        shadowStatus: {
          enabled: false,
          supported: false,
          reason: "disabled",
        },
      };
  const pointResources = pointResult.standardMaterialShadowReceiverResources;
  const spotResources = spotResult.standardMaterialShadowReceiverResources;
  const combinedShadowKind =
    pointResources?.shadowKind === "point-array" &&
    spotResources?.shadowKind === "spot-array"
      ? "multi-spot-array-point-array"
      : pointResources?.shadowKind === "point-array"
        ? "multi-point-array"
        : spotResources?.shadowKind === "spot-array"
          ? "multi-spot-array"
          : "multi";
  const standardMaterialShadowReceiverResources =
    pointResources !== null && spotResources !== null
      ? {
          ...spotResources,
          shadowKind: combinedShadowKind,
          spotShadowReceiverResources: spotResources,
          pointShadowReceiverResources: pointResources,
        }
      : (spotResources ?? pointResources);
  const mixedMode =
    pointResources !== null && spotResources !== null
      ? pointResult.shadowStatus.mode ===
        "clustered-point-depth-2d-array-compare"
        ? spotResult.shadowStatus.mode === "clustered-spot-array-depth-compare"
          ? "clustered-point-array-spot-array-depth-compare"
          : spotResult.shadowStatus.mode ===
              "clustered-spot-atlas-depth-compare"
            ? "clustered-point-array-spot-atlas-depth-compare"
            : "clustered-point-array-spot-depth-compare"
        : spotResult.shadowStatus.mode === "clustered-spot-array-depth-compare"
          ? "clustered-point-spot-array-depth-compare"
          : spotResult.shadowStatus.mode ===
              "clustered-spot-atlas-depth-compare"
            ? "clustered-point-spot-atlas-depth-compare"
            : "clustered-point-spot-depth-compare"
      : null;

  return {
    standardMaterialShadowReceiverResources,
    shadowStatus: {
      enabled:
        scene.clusteredPointShadowEnabled || scene.clusteredSpotShadowEnabled,
      supported:
        (scene.clusteredPointShadowEnabled ||
          scene.clusteredSpotShadowEnabled) &&
        (scene.clusteredPointShadowEnabled !== true ||
          pointResult.shadowStatus.supported === true) &&
        (scene.clusteredSpotShadowEnabled !== true ||
          spotResult.shadowStatus.supported === true),
      mode:
        pointResources !== null && spotResources !== null
          ? mixedMode
          : spotResources !== null
            ? spotResult.shadowStatus.mode
            : pointResources !== null
              ? pointResult.shadowStatus.mode
              : "clustered-shadow-unavailable",
      point: pointResult.shadowStatus,
      spot: spotResult.shadowStatus,
    },
  };
}

async function createClusteredSpotShadowReceiverResources(
  aperture,
  app,
  scene,
  loop,
  report,
  frame,
) {
  const requests = report.snapshot.shadowRequests.filter(
    (candidate) =>
      candidate.lightKind === "spot" &&
      (candidate.receiverLayerMask &
        clusteredSpotShadowIntent.receiverLayerMask) !==
        0,
  );
  const requiredSpotShadowCount = requiredClusteredSpotShadowCount(scene);
  const requiredShadowRequests = requests.slice(0, requiredSpotShadowCount);
  const shadowRequests =
    scene.clusteredDynamicShadowCookieAtlasEnabled === true
      ? selectDynamicClusteredSpotShadowRequests(requiredShadowRequests, frame)
      : requiredShadowRequests;

  if (requests.length < requiredSpotShadowCount) {
    return {
      standardMaterialShadowReceiverResources: null,
      shadowStatus: {
        enabled: true,
        supported: false,
        reason: "spot-shadow-request-unavailable",
        requiredSpotShadowCount,
        requestCount: requests.length,
      },
    };
  }

  const spotAtlasEnabled =
    scene.clusteredSpotShadowAtlasEnabled === true &&
    requiredSpotShadowCount > 1;
  const spotArrayEnabled = requiredSpotShadowCount > 1 && !spotAtlasEnabled;
  const atlasTiles =
    spotAtlasEnabled && scene.clusteredDynamicShadowCookieAtlasEnabled === true
      ? createDynamicClusteredSpotShadowAtlasTiles(
          aperture,
          loop,
          shadowRequests,
          requiredShadowRequests,
          frame,
        )
      : spotAtlasEnabled
        ? createClusteredSpotShadowAtlasTiles(shadowRequests)
        : [];
  const spotResourceKey = spotAtlasEnabled
    ? "shadow-map:clustered-spot-atlas"
    : spotArrayEnabled
      ? "shadow-map:clustered-spot-array"
      : undefined;
  const shadowDescriptor = aperture.createShadowMapDescriptorReport({
    shadowRequests,
    descriptors: shadowRequests.map((request, index) => ({
      shadowId: request.shadowId,
      lightId: request.lightId,
      mapSize: atlasTiles[index]?.mapSize ?? clusteredSpotShadowIntent.mapSize,
      depthBias: clusteredSpotShadowIntent.depthBias,
      normalBias: clusteredSpotShadowIntent.normalBias,
      filterRadiusTexels: clusteredSpotShadowFilterRadiusTexels(scene, index),
      faceCount: 1,
      viewDimension: spotArrayEnabled ? "2d-array" : "2d",
      ...(spotResourceKey === undefined
        ? {}
        : { resourceKey: spotResourceKey }),
      ...(spotAtlasEnabled
        ? {
            textureWidth: atlasTiles[0]?.atlasWidth,
            textureHeight: atlasTiles[0]?.atlasHeight,
            atlasRegion: {
              originX: atlasTiles[index]?.x ?? 0,
              originY: atlasTiles[index]?.y ?? 0,
              width:
                atlasTiles[index]?.mapSize ?? clusteredSpotShadowIntent.mapSize,
              height:
                atlasTiles[index]?.mapSize ?? clusteredSpotShadowIntent.mapSize,
            },
          }
        : {}),
      ...(spotArrayEnabled
        ? {
            layerCount: shadowRequests.length,
            layerBaseIndex: index,
          }
        : {}),
    })),
  });
  const shadowTextures = aperture.createShadowTextureResourceReport({
    descriptors: shadowDescriptor,
  });

  const spotShadowDepthTextureResourceReport =
    aperture.createShadowDepthTextureResourceReport({
      device: app.initialization.device,
      textures: shadowTextures,
      cache: loop.spotShadowDepthTextureResourceCache,
    });

  if (scene.clusteredDynamicShadowCookieAtlasEnabled === true) {
    loop.spotShadowDepthTextureResourceReport =
      spotShadowDepthTextureResourceReport;
  } else {
    loop.spotShadowDepthTextureResourceReport ??=
      spotShadowDepthTextureResourceReport;
  }

  const appEnvironmentResourceCache =
    aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const shadowSamplerResourceReport =
    aperture.createShadowSamplerResourceReport({
      device: app.initialization.device,
      resourceKey: "shadow-sampler:clustered-spot",
      cache: appEnvironmentResourceCache.shadowSamplers,
    });
  const shadowPassPlan = aperture.createShadowPassPlanReport({
    shadowRequests,
    textures: shadowTextures,
    submission: "ready",
  });
  const shadowPassAttachments =
    aperture.createShadowPassAttachmentDescriptorReport({
      shadowPassPlan,
      depthTextureResources: loop.spotShadowDepthTextureResourceReport,
    });
  const shadowViewProjection =
    aperture.createSpotShadowViewProjectionPlanReport({
      shadowRequests,
      lights: report.snapshot.lights,
      shadowPassPlan,
      computation: "ready",
    });
  const shadowMatrixComputation =
    aperture.createSpotShadowMatrixComputationReport({
      viewProjection: shadowViewProjection,
      transforms: report.snapshot.transforms,
    });
  const shadowMatrixComputationForUpload = spotAtlasEnabled
    ? createAtlasAdjustedSpotShadowMatrixComputation(
        shadowMatrixComputation,
        atlasTiles,
      )
    : shadowMatrixComputation;
  const shadowCasterMeshDraws = report.snapshot.meshDraws.filter(
    (draw) =>
      draw.sortKey.meshKey === scene.spotCasterMeshKey &&
      draw.castsShadow !== false,
  );
  const shadowCasterDrawList = aperture.createShadowCasterDrawListPlanReport({
    shadowRequests,
    meshDraws: shadowCasterMeshDraws,
    shadowPassPlan,
    commandEncoding: "ready",
  });
  const shadowRenderCacheKey = createClusteredShadowRenderCacheKey({
    shadowRequests,
    shadowTextures,
    shadowMatrixComputation: shadowMatrixComputationForUpload,
    shadowCasterDrawList,
    shadowCasterMeshDraws,
    transforms: report.snapshot.transforms,
    atlasTiles,
  });
  const cachedSpotShadow =
    scene.clusteredShadowCacheEnabled === true &&
    loop.spotShadowRenderCache?.cacheKey === shadowRenderCacheKey
      ? loop.spotShadowRenderCache
      : null;

  if (
    cachedSpotShadow !== null &&
    cachedSpotShadow.standardMaterialShadowReceiverResources !== null &&
    shadowSamplerResourceReport.resource !== null &&
    loop.spotShadowDepthTextureResourceReport.ready === true
  ) {
    const atlasWidth = atlasTiles[0]?.atlasWidth ?? 0;
    const atlasHeight = atlasTiles[0]?.atlasHeight ?? 0;
    const standardMaterialShadowReceiverResources = {
      ...cachedSpotShadow.standardMaterialShadowReceiverResources,
      depthTextureResources: loop.spotShadowDepthTextureResourceReport,
      samplerResource: shadowSamplerResourceReport,
    };
    const cacheStatus = recordClusteredShadowCacheStatus(loop, "spot", {
      action: "hit",
      frame,
      cacheKey: shadowRenderCacheKey,
      shadowCount: shadowRequests.length,
      depthTextureResources: loop.spotShadowDepthTextureResourceReport,
      submission: "cached",
      submittedCommandBuffers: 0,
      skippedCommandBuffers: shadowPassPlan.passCount,
    });

    return {
      standardMaterialShadowReceiverResources,
      shadowStatus: {
        enabled: true,
        supported: true,
        mode: spotAtlasEnabled
          ? "clustered-spot-atlas-depth-compare"
          : spotArrayEnabled
            ? "clustered-spot-array-depth-compare"
            : "clustered-spot-depth-compare",
        shadowId: shadowRequests[0]?.shadowId ?? null,
        lightId: shadowRequests[0]?.lightId ?? null,
        shadowIds: shadowRequests.map((request) => request.shadowId),
        lightIds: shadowRequests.map((request) => request.lightId),
        requiredSpotShadowCount,
        supportedLightCount: shadowRequests.length,
        filterRadiusTexels: shadowRequests.map((_request, index) =>
          clusteredSpotShadowFilterRadiusTexels(scene, index),
        ),
        layerCount: spotArrayEnabled ? shadowRequests.length : 1,
        ...(spotAtlasEnabled
          ? {
              atlasWidth,
              atlasHeight,
              atlasTiles: atlasTiles.map((tile) => ({
                shadowId: tile.shadowId,
                lightId: tile.lightId,
                x: tile.x,
                y: tile.y,
                width: tile.mapSize,
                height: tile.height ?? tile.mapSize,
                allocationKey: tile.allocationKey ?? null,
                reused: tile.reused === true,
              })),
            }
          : {}),
        casterDraws: shadowCasterMeshDraws.length,
        faceCount: shadowPassPlan.passCount,
        submission: "cached",
        cache: cacheStatus,
      },
    };
  }

  const shadowMatrixBuffer = aperture.createShadowMatrixBufferDescriptorReport({
    viewProjection: shadowViewProjection,
    upload: "ready",
    resourceKey: spotAtlasEnabled
      ? "shadow-matrix-buffer:clustered-spot-atlas"
      : spotArrayEnabled
        ? "shadow-matrix-buffer:clustered-spot-array"
        : "shadow-matrix-buffer:clustered-spot",
    label: "ClusteredSpotShadowMatrices/storage",
  });
  const shadowMatrixBufferResourceReport =
    aperture.createShadowMatrixBufferResourceReport({
      device: app.initialization.device,
      descriptor: shadowMatrixBuffer,
      matrices: shadowMatrixComputationForUpload,
    });
  const shadowCommandPlan =
    aperture.createShadowCasterCommandPlanReadinessReport({
      shadowPassPlan,
      viewProjection: shadowViewProjection,
      matrixBuffer: shadowMatrixBuffer,
      casterDrawList: shadowCasterDrawList,
      commandEncoding: "ready",
    });
  const shadowPassCommandEncoding =
    aperture.createShadowPassCommandEncodingReport({
      shadowPassPlan,
      depthTextureResources: loop.spotShadowDepthTextureResourceReport,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      casterDrawList: shadowCasterDrawList,
      commandPlan: shadowCommandPlan,
      commandEncoding: "ready",
    });
  const shadowCasterPipelineDescriptor =
    aperture.createShadowCasterPipelineDescriptorReport({
      commandEncoding: shadowPassCommandEncoding,
    });
  const shadowCasterPipelineResourceReport =
    aperture.createShadowCasterPipelineResourceReport({
      device: app.initialization.device,
      descriptor: shadowCasterPipelineDescriptor,
      cache: appEnvironmentResourceCache.shadowCasterPipelines,
    });
  const shadowCasterMatrixBindGroupResourceReport =
    aperture.createShadowCasterMatrixBindGroupResourceReport({
      device: app.initialization.device,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      layout:
        shadowCasterPipelineResourceReport.resource?.matrixBindGroupLayout,
      cache: appEnvironmentResourceCache.shadowCasterMatrixBindGroups,
    });
  const shadowCasterMeshViews =
    aperture.createShadowCasterMeshViewsFromAppReport(report);
  const shadowCasterFrameResources =
    aperture.createShadowCasterFrameResourceReadinessReport({
      casterDrawList: shadowCasterDrawList,
      preparedMeshes: shadowCasterMeshViews.preparedMeshes,
      matrixBufferResource: shadowMatrixBufferResourceReport,
      pipelineDescriptor: shadowCasterPipelineDescriptor,
    });
  const shadowCasterCommandRecordPlan =
    aperture.createShadowCasterCommandRecordPlanReport({
      frameResources:
        aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
          shadowCasterFrameResources,
        ),
      commandPlan:
        aperture.shadowCasterCommandPlanReadinessReportToJsonValue(
          shadowCommandPlan,
        ),
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
      meshes: shadowCasterMeshViews.executableMeshes,
    });
  const shadowPassCommandEncoderResource =
    aperture.createCommandEncoderResource({
      device: app.initialization.device,
      label: spotAtlasEnabled
        ? "shadow-pass:clustered-spot-atlas"
        : spotArrayEnabled
          ? "shadow-pass:clustered-spot-array"
          : "shadow-pass:clustered-spot",
    });
  const shadowPassEncoderAssemblyReport =
    aperture.createShadowPassEncoderAssemblyReport({
      attachments: aperture.shadowPassAttachmentDescriptorReportToJsonValue(
        shadowPassAttachments,
      ),
      frameResources:
        aperture.shadowCasterFrameResourceReadinessReportToJsonValue(
          shadowCasterFrameResources,
        ),
      commandEncoding: aperture.shadowPassCommandEncodingReportToJsonValue(
        shadowPassCommandEncoding,
      ),
      commands: shadowCasterCommandRecordPlan.commandRecords,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      resolveDepthView: (attachment) =>
        aperture.resolveShadowDepthTextureAttachmentView(
          loop.spotShadowDepthTextureResourceReport,
          attachment,
        ),
    });
  const shadowPassCommandBufferSubmissionReport =
    aperture.createShadowPassCommandBufferSubmissionReport({
      assembly: shadowPassEncoderAssemblyReport,
      encoder: shadowPassCommandEncoderResource.resource?.encoder,
      queue: app.initialization.device.queue,
      label: spotArrayEnabled
        ? "shadow-pass:clustered-spot-array"
        : spotAtlasEnabled
          ? "shadow-pass:clustered-spot-atlas"
          : "shadow-pass:clustered-spot",
      submit: true,
    });
  const atlasWidth = atlasTiles[0]?.atlasWidth ?? 0;
  const atlasHeight = atlasTiles[0]?.atlasHeight ?? 0;
  const supported =
    shadowPassCommandBufferSubmissionReport.status === "submitted" &&
    shadowMatrixBufferResourceReport.resource !== null &&
    shadowRequests.every((request, index) =>
      loop.spotShadowDepthTextureResourceReport.resources.some(
        (resource) =>
          resource.shadowId === request.shadowId &&
          resource.lightId === request.lightId &&
          resource.viewDimension === (spotArrayEnabled ? "2d-array" : "2d") &&
          resource.allocation.resource !== null &&
          (!spotArrayEnabled ||
            ((resource.layerCount ?? 0) >= shadowRequests.length &&
              resource.layerBaseIndex === index)) &&
          (!spotAtlasEnabled ||
            (resource.resourceKey === spotResourceKey &&
              (resource.layerCount ?? 1) === 1 &&
              resource.allocation.resource.descriptor.size[0] === atlasWidth &&
              resource.allocation.resource.descriptor.size[1] === atlasHeight)),
      ),
    ) &&
    shadowSamplerResourceReport.resource !== null;
  const standardMaterialShadowReceiverResources = supported
    ? {
        shadowKind: spotArrayEnabled ? "spot-array" : "spot",
        matrixBufferResource: shadowMatrixBufferResourceReport,
        depthTextureResources: loop.spotShadowDepthTextureResourceReport,
        samplerResource: shadowSamplerResourceReport,
      }
    : null;
  const cacheStatus =
    scene.clusteredShadowCacheEnabled === true
      ? recordClusteredShadowCacheStatus(loop, "spot", {
          action: "miss",
          frame,
          cacheKey: shadowRenderCacheKey,
          shadowCount: shadowRequests.length,
          depthTextureResources: loop.spotShadowDepthTextureResourceReport,
          submission: shadowPassCommandBufferSubmissionReport.status,
          submittedCommandBuffers:
            shadowPassCommandBufferSubmissionReport.counts
              .submittedCommandBuffers,
          skippedCommandBuffers:
            shadowPassCommandBufferSubmissionReport.counts.skippedSubmissions,
        })
      : null;

  if (
    scene.clusteredShadowCacheEnabled === true &&
    supported &&
    standardMaterialShadowReceiverResources !== null
  ) {
    loop.spotShadowRenderCache = {
      cacheKey: shadowRenderCacheKey,
      standardMaterialShadowReceiverResources,
    };
  }

  return {
    standardMaterialShadowReceiverResources,
    shadowStatus: {
      enabled: true,
      supported,
      mode: spotAtlasEnabled
        ? "clustered-spot-atlas-depth-compare"
        : spotArrayEnabled
          ? "clustered-spot-array-depth-compare"
          : "clustered-spot-depth-compare",
      shadowId: shadowRequests[0]?.shadowId ?? null,
      lightId: shadowRequests[0]?.lightId ?? null,
      shadowIds: shadowRequests.map((request) => request.shadowId),
      lightIds: shadowRequests.map((request) => request.lightId),
      requiredSpotShadowCount,
      supportedLightCount: supported ? shadowRequests.length : 0,
      filterRadiusTexels: shadowRequests.map((_request, index) =>
        clusteredSpotShadowFilterRadiusTexels(scene, index),
      ),
      layerCount: spotArrayEnabled ? shadowRequests.length : 1,
      ...(spotAtlasEnabled
        ? {
            atlasWidth,
            atlasHeight,
            atlasTiles: atlasTiles.map((tile) => ({
              shadowId: tile.shadowId,
              lightId: tile.lightId,
              x: tile.x,
              y: tile.y,
              width: tile.mapSize,
              height: tile.height ?? tile.mapSize,
              allocationKey: tile.allocationKey ?? null,
              reused: tile.reused === true,
            })),
          }
        : {}),
      casterDraws: shadowCasterMeshDraws.length,
      faceCount: shadowPassPlan.passCount,
      submission: shadowPassCommandBufferSubmissionReport.status,
      ...(cacheStatus === null ? {} : { cache: cacheStatus }),
    },
  };
}

function clusteredPointShadowFilterRadiusTexels(scene) {
  return scene.clusteredShadowSoftnessEnabled ||
    scene.clusteredShadowSoftnessAtlasEnabled
    ? clusteredShadowSoftnessPointFilterRadiusTexels
    : clusteredPointShadowIntent.filterRadiusTexels;
}

function clusteredSpotShadowFilterRadiusTexels(scene, index) {
  if (
    scene.clusteredShadowSoftnessEnabled ||
    scene.clusteredShadowSoftnessAtlasEnabled
  ) {
    return (
      clusteredShadowSoftnessSpotFilterRadiiTexels[index] ??
      clusteredSpotShadowIntent.filterRadiusTexels
    );
  }

  return clusteredSpotShadowIntent.filterRadiusTexels;
}

function requiredClusteredSpotShadowCount(scene) {
  if (scene.clusteredDynamicShadowCookieAtlasEnabled === true) {
    return 4;
  }

  return scene.clusteredMultiSpotShadowEnabled === true ? 2 : 1;
}

function selectDynamicClusteredSpotShadowRequests(shadowRequests, frame) {
  if (frame === 2) {
    return shadowRequests.filter((_request, index) => index !== 2);
  }

  return shadowRequests;
}

function createClusteredShadowRenderCacheKey({
  shadowRequests,
  shadowTextures,
  shadowMatrixComputation,
  shadowCasterDrawList,
  shadowCasterMeshDraws,
  transforms,
  atlasTiles,
}) {
  return JSON.stringify({
    requests: shadowRequests.map((request) => ({
      shadowId: request.shadowId,
      lightId: request.lightId,
      lightKind: request.lightKind ?? null,
      casterLayerMask: request.casterLayerMask,
      receiverLayerMask: request.receiverLayerMask,
      cascadeCount: request.cascadeCount ?? 1,
    })),
    textures: shadowTextures.textures.map((texture) => ({
      shadowId: texture.shadowId,
      lightId: texture.lightId,
      resourceKey: texture.resourceKey,
      textureKey: texture.textureKey,
      viewKey: texture.viewKey,
      width: texture.width,
      height: texture.height,
      depthFormat: texture.depthFormat,
      filterRadiusTexels: texture.filterRadiusTexels ?? null,
      layerCount: texture.layerCount ?? texture.faceCount,
      layerBaseIndex: texture.layerBaseIndex ?? 0,
      atlasRegion: texture.atlasRegion ?? null,
      faceCount: texture.faceCount,
      viewDimension: texture.viewDimension,
      attachmentViewKeys: [...texture.attachmentViewKeys],
    })),
    matrices: shadowMatrixComputation.matrices.map((matrix) => ({
      shadowId: matrix.shadowId,
      lightId: matrix.lightId,
      faceIndex: matrix.faceIndex ?? 0,
      matrixKey: matrix.matrixKey,
      lightTransformOffset: matrix.lightTransformOffset,
      viewProjectionMatrix: roundedNumbers(matrix.viewProjectionMatrix),
    })),
    drawLists: shadowCasterDrawList.lists.map((list) => ({
      shadowId: list.shadowId,
      lightId: list.lightId,
      passKey: list.passKey,
      casterLayerMask: list.casterLayerMask,
      receiverLayerMask: list.receiverLayerMask,
      includedDrawCount: list.includedDrawCount,
      skippedDrawCount: list.skippedDrawCount,
      draws: list.draws.map((draw) => ({
        renderId: draw.renderId,
        meshKey: draw.meshKey,
        materialKey: draw.materialKey,
        meshLayoutKey: draw.meshLayoutKey,
        submesh: draw.submesh,
        layerMask: draw.layerMask,
      })),
    })),
    casters: shadowCasterMeshDraws.map((draw) => ({
      renderId: draw.renderId,
      meshKey: draw.sortKey.meshKey,
      materialKey: draw.sortKey.materialKey,
      submesh: draw.submesh,
      materialSlot: draw.materialSlot,
      vertexStart: draw.vertexStart ?? null,
      vertexCount: draw.vertexCount ?? null,
      indexStart: draw.indexStart ?? null,
      indexCount: draw.indexCount ?? null,
      layerMask: draw.layerMask,
      worldTransformOffset: draw.worldTransformOffset,
      worldTransform: roundedNumbers(
        transforms.subarray(
          draw.worldTransformOffset,
          draw.worldTransformOffset + 16,
        ),
      ),
    })),
    atlasTiles: atlasTiles.map((tile) => ({
      shadowId: tile.shadowId,
      lightId: tile.lightId,
      mapSize: tile.mapSize,
      atlasWidth: tile.atlasWidth,
      atlasHeight: tile.atlasHeight,
      x: tile.x,
      y: tile.y,
      width: tile.width ?? tile.mapSize,
      height: tile.height ?? tile.mapSize,
      allocationKey: tile.allocationKey ?? null,
    })),
  });
}

function recordClusteredShadowCacheStatus(loop, kind, input) {
  const previous = loop.clusteredShadowCacheStatus?.[kind] ?? null;
  const hit = input.action === "hit";
  const miss = input.action === "miss";
  const reusedTextureCount =
    input.depthTextureResources.reusedTextureCount ?? 0;
  const status = {
    enabled: true,
    kind,
    frame: input.frame,
    lastAction: input.action,
    cacheKeyHash: hashString(input.cacheKey),
    hitCount: (previous?.hitCount ?? 0) + (hit ? 1 : 0),
    missCount: (previous?.missCount ?? 0) + (miss ? 1 : 0),
    submittedShadowPassCount:
      (previous?.submittedShadowPassCount ?? 0) +
      (input.submittedCommandBuffers > 0 ? 1 : 0),
    skippedShadowPassCount:
      (previous?.skippedShadowPassCount ?? 0) + (hit ? 1 : 0),
    submittedCommandBuffers: input.submittedCommandBuffers,
    skippedCommandBuffers: input.skippedCommandBuffers,
    submission: input.submission,
    observedCasterTransformInvalidation:
      previous?.observedCasterTransformInvalidation === true ||
      (kind === "spot" &&
        miss &&
        input.frame === clusteredShadowCacheTransformInvalidationFrame),
    renderedShadowCount: miss ? input.shadowCount : 0,
    cachedShadowCount: hit ? input.shadowCount : 0,
    currentReusedTextureCount: reusedTextureCount,
    maxReusedTextureCount: Math.max(
      previous?.maxReusedTextureCount ?? 0,
      reusedTextureCount,
    ),
    textureDescriptorCount: input.depthTextureResources.textureDescriptorCount,
    createdTextureCount: input.depthTextureResources.createdTextureCount,
  };

  loop.clusteredShadowCacheStatus = {
    ...(loop.clusteredShadowCacheStatus ?? {}),
    [kind]: status,
  };

  return status;
}

function roundedNumbers(values) {
  return Array.from(values, (value) =>
    Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : null,
  );
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createDynamicClusteredSpotShadowAtlasTiles(
  aperture,
  loop,
  shadowRequests,
  requiredShadowRequests,
  frame,
) {
  loop.dynamicSpotShadowAtlasState ??=
    aperture.createLocalLightAtlasSlotAllocatorState({
      atlasWidth: clusteredDynamicSpotShadowAtlas.width,
      atlasHeight: clusteredDynamicSpotShadowAtlas.height,
      maxStaleGenerations: clusteredDynamicSpotShadowAtlas.staleGenerations,
    });

  const allocation = aperture.allocateLocalLightAtlasSlots({
    state: loop.dynamicSpotShadowAtlasState,
    requests: shadowRequests.map((request, index) => {
      const stableIndex = requiredShadowRequests.findIndex(
        (candidate) =>
          candidate.lightId === request.lightId &&
          candidate.shadowId === request.shadowId,
      );
      const mapSize = dynamicClusteredSpotShadowMapSize(
        stableIndex >= 0 ? stableIndex : index,
        frame,
      );

      return {
        allocationKey: `spot-shadow:${request.lightId}`,
        lightId: request.lightId,
        shadowId: request.shadowId,
        width: mapSize,
        height: mapSize,
        priority: mapSize,
      };
    }),
  });
  const tiles = allocation.tiles.map((tile) => ({
    shadowId: tile.shadowId,
    lightId: tile.lightId,
    mapSize: tile.width,
    atlasWidth: allocation.atlasWidth,
    atlasHeight: allocation.atlasHeight,
    x: tile.originX,
    y: tile.originY,
    width: tile.width,
    height: tile.height,
    allocationKey: tile.allocationKey,
    reused: tile.reused,
  }));

  updateDynamicSpotShadowAtlasStatus(loop, allocation, tiles);

  return tiles;
}

function dynamicClusteredSpotShadowMapSize(index, frame) {
  const mapSizes =
    frame >= 3
      ? clusteredDynamicSpotShadowAtlas.resizedMapSizes
      : clusteredDynamicSpotShadowAtlas.mapSizes;

  return (
    mapSizes[index] ??
    clusteredDynamicSpotShadowAtlas.mapSizes[index] ??
    clusteredSpotShadowIntent.mapSize
  );
}

function updateDynamicSpotShadowAtlasStatus(loop, allocation, tiles) {
  const previous = loop.dynamicSpotShadowAtlasStatus ?? null;
  const diagnostics = allocation.diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    allocationKey: diagnostic.allocationKey,
    message: diagnostic.message,
  }));
  const shadowAligned =
    allocation.ready === true &&
    tiles.length === allocation.assignedSlotCount &&
    tiles.every(
      (tile) =>
        tile.atlasWidth === allocation.atlasWidth &&
        tile.atlasHeight === allocation.atlasHeight &&
        tile.width === tile.mapSize &&
        tile.height === tile.mapSize,
    );

  loop.dynamicSpotShadowAtlasStatus = {
    enabled: true,
    ready: allocation.ready === true && shadowAligned,
    shadowAligned,
    atlasWidth: allocation.atlasWidth,
    atlasHeight: allocation.atlasHeight,
    generation: allocation.generation,
    requestedSlotCount: allocation.requestedSlotCount,
    assignedSlotCount: allocation.assignedSlotCount,
    storedSlotCount: allocation.storedSlotCount,
    reusedSlotCount: allocation.reusedSlotCount,
    reassignedSlotCount: allocation.reassignedSlotCount,
    staleSlotCount: allocation.staleSlotCount,
    evictedSlotCount: allocation.evictedSlotCount,
    maxReusedSlotCount: Math.max(
      previous?.maxReusedSlotCount ?? 0,
      allocation.reusedSlotCount,
    ),
    maxStaleSlotCount: Math.max(
      previous?.maxStaleSlotCount ?? 0,
      allocation.staleSlotCount,
    ),
    maxEvictedSlotCount: Math.max(
      previous?.maxEvictedSlotCount ?? 0,
      allocation.evictedSlotCount,
    ),
    diagnosticsCount: diagnostics.length,
    diagnostics,
    slotKeys: tiles.map((tile) => tile.allocationKey),
    tiles: tiles.map((tile) => ({
      shadowId: tile.shadowId,
      lightId: tile.lightId,
      allocationKey: tile.allocationKey,
      x: tile.x,
      y: tile.y,
      width: tile.width,
      height: tile.height,
      reused: tile.reused,
    })),
  };
}

function createClusteredSpotShadowAtlasTiles(shadowRequests) {
  const mapSizes = shadowRequests.map(
    (_request, index) =>
      clusteredSpotShadowAtlasMapSizes[index] ??
      clusteredSpotShadowIntent.mapSize,
  );
  const atlasWidth = mapSizes.reduce((sum, mapSize) => sum + mapSize, 0);
  const atlasHeight = Math.max(...mapSizes, clusteredSpotShadowIntent.mapSize);
  let x = 0;

  return shadowRequests.map((request, index) => {
    const mapSize = mapSizes[index] ?? clusteredSpotShadowIntent.mapSize;
    const tile = {
      shadowId: request.shadowId,
      lightId: request.lightId,
      mapSize,
      atlasWidth,
      atlasHeight,
      x,
      y: 0,
    };

    x += mapSize;
    return tile;
  });
}

function createAtlasAdjustedSpotShadowMatrixComputation(computation, tiles) {
  const tileByShadowLight = new Map(
    tiles.map((tile) => [`${tile.shadowId}:${tile.lightId}`, tile]),
  );

  return {
    ...computation,
    matrices: computation.matrices.map((matrix) => {
      const tile = tileByShadowLight.get(
        `${matrix.shadowId}:${matrix.lightId}`,
      );

      if (tile === undefined) {
        return matrix;
      }

      return {
        ...matrix,
        viewProjectionMatrix: Array.from(
          atlasAdjustedShadowMatrix(matrix.viewProjectionMatrix, {
            x: tile.x / tile.atlasWidth,
            y: tile.y / tile.atlasHeight,
            width: tile.mapSize / tile.atlasWidth,
            height: tile.mapSize / tile.atlasHeight,
          }),
        ),
      };
    }),
  };
}

function atlasAdjustedShadowMatrix(matrix, rect) {
  const result = new Float32Array(matrix);
  const xScale = rect.width;
  const xOffset = 2 * rect.x + rect.width - 1;
  const yScale = rect.height;
  const yOffset = 1 - 2 * rect.y - rect.height;

  for (let column = 0; column < 4; column += 1) {
    const offset = column * 4;
    const row0 = matrix[offset] ?? 0;
    const row1 = matrix[offset + 1] ?? 0;
    const row3 = matrix[offset + 3] ?? 0;

    result[offset] = xScale * row0 + xOffset * row3;
    result[offset + 1] = yScale * row1 + yOffset * row3;
  }

  return result;
}

function pixelDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = a.a - b.a;

  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

function luminance(pixel) {
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}

function failure(reason, message) {
  return {
    example: "clustered-lights",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: colorStatus(clearColor),
  };
}

function colorStatus(color) {
  return {
    r: color[0] ?? 0,
    g: color[1] ?? 0,
    b: color[2] ?? 0,
    a: color[3] ?? 1,
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
