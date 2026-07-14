import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel, type RgbaPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
  waitForPresentedFrames,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

// F3 (three.js parity plan): a custom-shaded SKINNED character with a dissolve
// effect renders through the single-custom-WGSL app route. Proves:
//  - AC1 the skinned custom material renders (webgpu-app-route, familyKey,
//    skinned draw + 2 bones, the prepared pipeline key carries `skinned:v1`),
//  - the skeleton poses the mesh: a bind pose (bend=0) and a bent pose (bend=1)
//    at the SAME dissolve produce different pixels (skinning moves vertices),
//  - the fragment dissolve animates between frames (whole-frame pixels change).

interface SkinnedStatus extends ExampleStatusBase {
  readonly renderingBackend?: string;
  readonly customMaterial?: {
    readonly family: string;
    readonly sourceMaterialKey: string;
    readonly shaderAssetKey?: string;
    readonly materialResourceKey?: string;
    readonly pipelineKey?: string;
    readonly resourcePipelineKey?: string;
    readonly bindGroupResourceKey?: string;
    readonly bindingCount?: number;
    readonly diagnostics: number;
  };
  readonly skinning?: {
    readonly skinnedDraws: number;
    readonly boneCount: number;
    readonly boneMatrixOffset: number | null;
    readonly boneMatrixCount: number | null;
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly skinnedDraws: number;
    readonly bones: number;
    readonly diagnostics: number;
  };
  readonly rendering?: {
    readonly drawPackages: number;
    readonly drawCommands: number;
    readonly drawCalls: number;
  };
  readonly readback?: {
    readonly ok: boolean;
    readonly samples: readonly {
      readonly id: string;
      readonly pixel: RgbaPixel;
    }[];
  };
}

function maxSampleDistance(
  a: NonNullable<SkinnedStatus["readback"]>,
  b: NonNullable<SkinnedStatus["readback"]>,
): number {
  let max = 0;
  for (const sample of a.samples) {
    const other = b.samples.find((candidate) => candidate.id === sample.id);
    if (other !== undefined) {
      max = Math.max(max, pixelDistance(sample.pixel, other.pixel));
    }
  }
  return max;
}

async function loadPose(
  page: Page,
  query: string,
  name: string,
): Promise<SkinnedStatus | undefined> {
  return loadExampleStatus<SkinnedStatus>(
    page,
    `/examples/skinned-custom-material.html${query}`,
    name,
  );
}

test("skinned custom material renders through the app route (AC1)", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadPose(page, "", "skinned-custom-material-status");

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "skinned-custom-material",
    scenario: "skinned-dissolve",
    ok: true,
    renderingBackend: "webgpu-app-route",
    customMaterial: {
      family: "example/skinned-dissolve",
      sourceMaterialKey: "material:skinned-dissolve-material",
      shaderAssetKey: "shader:skinned-dissolve-shader",
      diagnostics: 0,
    },
    extraction: { views: 1, meshDraws: 1, skinnedDraws: 1, bones: 2 },
    rendering: { drawPackages: 1, drawCalls: 1 },
  });
  // The skinned draw carries a 2-bone palette (the joint palette the renderer
  // binds at @group(4)).
  expect(status.skinning?.skinnedDraws).toBe(1);
  expect(status.skinning?.boneCount).toBe(2);
  expect(status.skinning?.boneMatrixCount).toBe(2);
  // The F3 skinning contract token participates in the pipeline key.
  expect(status.customMaterial?.pipelineKey).toContain(
    "example/skinned-dissolve|",
  );
  expect(status.customMaterial?.pipelineKey).toContain("skinned:v1");
  expect(status.customMaterial?.resourcePipelineKey).toContain("skinned:v1");
  expect(status.customMaterial?.bindGroupResourceKey).toContain(
    "custom-wgsl-bind-group:material:skinned-dissolve-material",
  );
  guard.expectNoWarnings();
});

test("the skeleton poses the mesh: bind vs bent pose differ (skinning moves vertices)", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  // Same dissolve threshold in both loads, so the ONLY difference is the pose:
  // any pixel change is caused by the skeleton bending the mesh.
  const bind = await loadPose(
    page,
    "?bend=0&dissolve=0.12",
    "skinned-custom-material-bind",
  );
  const bent = await loadPose(
    page,
    "?bend=1&dissolve=0.12",
    "skinned-custom-material-bent",
  );

  if (bind === undefined || bent === undefined) {
    return;
  }

  expect(bind.ok, JSON.stringify(bind, null, 2)).toBe(true);
  expect(bent.ok, JSON.stringify(bent, null, 2)).toBe(true);
  expect(bind.skinning?.skinnedDraws).toBe(1);

  if (bind.readback?.ok !== true || bent.readback?.ok !== true) {
    test.skip(true, "GPU readback unavailable in this browser");
    return;
  }

  expect(
    maxSampleDistance(bind.readback, bent.readback),
    "bind pose vs bent pose must change the rendered pixels (skin moves vertices)",
  ).toBeGreaterThan(25);
  guard.expectNoWarnings();
});

test("the custom dissolve animates between frames", async ({ page }) => {
  const guard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadPose(page, "", "skinned-custom-material-animated");

  if (status === undefined) {
    return;
  }

  expect(status.ok, JSON.stringify(status, null, 2)).toBe(true);
  await waitForPresentedFrames(page, 4);

  const beforeShot = await page.locator("#aperture-canvas").screenshot();
  const gridDeltaFromBaseline = (afterShot: Buffer): number => {
    let maxFrameDelta = 0;
    for (let gy = 0; gy < 13; gy += 1) {
      for (let gx = 0; gx < 13; gx += 1) {
        const xRatio = 0.32 + (0.36 * gx) / 12;
        const yRatio = 0.18 + (0.6 * gy) / 12;
        maxFrameDelta = Math.max(
          maxFrameDelta,
          pixelDistance(
            readPngPixel(beforeShot, xRatio, yRatio),
            readPngPixel(afterShot, xRatio, yRatio),
          ),
        );
      }
    }
    return maxFrameDelta;
  };

  await expect
    .poll(
      async () => {
        await waitForPresentedFrames(page);
        return gridDeltaFromBaseline(
          await page.locator("#aperture-canvas").screenshot(),
        );
      },
      {
        message:
          "the skinned dissolve must animate: the rendered frame must change over time",
        timeout: 30_000,
      },
    )
    .toBeGreaterThan(12);

  const finalShot = await page.locator("#aperture-canvas").screenshot();
  await test.info().attach("skinned-custom-material-frame", {
    body: finalShot,
    contentType: "image/png",
  });
  guard.expectNoWarnings();
});
