import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createKtx2TextureCompressionSupportFromFeatures } from "@aperture-engine/render";
import { configureApertureExampleControl } from "./example-control.js";

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const route = compressedGltfRoute();
const runtime = {
  webgpu: null,
};

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  assets: {
    draco: asset.gltf("/aperture/examples/assets/draco-heart.glb", {
      preload: "blocking",
    }),
    ktx2: asset.gltf("/aperture/examples/assets/basis-ktx2-texture.glb", {
      preload: "blocking",
    }),
  },
  assetDecoders: {
    baseUrl: "/aperture/examples/assets/",
  },
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: [0.015, 0.02, 0.03, 1],
  },
});

configureApertureExampleControl({
  getStatus: () => compressedGltfStatus(),
});
requestAnimationFrame(function publishCompressedGltfStatus() {
  compressedGltfStatus();
  requestAnimationFrame(publishCompressedGltfStatus);
});

try {
  const generated = await startGeneratedBrowserApp({
    config,
    workerEntry: "/aperture/worker-modules/examples/compressed-gltf.worker.js",
    systemManifest: [
      {
        moduleUrl: "/aperture/examples/compressed-gltf.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });
  runtime.webgpu = generated.webgpu;
} catch (error) {
  publishStatus({
    example: "compressed-gltf",
    ok: false,
    route: route.id,
    reason: "compressed-gltf-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Compressed glTF example failed to start.",
  });
}

function compressedGltfStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const diagnostics = generated?.diagnostics ?? null;
  const lastFrame = diagnostics?.lastFrame ?? null;
  const workerSummary = generated?.lastWorkerSummary ?? null;
  const meshDraws = lastFrame?.counts?.meshDraws ?? 0;
  const workerAssets = Array.isArray(workerSummary?.assets)
    ? workerSummary.assets
    : [];
  const selectedAsset = workerAssets.find(
    (entry) => entry.id === route.assetId && entry.ready === true,
  );
  const dracoAsset = workerAssets.find(
    (entry) => entry.id === "draco" && entry.ready === true,
  );
  const ktx2Asset = workerAssets.find(
    (entry) => entry.id === "ktx2" && entry.ready === true,
  );
  const textureCompressionSupport = webgpuTextureCompressionSupport();
  const ktx2Targets = textureTargets(ktx2Asset);
  const hasCompressionSupport =
    textureCompressionSupport !== null &&
    (textureCompressionSupport.astc === true ||
      textureCompressionSupport.bc === true ||
      textureCompressionSupport.etc2 === true);
  const hasCompressedGpuTarget = ktx2Targets.some(
    (target) => target.family === "compressed-gpu",
  );
  const hasRgba32FallbackTarget = ktx2Targets.some(
    (target) => target.transcodeTarget === "rgba32",
  );
  const routeAssetReady = selectedAsset !== undefined;
  const routeKtx2Ready =
    route.assetId !== "ktx2" ||
    (ktx2Targets.length > 0 &&
      (hasCompressionSupport
        ? hasCompressedGpuTarget
        : hasRgba32FallbackTarget));
  const status = {
    example: "compressed-gltf",
    route: route.id,
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      meshDraws > 0 &&
      dracoAsset !== undefined &&
      routeAssetReady &&
      routeKtx2Ready,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    source: {
      asset: route.assetId,
      url: route.url,
      decoderBaseUrl: "/aperture/examples/assets/",
      routeRegisteredDecoder: false,
    },
    assets: {
      selected: selectedAsset ?? null,
      draco: dracoAsset ?? null,
      ktx2: ktx2Asset ?? null,
    },
    ktx2: {
      textureCompressionSupport,
      hasCompressionSupport,
      targets: ktx2Targets,
      compressedGpuTarget: hasCompressedGpuTarget,
      rgba32FallbackTarget: hasRgba32FallbackTarget,
    },
    snapshots: generated?.snapshots ?? 0,
    mirroredSourceAssets: generated?.mirroredSourceAssets ?? 0,
    meshDraws,
    drawCalls: lastFrame?.counts?.drawCalls ?? 0,
    diagnosticsCount: lastFrame?.counts?.diagnostics ?? 0,
    asset: selectedAsset ?? null,
    workerDiagnostics: workerSummary?.diagnostics ?? [],
    webgpuDiagnostics: diagnostics,
  };

  publishStatus(status);
  return status;
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "running" : status.state;
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function compressedGltfRoute() {
  const assetId = new URLSearchParams(globalThis.location.search).get("asset");

  if (assetId === "ktx2" || assetId === "basis") {
    return {
      id: "ktx2",
      assetId: "ktx2",
      url: "/aperture/examples/assets/basis-ktx2-texture.glb",
    };
  }

  return {
    id: "draco",
    assetId: "draco",
    url: "/aperture/examples/assets/draco-heart.glb",
  };
}

function webgpuTextureCompressionSupport() {
  const webgpu = runtime.webgpu;

  if (webgpu?.ok !== true) {
    return null;
  }

  return createKtx2TextureCompressionSupportFromFeatures(
    webgpu.initialization.device.features ??
      webgpu.initialization.adapter.features,
  );
}

function textureTargets(assetSummary) {
  const textures = Array.isArray(assetSummary?.textures)
    ? assetSummary.textures
    : [];

  return textures
    .map((texture) => {
      if (typeof texture?.format !== "string") {
        return null;
      }

      const compressed = isCompressedGpuTextureFormat(texture.format);

      return {
        textureIndex: texture.textureIndex,
        slot: texture.slot,
        gpuFormat: texture.format,
        family: compressed ? "compressed-gpu" : "rgba32-fallback",
        transcodeTarget: compressed ? texture.format : "rgba32",
        width: texture.width,
        height: texture.height,
        mipLevelCount: texture.mipLevelCount,
        sourceData: texture.sourceData,
      };
    })
    .filter((target) => target !== null);
}

function isCompressedGpuTextureFormat(format) {
  return (
    format.startsWith("astc-") ||
    format.startsWith("bc") ||
    format.startsWith("etc2-")
  );
}

function webGpuFailureReason(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }

  return typeof generated.diagnostics?.reason === "string"
    ? generated.diagnostics.reason
    : "webgpu-failed";
}

function webGpuFailureMessage(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }

  return typeof generated.diagnostics?.message === "string"
    ? generated.diagnostics.message
    : "WebGPU initialization failed.";
}
