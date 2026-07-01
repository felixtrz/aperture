// Standalone "render one saved snapshot" entrypoint for the `aperture render`
// command. It does NOT run a simulation: it rehydrates the source-asset
// registry from the bundle, applies the deserialized snapshot through the same
// generic `app.renderSnapshot()` path the live app uses, and reports status so
// the Playwright driver knows when to screenshot.
//
// The bundle is injected by the driver before this module runs, via
// `window.__APERTURE_RENDER_BUNDLE__`.
import {
  createWebGpuApp,
  createWebGpuBloomPostEffect,
  prepareWebGpuAppEnvironmentAssets,
} from "@aperture-engine/webgpu";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  decodeTypedArrayTree,
  renderSnapshotFromJsonValue,
} from "@aperture-engine/render";
import { mirrorSourceAssetRegistryFromMessage } from "@aperture-engine/app/asset-mirror";

function fail(message) {
  globalThis.__APERTURE_RENDER_STATUS__ = { ok: false, error: String(message) };
}

function bundleSnapshotValue(bundle) {
  if (
    bundle?.format === "aperture.render-bundle" &&
    bundle?.snapshot?.codec === "json-typed-array-v1"
  ) {
    return bundle.snapshot.value;
  }

  return bundle?.snapshot;
}

function bundleSourceAssetsValue(bundle) {
  if (
    bundle?.format === "aperture.render-bundle" &&
    bundle?.assets?.entries !== undefined
  ) {
    return { entries: bundle.assets.entries };
  }

  return bundle?.sourceAssets;
}

function bundleRenderTarget(bundle) {
  return bundle?.format === "aperture.render-bundle" ? bundle.renderTarget : {};
}

function firstSnapshotEnvironmentHandle(snapshot) {
  for (const environment of snapshot?.environments ?? []) {
    if (environment?.handle !== null && environment?.handle !== undefined) {
      return environment.handle;
    }
  }

  return null;
}

function bundleEnvironmentAssetInputs(sourceAssets) {
  return sourceAssets
    .list({ kind: "environment-map", status: "ready" })
    .map(environmentAssetInputFromEntry)
    .filter((input) => input !== null);
}

function environmentAssetInputFromEntry(entry) {
  if (entry?.asset === null || typeof entry?.asset !== "object") {
    return null;
  }

  const asset = entry.asset;
  const equirectSource = equirectSourceFromValue(asset.equirectSource);
  const diffuseSource = cubeSourceFromValue(asset.diffuseSource);
  const specularPmremSource = cubeSourceFromValue(asset.specularPmremSource);

  if (
    equirectSource === null &&
    diffuseSource === null &&
    specularPmremSource === null
  ) {
    return null;
  }

  return {
    handle: entry.handle,
    label:
      typeof asset.label === "string"
        ? asset.label
        : typeof entry.label === "string"
          ? entry.label
          : entry.handle.id,
    version: entry.version,
    diffuseResourceKey:
      typeof asset.diffuseResourceKey === "string"
        ? asset.diffuseResourceKey
        : `environment-map:${entry.handle.id}:diffuse`,
    specularResourceKey:
      typeof asset.specularResourceKey === "string"
        ? asset.specularResourceKey
        : `environment-map:${entry.handle.id}:specular`,
    ...(equirectSource === null ? {} : { equirectSource }),
    ...(diffuseSource === null ? {} : { diffuseSource }),
    ...(specularPmremSource === null ? {} : { specularPmremSource }),
    ...(Number.isInteger(asset.standardMaterialCount)
      ? { standardMaterialCount: asset.standardMaterialCount }
      : {}),
  };
}

function equirectSourceFromValue(value) {
  if (value === null || typeof value !== "object") {
    return null;
  }

  if (
    !Number.isInteger(value.width) ||
    !Number.isInteger(value.height) ||
    !(value.data instanceof Uint8Array)
  ) {
    return null;
  }

  return {
    width: value.width,
    height: value.height,
    data: value.data,
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.resourceKey === "string"
      ? { resourceKey: value.resourceKey }
      : {}),
    ...(Number.isInteger(value.faceSize) ? { faceSize: value.faceSize } : {}),
    ...(typeof value.format === "string" ? { format: value.format } : {}),
    ...(Number.isInteger(value.mipLevelCount)
      ? { mipLevelCount: value.mipLevelCount }
      : {}),
  };
}

function cubeSourceFromValue(value) {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const faces = Array.isArray(value.faces)
    ? value.faces.filter((face) => face instanceof Uint8Array)
    : [];

  if (!Number.isInteger(value.faceSize) || faces.length === 0) {
    return null;
  }

  return {
    faceSize: value.faceSize,
    faces,
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.resourceKey === "string"
      ? { resourceKey: value.resourceKey }
      : {}),
    ...(typeof value.sourceResourceKey === "string"
      ? { sourceResourceKey: value.sourceResourceKey }
      : {}),
    ...(typeof value.environmentMapResourceKey === "string"
      ? { environmentMapResourceKey: value.environmentMapResourceKey }
      : {}),
    ...(typeof value.format === "string" ? { format: value.format } : {}),
    ...(Number.isInteger(value.mipLevelCount)
      ? { mipLevelCount: value.mipLevelCount }
      : {}),
  };
}

async function webGpuMetadataFromInitialization(initialization) {
  if (initialization === null || typeof initialization !== "object") {
    return null;
  }

  return {
    format:
      typeof initialization.format === "string" ? initialization.format : null,
    displayColorSpace:
      typeof initialization.displayColorSpace === "string"
        ? initialization.displayColorSpace
        : null,
    adapterInfo: await adapterInfoMetadata(initialization.adapter),
    adapterFeatures: featureSetMetadata(initialization.adapter?.features),
    deviceFeatures: featureSetMetadata(initialization.device?.features),
  };
}

async function adapterInfoMetadata(adapter) {
  if (adapter === null || typeof adapter !== "object") {
    return {};
  }

  const directInfo = primitiveRecord(adapter.info);

  if (Object.keys(directInfo).length > 0) {
    return directInfo;
  }

  if (typeof adapter.requestAdapterInfo !== "function") {
    return {};
  }

  try {
    return primitiveRecord(await adapter.requestAdapterInfo());
  } catch {
    return {};
  }
}

function featureSetMetadata(features) {
  if (features === null || typeof features !== "object") {
    return [];
  }

  try {
    if (typeof features[Symbol.iterator] === "function") {
      return Array.from(features, (feature) => String(feature)).sort();
    }
  } catch {
    return [];
  }

  return [];
}

function primitiveRecord(value) {
  if (value === null || typeof value !== "object") {
    return {};
  }

  const output = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      output[key] = item;
    }
  }

  return output;
}

async function main() {
  const bundle = globalThis.__APERTURE_RENDER_BUNDLE__;

  if (bundle === undefined || bundle === null) {
    fail("No render bundle was injected (window.__APERTURE_RENDER_BUNDLE__).");
    return;
  }

  const canvas = document.getElementById("aperture-canvas");

  if (canvas === null) {
    fail("Missing #aperture-canvas element.");
    return;
  }

  // Decode the typed-array-tagged source assets back into real Uint8Array mesh
  // bytes, then mirror them into a registry. This is load-bearing: the snapshot
  // carries only { kind, id } handles, so without the rehydrated bytes every
  // mesh resolves to null and the frame renders blank.
  const sourceAssets = new AssetRegistry();
  mirrorSourceAssetRegistryFromMessage(sourceAssets, {
    sourceAssets: decodeTypedArrayTree(bundleSourceAssetsValue(bundle)),
  });

  const renderTarget = bundleRenderTarget(bundle);
  // App-level bloom travels with the bundle (#73); rebuild the same post
  // effect the browser runtime derives from config.render.bloom. Bloom needs
  // the HDR scene buffer, so the bundle producer implies exposure alongside.
  const bloom =
    renderTarget?.bloom !== null && typeof renderTarget?.bloom === "object"
      ? renderTarget.bloom
      : null;
  const postEffects =
    bloom === null ? [] : [createWebGpuBloomPostEffect(bloom)];
  const result = await createWebGpuApp({
    canvas,
    sourceAssets,
    ...(postEffects.length === 0 ? {} : { postEffects }),
    ...(Number.isInteger(renderTarget?.sampleCount)
      ? { msaaSampleCount: renderTarget.sampleCount }
      : {}),
    ...(renderTarget?.colorSpace === "srgb"
      ? { outputColorSpace: "srgb" }
      : {}),
    ...(typeof renderTarget?.toneMapping === "string"
      ? { tonemap: renderTarget.toneMapping }
      : {}),
    ...(Number.isFinite(renderTarget?.exposure)
      ? { exposure: renderTarget.exposure }
      : {}),
  });

  if (!result.ok) {
    fail(
      `WebGPU app initialization failed: ${
        result.diagnostics?.map((d) => d.code).join(", ") ?? "unknown"
      }`,
    );
    return;
  }

  const metadata = {
    webgpu: await webGpuMetadataFromInitialization(result.initialization),
  };
  const snapshot = renderSnapshotFromJsonValue(bundleSnapshotValue(bundle));
  const activeEnvironmentHandle = firstSnapshotEnvironmentHandle(snapshot);
  const environmentInputs = bundleEnvironmentAssetInputs(sourceAssets);
  let renderOptions = {};

  if (activeEnvironmentHandle !== null) {
    if (environmentInputs.length === 0) {
      fail(
        "Render bundle references an environment map but contains no embedded environment asset input.",
      );
      return;
    }

    const prepared = prepareWebGpuAppEnvironmentAssets({
      app: result.app,
      assets: environmentInputs,
      activeHandle: activeEnvironmentHandle,
    });

    if (prepared.active === null || !prepared.active.ready) {
      fail("Embedded environment asset input could not be prepared.");
      return;
    }

    renderOptions = {
      standardMaterialIblResources:
        prepared.active.standardMaterialIblResources,
    };
  }

  const report = await result.app.renderSnapshot(snapshot, renderOptions);

  globalThis.__APERTURE_RENDER_STATUS__ = {
    ok: report.ok === true,
    frame: report.snapshot?.frame ?? bundle.frame ?? null,
    diagnostics: report.ok === true ? [] : (report.diagnostics ?? []),
    metadata,
  };
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : error);
});
