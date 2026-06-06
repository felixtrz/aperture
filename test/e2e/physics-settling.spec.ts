import { expect, test } from "@playwright/test";

import { pixelDistance, readPngPixel, rgbaColorToPixel } from "./png.js";
import {
  attachExampleStatus,
  attachWebGpuValidationConsoleGuard,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface PhysicsSettlingStatus extends ExampleStatusBase {
  readonly physics?: {
    readonly backend: string;
    readonly backendVersion: string;
    readonly backendBuild: string;
    readonly execution: string;
    readonly fixedDelta: number;
    readonly fixedStepsRun: number;
    readonly bodyCount: number;
    readonly colliderCount: number;
    readonly eventCount: number;
    readonly queryCount: number;
    readonly transformWrites: number;
    readonly velocityWrites: number;
    readonly bodyStateWrites: number;
    readonly timings: {
      readonly syncToBackendMs: number;
      readonly backendStepMs: number;
      readonly writebackMs: number;
    };
    readonly maxSpeed: number;
    readonly minDrop: number;
    readonly settled: boolean;
    readonly debug?: {
      readonly lineCount: number;
      readonly summary?: {
        readonly lineCount: number;
        readonly finiteLineCount: number;
        readonly invalidLineCount: number;
        readonly colorCount: number;
        readonly colors: readonly {
          readonly color: readonly [number, number, number, number];
          readonly lineCount: number;
        }[];
        readonly bounds: {
          readonly min: readonly [number, number, number];
          readonly max: readonly [number, number, number];
        } | null;
      };
      readonly rayProbeCount: number;
      readonly contactNormalCount: number;
      readonly bodyStateMarkerCount: number;
      readonly activeBodyMarkerCount: number;
      readonly sleepingBodyMarkerCount: number;
      readonly rendered: boolean;
      readonly meshKey: string;
      readonly materialKey: string;
      readonly materialKeys: Record<string, string>;
    };
    readonly bodies: readonly {
      readonly id: string;
      readonly initialY: number;
      readonly y: number;
      readonly drop: number;
      readonly speed: number;
      readonly expectedMinDrop: number;
    }[];
  };
  readonly frame?: {
    readonly snapshot?: {
      readonly views: number;
      readonly meshDraws: number;
      readonly diagnostics: number;
    };
    readonly counts?: {
      readonly meshDraws: number;
      readonly drawCalls: number;
      readonly diagnostics: number;
    };
    readonly readback?: {
      readonly ok: boolean;
      readonly reason?: string;
      readonly message?: string;
      readonly samples?: readonly {
        readonly id: string;
        readonly pixel: {
          readonly r: number;
          readonly g: number;
          readonly b: number;
          readonly a: number;
        };
      }[];
    };
  };
}

test("browser renders Rapier-settled ECS bodies from a simulation worker", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/physics-settling.html");

  const status = await waitForExampleStatus<PhysicsSettlingStatus>(page);

  await attachExampleStatus("physics-settling-status", status);
  expect(status, "physics settling status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "physics-settling",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    physics: {
      backend: "rapier",
      backendVersion: "0.19.3",
      backendBuild: "performance",
      execution: "simulation-worker",
      settled: true,
    },
    frame: {
      snapshot: {
        views: 1,
        diagnostics: 0,
      },
      counts: {
        diagnostics: 0,
      },
    },
  });
  expect(status.frame?.snapshot?.meshDraws).toBeGreaterThanOrEqual(8);
  expect(status.frame?.counts?.meshDraws).toBe(
    status.frame?.snapshot?.meshDraws,
  );
  expect(status.frame?.counts?.drawCalls).toBe(
    status.frame?.snapshot?.meshDraws,
  );

  expect(status.physics?.fixedStepsRun).toBeGreaterThanOrEqual(480);
  expect(status.physics?.bodyCount).toBe(5);
  expect(status.physics?.colliderCount).toBe(5);
  expect(status.physics?.eventCount).toBeGreaterThanOrEqual(0);
  expect(status.physics?.queryCount).toBeGreaterThanOrEqual(0);
  expect(status.physics?.transformWrites).toBe(5);
  expect(status.physics?.velocityWrites).toBe(4);
  expect(status.physics?.bodyStateWrites).toBe(5);
  expect(status.physics?.timings?.syncToBackendMs).toBeGreaterThanOrEqual(0);
  expect(status.physics?.timings?.backendStepMs).toBeGreaterThanOrEqual(0);
  expect(status.physics?.timings?.writebackMs).toBeGreaterThanOrEqual(0);
  expect(status.physics?.debug).toMatchObject({
    rendered: true,
    rayProbeCount: 1,
    bodyStateMarkerCount: 5,
    meshKey: "mesh:physics-settling-debug-wireframes",
    materialKey: "material:physics-settling-debug-wireframe",
    materialKeys: {
      collider: "material:physics-settling-debug-wireframe",
      contactNormal: "material:physics-settling-debug-contact-normal",
      rayHit: "material:physics-settling-debug-ray-hit",
      rayMiss: "material:physics-settling-debug-ray-miss",
      activeBody: "material:physics-settling-debug-active-body",
      sleepingBody: "material:physics-settling-debug-sleeping-body",
    },
  });
  expect(status.physics?.debug?.lineCount).toBeGreaterThan(0);
  expect(status.physics?.debug?.summary).toMatchObject({
    lineCount: status.physics?.debug?.lineCount,
    finiteLineCount: status.physics?.debug?.lineCount,
    invalidLineCount: 0,
  });
  expect(status.physics?.debug?.summary?.colorCount).toBeGreaterThanOrEqual(4);
  expect(
    hasDebugColor(status.physics?.debug?.summary, [1, 0.2, 0.12, 1]),
    "debug summary should include contact-normal lines",
  ).toBe(true);
  expect(
    hasDebugColor(status.physics?.debug?.summary, [1, 0.86, 0.12, 1]),
    "debug summary should include ray-hit lines",
  ).toBe(true);
  expect(
    status.physics?.debug?.summary?.bounds?.min.every(Number.isFinite),
    "debug summary min bounds should stay JSON-safe and finite",
  ).toBe(true);
  expect(
    status.physics?.debug?.summary?.bounds?.max.every(Number.isFinite),
    "debug summary max bounds should stay JSON-safe and finite",
  ).toBe(true);
  expect(status.physics?.debug?.contactNormalCount).toBeGreaterThan(0);
  expect(
    (status.physics?.debug?.activeBodyMarkerCount ?? 0) +
      (status.physics?.debug?.sleepingBodyMarkerCount ?? 0),
  ).toBe(status.physics?.debug?.bodyStateMarkerCount);
  expect(status.physics?.debug?.sleepingBodyMarkerCount).toBeGreaterThan(0);
  expect(status.physics?.bodies).toHaveLength(4);
  expect(status.physics?.minDrop).toBeGreaterThan(2.0);
  expect(status.physics?.maxSpeed).toBeLessThanOrEqual(0.45);

  for (const body of status.physics?.bodies ?? []) {
    expect(body.drop, `${body.id} should fall under gravity`).toBeGreaterThan(
      body.expectedMinDrop,
    );
    expect(body.y, `${body.id} should remain above the ground`).toBeGreaterThan(
      0.35,
    );
  }

  const screenshot = await page.locator("#aperture-canvas").screenshot();
  assertSettledPixels(screenshot);
  webGpuValidation.expectNoWarnings();
});

function hasDebugColor(
  summary:
    | NonNullable<
        NonNullable<PhysicsSettlingStatus["physics"]>["debug"]
      >["summary"]
    | undefined,
  color: readonly [number, number, number, number],
): boolean {
  return (
    summary?.colors.some((entry) =>
      Math.abs(entry.color[0] - color[0]) < 0.0001 &&
      Math.abs(entry.color[1] - color[1]) < 0.0001 &&
      Math.abs(entry.color[2] - color[2]) < 0.0001 &&
      Math.abs(entry.color[3] - color[3]) < 0.0001,
    ) ?? false
  );
}

function assertSettledPixels(screenshot: Buffer): void {
  const clear = rgbaColorToPixel({ r: 0.012, g: 0.017, b: 0.025, a: 1 });
  const background = readPngPixel(screenshot, 0.08, 0.16);
  const ground = readPngPixel(screenshot, 0.5, 0.91);
  const stackLower = readPngPixel(screenshot, 0.5, 0.8);
  const stackMiddle = readPngPixel(screenshot, 0.5, 0.61);
  const stackUpper = readPngPixel(screenshot, 0.5, 0.41);

  expect(pixelDistance(background, clear)).toBeLessThan(35);
  expect(pixelDistance(ground, clear)).toBeGreaterThan(45);

  for (const [id, pixel] of [
    ["stack-lower", stackLower],
    ["stack-middle", stackMiddle],
    ["stack-upper", stackUpper],
  ] as const) {
    expect(
      pixelDistance(pixel, clear),
      `${id} should hit a settled physics body`,
    ).toBeGreaterThan(45);
  }
}
