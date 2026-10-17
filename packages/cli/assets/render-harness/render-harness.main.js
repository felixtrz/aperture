// The browser owns presentation; bundle hydration and GPU rendering are shared
// with the native Dawn worker through the renderer-only app entry point.
import { renderPortableBundle } from "@aperture-engine/app/render-bundle";
import {
  isShaderJob,
  decodeShaderJob,
  shaderJobRequiredFeatures,
} from "@aperture-engine/shader";

async function main() {
  const bundle = globalThis.__APERTURE_RENDER_BUNDLE__;
  if (bundle === undefined || bundle === null)
    throw new Error(
      "No render bundle was injected (window.__APERTURE_RENDER_BUNDLE__).",
    );
  const canvas = document.getElementById("aperture-canvas");
  if (canvas === null) throw new Error("Missing #aperture-canvas element.");
  let app, status;
  if (isShaderJob(bundle)) {
    const { renderShaderJobInCanvas } =
      await import("@aperture-engine/gpu/browser");
    const job = decodeShaderJob(bundle);
    const result = await renderShaderJobInCanvas(job, {
      canvas,
      requiredFeatures: shaderJobRequiredFeatures(job),
    });
    app = result.context;
    status = {
      ok: true,
      frame: result.reports.at(-1).frame,
      diagnostics: result.reports.flatMap((report) => report.diagnostics),
      shader: { reports: result.reports, inspection: result.context.inspect() },
      metadata: { webgpu: result.metadata, lightingHealth: null },
    };
  } else ({ app, status } = await renderPortableBundle(bundle, { canvas }));
  // Keep the output alive until the driver captures it. Navigation owns final
  // browser teardown; pagehide also releases explicit renderer allocations.
  addEventListener(
    "pagehide",
    () => {
      void app.dispose();
    },
    { once: true },
  );
  globalThis.__APERTURE_RENDER_STATUS__ = status;
}

main().catch((error) => {
  globalThis.__APERTURE_RENDER_STATUS__ = {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
});
