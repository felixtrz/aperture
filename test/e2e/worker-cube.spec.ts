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

interface WorkerCubeStatus extends ExampleStatusBase {
  readonly workerModel?: string;
  readonly clearColor?: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
  };
  readonly worker?: {
    readonly running: boolean;
    readonly scene?: {
      readonly meshKey: string;
      readonly materialKey: string;
      readonly materialKind: string;
    } | null;
  };
  readonly transport?: {
    readonly mode: string;
    readonly jsonRoundTrip: boolean;
    readonly snapshotsReceived: number;
    readonly typedArraysPreserved: {
      readonly transforms: boolean;
      readonly viewMatrices: boolean;
      readonly viewsArray: boolean;
      readonly meshDrawsArray: boolean;
      readonly diagnosticsArray: boolean;
    };
  };
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly environments: number;
    readonly diagnostics: number;
  };
  readonly material?: {
    readonly kind: string;
    readonly meshKey: string;
    readonly materialKey: string;
    readonly workerMeshKey: string | null;
    readonly workerMaterialKey: string | null;
    readonly pipelineKey: string | null;
  };
  readonly draw?: {
    readonly drawCalls: number;
  };
  readonly rendererUpdate?: {
    readonly fullRefresh: boolean;
    readonly incremental: boolean;
    readonly byFamily: Record<
      string,
      {
        readonly action: string;
        readonly changed: number;
        readonly unchanged: number;
        readonly removed: number;
        readonly refreshes: number;
        readonly reuses: number;
        readonly removals: number;
      }
    >;
    readonly total: {
      readonly packetRefreshes: number;
      readonly packetReuses: number;
      readonly packetRemovals: number;
      readonly packetWork: number;
    };
  } | null;
  readonly animation?: {
    readonly frames: number;
    readonly rotationRadians: number;
  };
}

test("worker cube renders snapshots produced by worker ECS extraction", async ({
  page,
}) => {
  const guard = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/worker-cube.html");

  const initialStatus = await waitForExampleStatus<WorkerCubeStatus>(page);

  await attachExampleStatus("worker-cube-initial-status", initialStatus);
  expect(initialStatus, "worker cube status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  expectStatusJsonSafeForGpu(initialStatus);
  expect(initialStatus, JSON.stringify(initialStatus, null, 2)).toMatchObject({
    example: "worker-cube",
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    worker: {
      running: true,
      scene: {
        meshKey: "mesh:worker-cube",
        materialKey: "material:worker-cube-debug-normal",
        materialKind: "debug-normal",
      },
    },
    transport: {
      mode: "structured-clone-postMessage",
      jsonRoundTrip: false,
      typedArraysPreserved: {
        transforms: true,
        viewMatrices: true,
        viewsArray: true,
        meshDrawsArray: true,
        diagnosticsArray: true,
      },
    },
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 0,
      environments: 0,
      diagnostics: 0,
    },
    material: {
      kind: "debug-normal",
      meshKey: "mesh:worker-cube",
      materialKey: "material:worker-cube-debug-normal",
      workerMeshKey: "mesh:worker-cube",
      workerMaterialKey: "material:worker-cube-debug-normal",
      pipelineKey: "debug-normal|opaque|back|less|none",
    },
    draw: { drawCalls: 1 },
  });

  const firstStatus = await waitForWorkerFrame(page, 3, 0.08);
  const firstFrame = firstStatus.animation?.frames ?? 0;
  const firstRotation = firstStatus.animation?.rotationRadians ?? 0;
  const firstScreenshot = await page.locator("#aperture-canvas").screenshot();
  const firstCenter = readPngPixel(firstScreenshot, 0.5, 0.5);

  await test.info().attach("worker-cube-frame-a.png", {
    body: firstScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus("worker-cube-frame-a-status", firstStatus);
  expectStatusJsonSafeForGpu(firstStatus);
  expectNonClearCenter(firstCenter, firstStatus);

  const laterStatus = await waitForWorkerFrame(
    page,
    firstFrame + 18,
    firstRotation + 0.55,
  );
  const laterScreenshot = await page.locator("#aperture-canvas").screenshot();
  const laterCenter = readPngPixel(laterScreenshot, 0.5, 0.5);

  await test.info().attach("worker-cube-frame-b.png", {
    body: laterScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus("worker-cube-frame-b-status", laterStatus);
  expectStatusJsonSafeForGpu(laterStatus);

  expect(
    pixelDistance(firstCenter, laterCenter),
    `center pixel should change after worker-side ECS spin: first=${JSON.stringify(
      firstCenter,
    )} later=${JSON.stringify(laterCenter)}`,
  ).toBeGreaterThan(8);
  expect(laterStatus.transport?.snapshotsReceived ?? 0).toBeGreaterThan(
    firstStatus.transport?.snapshotsReceived ?? 0,
  );
  expect(laterStatus.rendererUpdate?.incremental).toBe(true);
  expect(laterStatus.rendererUpdate?.byFamily.views).toMatchObject({
    action: "reuse",
    unchanged: 1,
    reuses: 1,
  });
  expect(laterStatus.rendererUpdate?.total.packetReuses ?? 0).toBeGreaterThan(
    0,
  );

  guard.expectNoWarnings();
});

async function waitForWorkerFrame(
  page: Page,
  minFrame: number,
  minRotation: number,
): Promise<WorkerCubeStatus> {
  await page.waitForFunction(
    ({ frame, rotation }) => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: WorkerCubeStatus;
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
          readonly __APERTURE_EXAMPLE_STATUS__: WorkerCubeStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

function expectNonClearCenter(
  center: ReturnType<typeof readPngPixel>,
  status: WorkerCubeStatus,
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
