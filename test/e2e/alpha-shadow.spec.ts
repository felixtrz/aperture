import { expect, test } from "@playwright/test";

import {
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface AlphaShadowStatus extends ExampleStatusBase {
  readonly alphaTest?: {
    readonly holeTexels: number;
    readonly writtenTexels: number;
    readonly perforated: boolean;
  };
  readonly opaque?: {
    readonly holeTexels: number;
    readonly writtenTexels: number;
    readonly solid: boolean;
  };
}

// M4-T8 proof: an alpha-cutout quad rendered through the alpha-test shadow
// caster pipeline (SHADOW_CASTER_ALPHA_TEST_WGSL) writes a PERFORATED shadow
// (depth) map — holes (lit samples, where checkerboard alpha < cutoff so the
// fragment discards) coexist with written texels (shadowed samples) inside the
// caster footprint — while the opaque position-only caster writes a SOLID map.
test("M4-T8: alpha-tested caster casts a perforated shadow vs a solid opaque caster", async ({
  page,
}) => {
  await page.goto("/examples/alpha-shadow.html");
  const status = await waitForExampleStatus<AlphaShadowStatus>(page);
  expect(status, "alpha-shadow status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(status);

  // Alpha-test caster: both lit (holes) and shadowed (written) samples exist in
  // the footprint — the silhouette is perforated where alpha < cutoff.
  expect(status.alphaTest?.holeTexels ?? 0).toBeGreaterThan(0);
  expect(status.alphaTest?.writtenTexels ?? 0).toBeGreaterThan(0);
  expect(status.alphaTest?.perforated).toBe(true);

  // Opaque caster over the same full-footprint quad: a solid silhouette — every
  // footprint texel is written, no holes (proving the perforation is the
  // alpha-test discard, not missing coverage).
  expect(status.opaque?.holeTexels ?? -1).toBe(0);
  expect(status.opaque?.writtenTexels ?? 0).toBeGreaterThan(0);
  expect(status.opaque?.solid).toBe(true);

  await page.goto("about:blank");
});
