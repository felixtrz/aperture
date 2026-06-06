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

interface PhysicsWorkerModeStatus extends ExampleStatusBase {
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
    readonly transport?: {
      readonly mode: string;
      readonly submittedFixedStep: number;
      readonly completedFixedStep: number;
      readonly latencyFrames: number;
      readonly transferBytes: number;
      readonly structuredCloneBytes: number;
      readonly totalResultBytes: number;
      readonly resultBodyBytes: number;
      readonly resultSleepingBytes: number;
      readonly resultEventCount: number;
    };
    readonly commands?: {
      readonly commandCount: number;
      readonly upsertBodyCount: number;
      readonly destroyBodyCount: number;
      readonly upsertJointCount: number;
      readonly destroyJointCount: number;
      readonly otherCommandCount: number;
    };
    readonly debug?: {
      readonly lineCount: number;
      readonly rayProbeCount: number;
      readonly contactNormalCount: number;
      readonly bodyStateMarkerCount: number;
      readonly activeBodyMarkerCount: number;
      readonly sleepingBodyMarkerCount: number;
      readonly rendered: boolean;
      readonly meshKey: string;
      readonly materialKey: string;
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
  readonly worker?: {
    readonly running: boolean;
    readonly snapshotsReceived: number;
    readonly scene?: {
      readonly backend: string;
      readonly backendVersion: string;
      readonly backendBuild: string;
      readonly execution: string;
      readonly physicsWorker?: {
        readonly backend: string;
        readonly backendVersion: string;
        readonly backendBuild: string;
        readonly execution: string;
      };
      readonly dynamicBodyCount: number;
    };
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

test("browser settles ECS bodies through a dedicated transferable physics worker", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/physics-worker-mode.html");

  const status = await waitForExampleStatus<PhysicsWorkerModeStatus>(page);

  await attachExampleStatus("physics-worker-mode-status", status);
  expect(status, "physics worker-mode status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "physics-worker-mode",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    physics: {
      backend: "rapier",
      backendVersion: "0.19.3",
      backendBuild: "performance",
      execution: "physics-worker-transferable",
      settled: true,
      transport: {
        mode: "physics-worker-transferable",
        latencyFrames: 0,
      },
    },
    worker: {
      running: true,
      snapshotsReceived: 1,
      scene: {
        backend: "rapier",
        backendVersion: "0.19.3",
        backendBuild: "performance",
        execution: "physics-worker-transferable",
        physicsWorker: {
          backend: "rapier",
          backendVersion: "0.19.3",
          backendBuild: "performance",
          execution: "physics-worker-transferable",
        },
        dynamicBodyCount: 4,
      },
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
  expect(status.frame?.snapshot?.meshDraws).toBeGreaterThanOrEqual(5);
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
    contactNormalCount: 0,
    bodyStateMarkerCount: 4,
    meshKey: "mesh:physics-settling-debug-wireframes",
    materialKey: "material:physics-settling-debug-wireframe",
  });
  expect(status.physics?.debug?.lineCount).toBeGreaterThan(0);
  expect(
    (status.physics?.debug?.activeBodyMarkerCount ?? 0) +
      (status.physics?.debug?.sleepingBodyMarkerCount ?? 0),
  ).toBe(status.physics?.debug?.bodyStateMarkerCount);
  expect(status.physics?.debug?.sleepingBodyMarkerCount).toBeGreaterThan(0);
  expect(status.physics?.bodies).toHaveLength(4);
  expect(status.physics?.minDrop).toBeGreaterThan(2.0);
  expect(status.physics?.maxSpeed).toBeLessThanOrEqual(0.45);

  expect(status.physics?.transport?.submittedFixedStep).toBe(
    status.physics?.fixedStepsRun,
  );
  expect(status.physics?.transport?.completedFixedStep).toBe(
    status.physics?.fixedStepsRun,
  );
  expect(status.physics?.transport?.transferBytes).toBeGreaterThan(0);
  expect(status.physics?.transport?.structuredCloneBytes).toBeGreaterThan(0);
  expect(status.physics?.transport?.totalResultBytes).toBeGreaterThanOrEqual(
    status.physics?.transport?.transferBytes ?? 0,
  );
  expect(status.physics?.transport?.resultBodyBytes).toBeGreaterThan(0);
  expect(status.physics?.transport?.resultSleepingBytes).toBe(
    status.physics?.bodyCount,
  );
  expect(status.physics?.transport?.resultEventCount).toBeGreaterThanOrEqual(0);
  expect(status.physics?.commands).toMatchObject({
    commandCount: 5,
    upsertBodyCount: 5,
    destroyBodyCount: 0,
    upsertJointCount: 0,
    destroyJointCount: 0,
    otherCommandCount: 0,
  });

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
