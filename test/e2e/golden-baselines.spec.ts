import { expect, test } from "@playwright/test";

import { loadExampleStatus } from "./webgpu-status.js";

// AI-74 (R1.5): committed golden-image baselines over deterministic example
// routes. Each route renders a static scene (verified frame-to-frame stable
// under SwiftShader), so a full-canvas comparison catches regressions anywhere
// in the image — not just at probed pixels.
//
// Refresh after an intentional rendering change with:
//   CI=true xvfb-run -a pnpm exec playwright test \
//     --config=playwright.ci.config.ts test/e2e/golden-baselines.spec.ts \
//     --update-snapshots
//
// Animated routes (matcap-app, tonemap-showcase, spinning scenes) are
// deliberately absent — their behavior is asserted by their own specs; a
// time-varying frame cannot be a stable golden.
const GOLDEN_ROUTES = [
  // Shadowed scenes (directional auto-fit + multi-light atlas).
  "auto-shadow",
  "multi-light-shadow",
  // Area lights (LTC approximations over shapes).
  "area-light-shapes",
  // Image-based lighting (diffuse irradiance).
  "ibl-irradiance",
  // Textured StandardMaterial over a GLB asset.
  "standard-gltf-texture",
  // MSDF text rendering.
  "msdf-text",
  // UI quads and hit regions.
  "ui-interaction",
] as const;

// Tolerates SwiftShader/Chrome minor-version rasterization drift (anti-aliased
// edges are a tiny fraction of the 960x540 canvas) while failing on any small
// missing/changed region — ~0.3% of the canvas.
const MAX_DIFF_PIXELS = 1500;

for (const route of GOLDEN_ROUTES) {
  test(`golden baseline: ${route}`, async ({ page }) => {
    const status = await loadExampleStatus(
      page,
      `/examples/${route}.html`,
      `${route}-golden-status`,
    );

    if (status === undefined) {
      return;
    }

    // Some routes publish ok:false while async resource preparation (for
    // example IBL convolution) is still in flight; wait for the ready state.
    await page.waitForFunction(
      () =>
        (
          globalThis as {
            __APERTURE_EXAMPLE_STATUS__?: { readonly ok?: boolean };
          }
        ).__APERTURE_EXAMPLE_STATUS__?.ok === true,
      undefined,
      { timeout: 120_000 },
    );

    // Let the steady-state frame present before capturing (these routes are
    // static; the wait absorbs first-frame resource preparation only).
    await page.waitForTimeout(1500);

    await expect(page.locator("canvas").first()).toHaveScreenshot(
      `${route}.png`,
      { maxDiffPixels: MAX_DIFF_PIXELS },
    );
  });
}
