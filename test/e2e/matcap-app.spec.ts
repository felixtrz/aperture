import { expect, test, type Page } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface MatcapAppStatus extends ExampleStatusBase {
  readonly materialModel?: string;
  readonly clearColor?: unknown;
  readonly extraction?: {
    readonly views: number;
    readonly meshDraws: number;
    readonly lights: number;
    readonly diagnostics: number;
  };
  readonly material?: {
    readonly kind: string;
    readonly key: string;
    readonly baseColorFactor: readonly number[];
    readonly matcapTexture: string;
    readonly matcapSampler: string;
  };
  readonly pipeline?: {
    readonly key: string | null;
    readonly cacheKey: string | null;
  };
  readonly resources?: {
    readonly materials: number;
    readonly bindGroups: number;
    readonly materialBindGroup: number;
    readonly reuse?: {
      readonly pipelineHits: number;
      readonly pipelineMisses: number;
      readonly meshBuffersCreated: number;
      readonly meshBuffersReused: number;
      readonly materialBuffersCreated: number;
      readonly materialBuffersReused: number;
      readonly textureResourcesCreated: number;
      readonly textureResourcesReused: number;
      readonly samplerResourcesCreated: number;
      readonly samplerResourcesReused: number;
      readonly bindGroupsCreated: number;
      readonly bindGroupsReused: number;
      readonly dynamicBufferWrites: number;
    };
  };
  readonly draw?: {
    readonly packages: number;
    readonly commands: number;
    readonly drawCalls: number;
  };
  readonly command?: {
    readonly commands: number;
    readonly drawCount: number;
    readonly indexedDrawCount: number;
  };
  readonly submission?: {
    readonly commandBuffers: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly execution?: {
    readonly running: boolean;
    readonly ecs: string;
  };
  readonly animation?: {
    readonly frames: number;
    readonly elapsedSeconds: number;
    readonly rotationRadians: number;
    readonly radiansPerSecond: number;
    readonly spinAxis: readonly number[];
    readonly transformDiagnostics: number;
  };
  readonly report?: {
    readonly ok: boolean;
    readonly counts: {
      readonly views: number;
      readonly meshDraws: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
    readonly diagnostics: readonly unknown[];
    readonly resourceReuse: Record<string, number>;
  };
}

test("Playwright shows an ECS-authored MatcapMaterial app facade cube", async ({
  page,
}) => {
  await page.goto("/examples/matcap-app.html");

  const initialStatus = await waitForExampleStatus<MatcapAppStatus>(page);

  await attachExampleStatus("matcap-app-initial-status", initialStatus);
  expect(initialStatus, "matcap app status should publish").toBeDefined();

  if (initialStatus === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(initialStatus);
  expectStatusJsonSafeForGpu(initialStatus);

  expect(initialStatus, JSON.stringify(initialStatus, null, 2)).toMatchObject({
    example: "matcap-app",
    materialModel: "matcap-app-facade",
    ok: true,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 0, diagnostics: 0 },
    material: {
      kind: "matcap",
      key: "material:matcap-app-material",
      matcapTexture: "texture:matcap-app-studio",
      matcapSampler: "sampler:matcap-app-linear",
    },
    pipeline: { key: "matcap|matcapTexture|opaque|back|less|none" },
    resources: { materials: 1, bindGroups: 3, materialBindGroup: 1 },
    draw: { packages: 1, drawCalls: 1 },
    command: { drawCount: 1, indexedDrawCount: 1 },
    submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
    execution: { running: true, ecs: "stepping" },
    report: {
      ok: true,
      counts: { views: 1, meshDraws: 1, drawCalls: 1, diagnostics: 0 },
      diagnostics: [],
    },
  });
  expect(initialStatus.report?.resourceReuse).toBeDefined();

  const firstAnimatedStatus = await waitForAnimationFrame(page, 3);
  const firstFrame = firstAnimatedStatus.animation?.frames ?? 0;
  const firstRotation = firstAnimatedStatus.animation?.rotationRadians ?? 0;
  const firstScreenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("matcap-app-frame-a.png", {
    body: firstScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus("matcap-app-frame-a-status", firstAnimatedStatus);
  expectStatusJsonSafeForGpu(firstAnimatedStatus);
  expectNonBackgroundPixel(firstScreenshot, firstAnimatedStatus);

  const laterStatus = await waitForAnimationRotation(
    page,
    firstFrame + 8,
    firstRotation + 0.25,
  );
  const laterScreenshot = await page.locator("#aperture-canvas").screenshot();

  await test.info().attach("matcap-app-frame-b.png", {
    body: laterScreenshot,
    contentType: "image/png",
  });
  await attachExampleStatus("matcap-app-frame-b-status", laterStatus);
  expectStatusJsonSafeForGpu(laterStatus);

  expect(
    laterStatus.resources?.reuse?.pipelineHits ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBe(1);
  expect(
    laterStatus.resources?.reuse?.textureResourcesReused ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBe(1);
  expect(
    laterStatus.resources?.reuse?.samplerResourcesReused ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBe(1);
  expect(
    laterStatus.report?.resourceReuse.bindGroupsReused ?? 0,
    JSON.stringify(laterStatus, null, 2),
  ).toBe(3);
  expectNonBackgroundPixel(laterScreenshot, laterStatus);

  await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();

  await page.getByRole("button", { name: "Pause" }).click();

  const pausedStatus = await waitForPausedExecution(page);
  const pausedFrame = pausedStatus.animation?.frames ?? 0;
  const pausedRotation = pausedStatus.animation?.rotationRadians ?? 0;

  expect(pausedStatus).toMatchObject({
    ok: true,
    phase: "paused",
    execution: { running: false, ecs: "paused" },
  });
  await expect(page.getByRole("button", { name: "Play" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Pause" })).toBeDisabled();

  await page.waitForTimeout(200);

  const stillPausedStatus = await readExampleStatus(page);

  expect(stillPausedStatus.animation?.frames).toBe(pausedFrame);
  expect(stillPausedStatus.animation?.rotationRadians).toBe(pausedRotation);

  await page.getByRole("button", { name: "Play" }).click();

  const resumedStatus = await waitForAnimationFrame(page, pausedFrame + 1);

  expect(resumedStatus.execution).toMatchObject({
    running: true,
    ecs: "stepping",
  });
  expect(resumedStatus.animation?.frames ?? 0).toBeGreaterThan(pausedFrame);
  await expect(page.getByRole("button", { name: "Play" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Pause" })).toBeEnabled();
});

function expectNonBackgroundPixel(
  screenshot: Buffer,
  status: MatcapAppStatus,
): void {
  const center = readPngPixel(screenshot, 0.5, 0.5);
  const clear =
    status.clearColor !== undefined &&
    typeof status.clearColor === "object" &&
    status.clearColor !== null
      ? rgbaColorToPixel(
          status.clearColor as { r: number; g: number; b: number; a: number },
        )
      : { r: 199, g: 209, b: 219, a: 255 };

  expect(
    pixelDistance(center, clear),
    `center pixel should differ from clear color; center=${JSON.stringify(center)} clear=${JSON.stringify(clear)}`,
  ).toBeGreaterThan(40);
}

async function waitForAnimationFrame(
  page: Page,
  targetFrame: number,
): Promise<MatcapAppStatus> {
  await page.waitForFunction((frame) => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: MatcapAppStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return status?.ok === true && (status.animation?.frames ?? 0) >= frame;
  }, targetFrame);

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__: MatcapAppStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

async function waitForAnimationRotation(
  page: Page,
  targetFrame: number,
  targetRotation: number,
): Promise<MatcapAppStatus> {
  await page.waitForFunction(
    ({ frame, rotation }) => {
      const status = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__?: MatcapAppStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__;

      return (
        status?.ok === true &&
        (status.animation?.frames ?? 0) >= frame &&
        (status.animation?.rotationRadians ?? 0) >= rotation
      );
    },
    { frame: targetFrame, rotation: targetRotation },
  );

  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__: MatcapAppStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}

async function waitForPausedExecution(page: Page): Promise<MatcapAppStatus> {
  await page.waitForFunction(() => {
    const status = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_EXAMPLE_STATUS__?: MatcapAppStatus;
      }
    ).__APERTURE_EXAMPLE_STATUS__;

    return (
      status?.ok === true &&
      status.phase === "paused" &&
      status.execution?.running === false
    );
  });

  return readExampleStatus(page);
}

async function readExampleStatus(page: Page): Promise<MatcapAppStatus> {
  return page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          readonly __APERTURE_EXAMPLE_STATUS__: MatcapAppStatus;
        }
      ).__APERTURE_EXAMPLE_STATUS__,
  );
}
