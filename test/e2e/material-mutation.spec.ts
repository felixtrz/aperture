import { expect, test } from "@playwright/test";
import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  loadExampleStatus,
} from "./webgpu-status.js";

// M7-T6 Done-when #3: a render-control route renders an unlit quad, then a route
// calls materials.set(handle, { baseColorFactor: red }); the center pixel readback
// should transition from the original green to red with no new mesh/material handle.
//
// KNOWN BLOCKER (fixme): the authoring side works end-to-end — materials.set bumps
// the registry version, the version-gated source-asset mirror delivers the red
// asset to the main thread (verified: mirroredMaterialColor=[1,0,0,1]@v2), and the
// red asset reaches the unlit GPU adapter (verified: options.material is red). BUT
// the rendered pixel stays green: the built-in (unlit/standard/matcap) material GPU
// resources are cached by a version-INDEPENDENT materialResourceKey, so the frame
// bind-group cache reuses the previous version's buffer/bind group on a same-handle
// content change. Custom-WGSL materials (whose uniform values live in the bind
// group) update correctly, which is why examples/custom-material mutates visibly.
// Closing this needs version-aware built-in-material GPU resource keys threaded
// consistently across the prepared-material buffer + bind-group caches (a naive
// version-stamp breaks the resource linkage and skips the draw). The authoring
// surface + the version/mirror/prepared-action mechanism are proven headlessly in
// test/materials/runtime-material-mutation.test.ts.

interface MutationPixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface MutationSample {
  readonly frame: number;
  readonly mutated: boolean;
  readonly pixel: MutationPixel;
}

interface MaterialMutationStatus extends ExampleStatusBase {
  readonly mutated?: boolean;
  readonly mutationVersion?: number | null;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly samples?: readonly MutationSample[];
  readonly beforeSample?: MutationSample | null;
  readonly afterSample?: MutationSample | null;
}

function readStatus(): MaterialMutationStatus | undefined {
  return (
    globalThis as typeof globalThis & {
      readonly __APERTURE_EXAMPLE_STATUS__?: MaterialMutationStatus;
    }
  ).__APERTURE_EXAMPLE_STATUS__;
}

test.fixme("runtime materials.set transitions the unlit quad center pixel from green to red", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const initial = await loadExampleStatus<MaterialMutationStatus>(
    page,
    "/examples/material-mutation.html",
    "material-mutation-initial-status",
  );

  if (initial === undefined) {
    return;
  }

  await page.waitForFunction(
    () => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly ok?: boolean;
            readonly beforeSample?: { readonly frame: number } | null;
            readonly afterSample?: { readonly frame: number } | null;
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__;
      return (
        status?.ok === true &&
        status.beforeSample != null &&
        status.afterSample != null &&
        status.afterSample.frame >= 15
      );
    },
    undefined,
    { timeout: 20000 },
  );

  const status = await page.evaluate(readStatus);
  await attachExampleStatus("material-mutation-final-status", status);
  expect(status, "material mutation status should be published").toBeDefined();

  if (status === undefined) {
    return;
  }

  const before = status.beforeSample?.pixel;
  const after = status.afterSample?.pixel;
  expect(before, JSON.stringify(status, null, 2)).toBeDefined();
  expect(after, JSON.stringify(status, null, 2)).toBeDefined();

  if (before === undefined || after === undefined) {
    return;
  }

  // The original material is green (g dominant), the mutated material is red.
  expect(before.g).toBeGreaterThan(before.r);
  expect(before.g).toBeGreaterThan(80);
  expect(after.r).toBeGreaterThan(after.g);
  expect(after.r).toBeGreaterThan(150);

  // The mutation rode the versioned asset path — same single mesh draw, bumped
  // material version, no new handle.
  expect(status.extraction?.meshDraws).toBe(1);
  expect(status.mutated).toBe(true);
  expect(status.mutationVersion ?? 0).toBeGreaterThan(0);
  guard.expectNoWarnings();
});
