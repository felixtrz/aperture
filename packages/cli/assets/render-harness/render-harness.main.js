// Standalone "render one saved snapshot" entrypoint for the `aperture render`
// command. It does NOT run a simulation: it rehydrates the source-asset
// registry from the bundle, applies the deserialized snapshot through the same
// generic `app.renderSnapshot()` path the live app uses, and reports status so
// the Playwright driver knows when to screenshot.
//
// The bundle is injected by the driver before this module runs, via
// `window.__APERTURE_RENDER_BUNDLE__`.
import { createWebGpuApp } from "@aperture-engine/webgpu";
import { AssetRegistry } from "@aperture-engine/simulation";
import {
  decodeTypedArrayTree,
  renderSnapshotFromJsonValue,
} from "@aperture-engine/render";
import { mirrorSourceAssetRegistryFromMessage } from "@aperture-engine/app/asset-mirror";

function fail(message) {
  globalThis.__APERTURE_RENDER_STATUS__ = { ok: false, error: String(message) };
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
    sourceAssets: decodeTypedArrayTree(bundle.sourceAssets),
  });

  const result = await createWebGpuApp({ canvas, sourceAssets });

  if (!result.ok) {
    fail(
      `WebGPU app initialization failed: ${
        result.diagnostics?.map((d) => d.code).join(", ") ?? "unknown"
      }`,
    );
    return;
  }

  const snapshot = renderSnapshotFromJsonValue(bundle.snapshot);
  const report = await result.app.renderSnapshot(snapshot);

  globalThis.__APERTURE_RENDER_STATUS__ = {
    ok: report.ok === true,
    frame: report.snapshot?.frame ?? bundle.frame ?? null,
    diagnostics: report.ok === true ? [] : (report.diagnostics ?? []),
  };
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : error);
});
