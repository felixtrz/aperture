import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface SabCubeStatus extends ExampleStatusBase {
  readonly workerModel?: string;
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly crossOriginIsolated?: boolean;
  readonly transport?: {
    readonly requested: string;
    readonly mode: string;
    readonly fallback: string | null;
    readonly sharedArrayBufferSupported: boolean;
    readonly write?: {
      readonly frame: number;
      readonly transformFloats: number;
      readonly viewMatrixFloats: number;
      readonly packetWords: number;
    } | null;
    readonly packetRegistry?: {
      readonly strings: number;
      readonly handles: number;
      readonly wordLength: number;
      readonly byteLength: number;
    } | null;
    readonly microbenchmark?: {
      readonly entities: number;
      readonly transferableBytesAt10k: number;
      readonly sharedArrayBufferPerFrameBytes: number;
      readonly reductionRatio: number;
    } | null;
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly drawCalls: number;
  } | null;
  readonly worker?: {
    readonly running: boolean;
    readonly scene?: {
      readonly meshKey: string;
      readonly materialKey: string;
      readonly materialKind: string;
    } | null;
  };
  readonly material?: {
    readonly meshKey: string;
    readonly materialKey: string;
    readonly workerMeshKey: string | null;
    readonly workerMaterialKey: string | null;
  };
  readonly draw?: {
    readonly drawCalls: number;
  };
  readonly animation?: {
    readonly frames: number;
    readonly rotationRadians: number;
  } | null;
}

test("SAB cube renders worker snapshots through shared buffers", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/sab-cube.html");

  const initialStatus = await waitForExampleStatus<SabCubeStatus>(page);

  await attachExampleStatus("sab-cube-initial-status", initialStatus);
  expect(initialStatus, "SAB cube status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  expectStatusJsonSafeForGpu(initialStatus);
  expect(initialStatus, JSON.stringify(initialStatus, null, 2)).toMatchObject({
    example: "sab-cube",
    workerModel: "ecs-extraction-worker-shared-array-buffer-snapshot",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    crossOriginIsolated: true,
    transport: {
      requested: "shared-array-buffer",
      mode: "shared-array-buffer",
      fallback: null,
      sharedArrayBufferSupported: true,
    },
    worker: {
      running: true,
      scene: {
        meshKey: "mesh:sab-cube",
        materialKey: "material:sab-cube-debug-normal",
        materialKind: "debug-normal",
      },
    },
    material: {
      meshKey: "mesh:sab-cube",
      materialKey: "material:sab-cube-debug-normal",
      workerMeshKey: "mesh:sab-cube",
      workerMaterialKey: "material:sab-cube-debug-normal",
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      drawCalls: 1,
    },
    draw: { drawCalls: 1 },
  });
  expect(initialStatus.transport?.write?.packetWords ?? 0).toBeGreaterThan(0);
  expect(initialStatus.transport?.packetRegistry?.handles ?? 0).toBeGreaterThan(
    0,
  );
  expect(
    initialStatus.transport?.microbenchmark?.reductionRatio ?? 0,
  ).toBeGreaterThanOrEqual(0.95);
  expect(
    initialStatus.transport?.microbenchmark?.transferableBytesAt10k ?? 0,
  ).toBeGreaterThan(2_000_000);

  const firstStatus = await waitForSabFrame(page, 3, 0.08);
  const firstFrame = firstStatus.animation?.frames ?? 0;
  const firstRotation = firstStatus.animation?.rotationRadians ?? 0;
  const firstScreenshot = await page.locator("#aperture-canvas").screenshot();
  const firstCenter = readPngPixel(firstScreenshot, 0.5, 0.5);

  await test.info().attach("sab-cube-frame-a.png", {
    body: firstScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus("sab-cube-frame-a-status", firstStatus);
  expectStatusJsonSafeForGpu(firstStatus);
  expectNonClearCenter(firstCenter, firstStatus);

  const laterStatus = await waitForSabFrame(
    page,
    firstFrame + 18,
    firstRotation + 0.55,
  );
  const laterScreenshot = await page.locator("#aperture-canvas").screenshot();
  const laterCenter = readPngPixel(laterScreenshot, 0.5, 0.5);

  await test.info().attach("sab-cube-frame-b.png", {
    body: laterScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus("sab-cube-frame-b-status", laterStatus);
  expectStatusJsonSafeForGpu(laterStatus);

  expect(
    pixelDistance(firstCenter, laterCenter),
    `center pixel should change after SAB worker-side ECS spin: first=${JSON.stringify(
      firstCenter,
    )} later=${JSON.stringify(laterCenter)}`,
  ).toBeGreaterThan(8);

  guard.expectNoWarnings();
});

async function waitForSabFrame(
  page: Page,
  minFrame: number,
  minRotation: number,
): Promise<SabCubeStatus> {
  await page.waitForFunction(
    ({ frame, rotation }) => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: SabCubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true &&
        (status.animation?.frames ?? 0) >= frame &&
        (status.animation?.rotationRadians ?? 0) >= rotation
      );
    },
    { frame: minFrame, rotation: minRotation },
  );

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__: SabCubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function expectNonClearCenter(
  center: ReturnType<typeof readPngPixel>,
  status: SabCubeStatus,
): void {
  const clear =
    status.clearColor === undefined
      ? { r: 5, g: 6, b: 9, a: 255 }
      : rgbaColorToPixel(status.clearColor);

  expect(
    pixelDistance(center, clear),
    `center pixel should differ from clear color; center=${JSON.stringify(center)} clear=${JSON.stringify(clear)}`,
  ).toBeGreaterThan(36);
}
