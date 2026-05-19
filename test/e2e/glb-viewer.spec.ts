import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface GlbViewerStatus extends ExampleStatusBase {
  readonly source?: {
    readonly ok: boolean;
    readonly byteLength: number | null;
    readonly status: {
      readonly status: string;
      readonly sourceKind: string;
      readonly diagnostics: readonly unknown[];
    } | null;
    readonly diagnostics: readonly unknown[];
  };
  readonly gltf?: {
    readonly registration: {
      readonly valid: boolean;
      readonly diagnostics: number;
    };
    readonly primitiveMaterials: {
      readonly valid: boolean;
      readonly resolved: number;
      readonly diagnostics: number;
    };
    readonly commandPlan: {
      readonly valid: boolean;
      readonly commands: number;
      readonly dependencies: number;
    };
    readonly replay: {
      readonly valid: boolean;
      readonly created: number;
      readonly diagnostics: number;
    };
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly draw?: {
    readonly packages: number;
    readonly drawCalls: number;
  };
  readonly orbit?: {
    readonly yaw: number;
    readonly distance: number;
    readonly dragging: boolean;
  };
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
}

test("Playwright renders the fetched sample GLB viewer asset", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/glb-viewer.html");

  const status = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(status, "GLB viewer status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);

  await page.waitForFunction(
    () =>
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: { readonly frame?: number };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.frame ?? 0) >= 3,
  );

  const rendered = await waitForExampleStatus<GlbViewerStatus>(page);

  expect(rendered?.ok).toBe(true);
  expectStatusJsonSafeForGpu(rendered);
  expect(rendered).toMatchObject({
    example: "glb-viewer",
    phase: "render",
    renderingBackend: "webgpu-explicit",
    source: {
      ok: true,
      byteLength: expect.any(Number),
      status: {
        status: "loaded",
        sourceKind: "glb",
        diagnostics: [],
      },
      diagnostics: [],
    },
    gltf: {
      registration: { valid: true, diagnostics: 0 },
      primitiveMaterials: { valid: true, resolved: 1, diagnostics: 0 },
      commandPlan: { valid: true, dependencies: 2 },
      replay: { valid: true, diagnostics: 0 },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      diagnostics: 0,
    },
    draw: {
      packages: 1,
      drawCalls: 1,
    },
    orbit: {
      yaw: 0,
      distance: 3.4,
      dragging: false,
    },
  });

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  const clear =
    rendered?.clearColor === undefined
      ? { r: 4, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(rendered.clearColor);
  const center = strongestSample(screenshot, clear);

  expect(
    pixelDistance(center, clear),
    `GLB viewer canvas should contain non-clear pixels; sample=${JSON.stringify(
      center,
    )}`,
  ).toBeGreaterThan(20);

  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.mouse.move(880, 360, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      Math.abs(
        (
          globalThis as {
            readonly __APERTURE_EXAMPLE_STATUS__?: {
              readonly orbit?: {
                readonly yaw?: number;
                readonly dragging?: boolean;
              };
            };
          }
        ).__APERTURE_EXAMPLE_STATUS__?.orbit?.yaw ?? 0,
      ) > 0.2 &&
      ((
        globalThis as {
          readonly __APERTURE_EXAMPLE_STATUS__?: {
            readonly orbit?: { readonly dragging?: boolean };
          };
        }
      ).__APERTURE_EXAMPLE_STATUS__?.orbit?.dragging ?? true) === false,
  );
  const rotatedStatus = await waitForExampleStatus<GlbViewerStatus>(page);
  const rotatedScreenshot = await page.locator("#aperture-canvas").screenshot();

  expect(rotatedStatus?.orbit?.dragging).toBe(false);
  expect(rotatedStatus?.orbit?.yaw ?? 0).toBeLessThan(-0.2);
  expect(
    maxSampleDelta(screenshot, rotatedScreenshot),
    "dragging the GLB viewer should orbit the camera and change canvas pixels",
  ).toBeGreaterThan(12);
  webGpuValidation.expectNoWarnings();
});

function strongestSample(
  screenshot: Buffer,
  clear: ReturnType<typeof readPngPixel>,
): ReturnType<typeof readPngPixel> {
  let best = readPngPixel(screenshot, 0.5, 0.5);
  let bestDistance = pixelDistance(best, clear);

  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const sample = readPngPixel(
        screenshot,
        0.35 + (0.3 * x) / 6,
        0.3 + (0.4 * y) / 6,
      );
      const distance = pixelDistance(sample, clear);

      if (distance > bestDistance) {
        best = sample;
        bestDistance = distance;
      }
    }
  }

  return best;
}

function maxSampleDelta(before: Buffer, after: Buffer): number {
  let maxDelta = 0;

  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const xRatio = 0.35 + (0.3 * x) / 6;
      const yRatio = 0.3 + (0.4 * y) / 6;

      maxDelta = Math.max(
        maxDelta,
        pixelDistance(
          readPngPixel(before, xRatio, yRatio),
          readPngPixel(after, xRatio, yRatio),
        ),
      );
    }
  }

  return maxDelta;
}
