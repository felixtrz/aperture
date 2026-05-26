import { expect, test } from "@playwright/test";

import type {
  ExampleStatusBase,
  SceneReadbackStatus,
} from "./example-status-types.js";
import { pixelDistance, rgbaColorToPixel } from "./png.js";
import {
  attachWebGpuValidationConsoleGuard,
  expectedDiagnosticCounts,
  expectStatusJsonSafeForGpu,
  loadExampleStatus,
} from "./webgpu-status.js";

const cyan = { r: 0.05, g: 0.85, b: 1, a: 1 };
const amber = { r: 1, g: 0.62, b: 0.08, a: 1 };

interface LinePrimitivesStatus extends ExampleStatusBase {
  readonly clearColor?: typeof cyan;
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
    readonly drawCount: number;
    readonly indexedDrawCount: number;
    readonly nonIndexedDrawCount: number;
  };
  readonly submission: {
    readonly commandBuffers: number;
    readonly viewPasses: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly viewports: readonly {
    readonly viewportPixels: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
  }[];
  readonly linePrimitives: {
    readonly topology: "line-list";
    readonly sets: number;
    readonly materialSlots: number;
    readonly lineSegments: number;
    readonly indexed: boolean;
    readonly indexCount: number;
    readonly drawOrder: readonly string[];
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("line primitives route renders two indexed colored line sets", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<LinePrimitivesStatus>(
    page,
    "/examples/line-primitives.html",
    "line-primitives-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "line-primitives",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, perViewBindGroups: 1 },
    binding: { planned: 2, applied: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    command: {
      drawCount: 2,
      indexedDrawCount: 2,
      nonIndexedDrawCount: 0,
    },
    submission: {
      commandBuffers: 1,
      viewPasses: 1,
      drawCalls: 2,
      indexedDrawCalls: 2,
    },
    linePrimitives: {
      topology: "line-list",
      sets: 2,
      materialSlots: 2,
      lineSegments: 10,
      indexed: true,
      indexCount: 20,
      drawOrder: ["cyan-lines", "amber-lines"],
    },
  });
  expect(status.viewports.map((viewport) => viewport.viewportPixels)).toEqual([
    { x: 0, y: 0, width: 960, height: 540 },
  ]);
  expect(status.diagnosticCounts).toEqual(expectedDiagnosticCounts({}));
  expectStatusJsonSafeForGpu(status);

  test.skip(
    status.clearColor === undefined || status.readback.ok !== true,
    "Line primitives pixel proof requires readback.",
  );

  if (status.clearColor === undefined || !status.readback.ok) {
    return;
  }

  const samples = new Map(
    status.readback.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const clearPixel = rgbaColorToPixel(status.clearColor);
  const cyanPixel = rgbaColorToPixel(cyan);
  const amberPixel = rgbaColorToPixel(amber);
  const cyanSample = samples.get("cyan-line");
  const amberSample = samples.get("amber-line");
  const clearSample = samples.get("center-clear");

  expect(cyanSample, "cyan line sample should exist").toBeDefined();
  expect(amberSample, "amber line sample should exist").toBeDefined();
  expect(clearSample, "center clear sample should exist").toBeDefined();

  if (
    cyanSample !== undefined &&
    amberSample !== undefined &&
    clearSample !== undefined
  ) {
    expect(pixelDistance(cyanSample, cyanPixel), "cyan material").toBeLessThan(
      80,
    );
    expect(
      pixelDistance(amberSample, amberPixel),
      "amber material",
    ).toBeLessThan(80);
    expect(
      pixelDistance(cyanSample, clearPixel),
      "cyan line non-clear",
    ).toBeGreaterThan(40);
    expect(
      pixelDistance(amberSample, clearPixel),
      "amber line non-clear",
    ).toBeGreaterThan(40);
    expect(pixelDistance(clearSample, clearPixel), "center clear").toBeLessThan(
      30,
    );
  }

  validationGuard.expectNoWarnings();
});
