import { expect, test } from "@playwright/test";

import {
  attachWebGpuValidationConsoleGuard,
  expectedDiagnosticCounts,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";
import type {
  ExampleStatusBase,
  SceneReadbackStatus,
} from "./example-status-types.js";
import { pixelDistance } from "./png.js";

interface SplitScreenStatus extends ExampleStatusBase {
  readonly extraction: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly resources: {
    readonly materials: number;
    readonly bindGroups: number;
    readonly perViewBindGroups: number;
  };
  readonly binding: {
    readonly planned: number;
    readonly applied: number;
    readonly diagnostics: number;
  };
  readonly renderWorld: {
    readonly active: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly draw: {
    readonly packages: number;
    readonly descriptors: number;
    readonly drawList: number;
    readonly resolved: number;
  };
  readonly command: {
    readonly commands: number;
    readonly drawCount: number;
    readonly indexedDrawCount: number;
    readonly nonIndexedDrawCount: number;
  };
  readonly viewports: readonly {
    readonly viewId: number;
    readonly viewportPixels: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly scissorPixels: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
  }[];
  readonly viewPasses: readonly {
    readonly viewId: number;
    readonly commands: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  }[];
  readonly submission: {
    readonly commandBuffers: number;
    readonly viewPasses: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
  readonly renderControl: {
    readonly capabilities: {
      readonly status: boolean;
      readonly warnings: boolean;
      readonly screenshot: boolean;
      readonly pause: boolean;
      readonly resume: boolean;
      readonly step: boolean;
      readonly scenario: boolean;
      readonly snapshot: boolean;
      readonly readback: boolean;
    };
  };
}

test("split-screen route submits two ECS camera views with distinct pixels", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<SplitScreenStatus>(
    page,
    "/examples/split-screen-multi-camera.html",
    "split-screen-multi-camera-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "split-screen-multi-camera",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 2, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, perViewBindGroups: 2 },
    binding: { planned: 4, applied: 4, diagnostics: 0 },
    renderWorld: { active: 4, ready: 4, blocked: 0 },
    draw: { packages: 4, descriptors: 4, drawList: 4, resolved: 4 },
    command: {
      drawCount: 4,
      indexedDrawCount: 4,
      nonIndexedDrawCount: 0,
    },
    submission: {
      commandBuffers: 1,
      viewPasses: 2,
      drawCalls: 4,
      indexedDrawCalls: 4,
    },
    renderControl: {
      capabilities: {
        status: true,
        warnings: true,
        screenshot: true,
        pause: false,
        resume: false,
        step: false,
        scenario: false,
        snapshot: true,
        readback: false,
      },
    },
  });
  expect(status.viewports).toHaveLength(2);
  expect(status.viewports.map((viewport) => viewport.viewportPixels)).toEqual([
    { x: 0, y: 0, width: 480, height: 540 },
    { x: 480, y: 0, width: 480, height: 540 },
  ]);
  expect(status.viewports.map((viewport) => viewport.scissorPixels)).toEqual([
    { x: 0, y: 0, width: 480, height: 540 },
    { x: 480, y: 0, width: 480, height: 540 },
  ]);
  expect(status.viewPasses).toHaveLength(2);
  expect(status.viewPasses.every((pass) => pass.drawCalls === 2)).toBe(true);
  expectStatusJsonSafeForGpu(status);

  test.skip(
    status.readback.ok !== true,
    status.readback.ok
      ? ""
      : `Current-texture readback unavailable: ${status.readback.reason}`,
  );

  if (!status.readback.ok) {
    return;
  }

  expect(status.diagnosticCounts).toEqual(expectedDiagnosticCounts({}));

  const left = status.readback.samples.find(
    (sample) => sample.id === "left-center",
  );
  const right = status.readback.samples.find(
    (sample) => sample.id === "right-center",
  );

  expect(left, JSON.stringify(status.readback, null, 2)).toBeDefined();
  expect(right, JSON.stringify(status.readback, null, 2)).toBeDefined();

  if (left === undefined || right === undefined) {
    return;
  }

  const clearPixel = { r: 4, g: 6, b: 9, a: 255 };

  expect(pixelDistance(left.pixel, right.pixel)).toBeGreaterThan(120);
  expect(pixelDistance(left.pixel, clearPixel)).toBeGreaterThan(40);
  expect(pixelDistance(right.pixel, clearPixel)).toBeGreaterThan(40);
  validationGuard.expectNoWarnings();
});

test("split-screen renders two camera views through the single-encoder FrameGraph (M3-T4)", async ({
  page,
}) => {
  // M3-T4 Done-when #2: ?graph=1 merges the two camera submissions into ONE
  // command buffer; the two views must still render distinct, non-clear pixels.
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<SplitScreenStatus>(
    page,
    "/examples/split-screen-multi-camera.html?graph=1",
    "split-screen-multi-camera-graph-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status.ok).toBe(true);
  expectStatusJsonSafeForGpu(status);

  test.skip(
    status.readback.ok !== true,
    status.readback.ok ? "" : "Current-texture readback unavailable",
  );
  if (!status.readback.ok) {
    return;
  }

  const left = status.readback.samples.find(
    (sample) => sample.id === "left-center",
  );
  const right = status.readback.samples.find(
    (sample) => sample.id === "right-center",
  );
  expect(left, "left-center graph sample should exist").toBeDefined();
  expect(right, "right-center graph sample should exist").toBeDefined();
  if (left === undefined || right === undefined) {
    return;
  }

  const clearPixel = { r: 4, g: 6, b: 9, a: 255 };
  expect(pixelDistance(left.pixel, right.pixel)).toBeGreaterThan(120);
  expect(pixelDistance(left.pixel, clearPixel)).toBeGreaterThan(40);
  expect(pixelDistance(right.pixel, clearPixel)).toBeGreaterThan(40);
  validationGuard.expectNoWarnings();
});
