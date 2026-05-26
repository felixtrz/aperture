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

const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const baseLayer = { r: 0.9, g: 0.18, b: 0.08, a: 1 };
const overlayLayer = { r: 0.08, g: 0.72, b: 1, a: 1 };

interface CameraClearLoadMatrixStatus extends ExampleStatusBase {
  readonly extraction: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
  };
  readonly resources: {
    readonly materials: number;
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
  readonly cameraPassOrder: readonly {
    readonly viewId: number;
    readonly priority: number;
    readonly layerMask: number;
    readonly clearBehavior: string;
    readonly drawCalls: number;
  }[];
  readonly viewPasses: readonly {
    readonly viewId: number;
    readonly priority: number;
    readonly layerMask: number;
    readonly clearBehavior: string;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly includedDraws: number;
    readonly skippedDraws: number;
    readonly includedMaterialKeys: readonly string[];
    readonly skippedMaterialKeys: readonly string[];
  }[];
  readonly clearLoadMatrix: {
    readonly mode: "clear-first-load-after";
    readonly target: "current-texture";
    readonly expectedSamples: {
      readonly clearOnly: string;
      readonly basePreserved: string;
      readonly overlay: string;
    };
    readonly passes: readonly {
      readonly role: "clear-only" | "base" | "overlay";
      readonly viewId: number;
      readonly priority: number;
      readonly layerMask: number;
      readonly expectedDraws: number;
      readonly clearBehavior: string;
      readonly materialKey: string | null;
    }[];
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("camera clear/load matrix route preserves clear, base, and overlay regions", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraClearLoadMatrixStatus>(
    page,
    "/examples/camera-clear-load-matrix.html",
    "camera-clear-load-matrix-status",
  );

  if (status === undefined) {
    return;
  }

  const baseMaterialKey = "material:camera-clear-load-base";
  const overlayMaterialKey = "material:camera-clear-load-overlay";

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-clear-load-matrix",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 3, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, perViewBindGroups: 3 },
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
      viewPasses: 3,
      drawCalls: 2,
      indexedDrawCalls: 2,
    },
    clearLoadMatrix: {
      mode: "clear-first-load-after",
      target: "current-texture",
      expectedSamples: {
        clearOnly: "clear-only",
        basePreserved: "base-preserved",
        overlay: "overlay-center",
      },
      passes: [
        {
          role: "clear-only",
          viewId: 0,
          priority: 0,
          layerMask: 4,
          expectedDraws: 0,
          clearBehavior: "target-cleared-before-view",
          materialKey: null,
        },
        {
          role: "base",
          viewId: 1,
          priority: 1,
          layerMask: 1,
          expectedDraws: 1,
          clearBehavior: "load-existing-target",
          materialKey: baseMaterialKey,
        },
        {
          role: "overlay",
          viewId: 2,
          priority: 2,
          layerMask: 2,
          expectedDraws: 1,
          clearBehavior: "load-existing-target",
          materialKey: overlayMaterialKey,
        },
      ],
    },
  });
  expect(status.cameraPassOrder).toEqual([
    {
      viewId: 0,
      priority: 0,
      layerMask: 4,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 0,
    },
    {
      viewId: 1,
      priority: 1,
      layerMask: 1,
      clearBehavior: "load-existing-target",
      drawCalls: 1,
    },
    {
      viewId: 2,
      priority: 2,
      layerMask: 2,
      clearBehavior: "load-existing-target",
      drawCalls: 1,
    },
  ]);
  expect(status.viewPasses).toEqual([
    expect.objectContaining({
      viewId: 0,
      priority: 0,
      layerMask: 4,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 0,
      indexedDrawCalls: 0,
      includedDraws: 0,
      skippedDraws: 2,
      includedMaterialKeys: [],
      skippedMaterialKeys: [baseMaterialKey, overlayMaterialKey],
    }),
    expect.objectContaining({
      viewId: 1,
      priority: 1,
      layerMask: 1,
      clearBehavior: "load-existing-target",
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [baseMaterialKey],
      skippedMaterialKeys: [overlayMaterialKey],
    }),
    expect.objectContaining({
      viewId: 2,
      priority: 2,
      layerMask: 2,
      clearBehavior: "load-existing-target",
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [overlayMaterialKey],
      skippedMaterialKeys: [baseMaterialKey],
    }),
  ]);
  expect(status.diagnosticCounts).toEqual(expectedDiagnosticCounts({}));
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

  const samples = new Map(
    status.readback.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const clearSample = samples.get("clear-only");
  const baseSample = samples.get("base-preserved");
  const overlaySample = samples.get("overlay-center");

  expect(clearSample, "clear-only sample should exist").toBeDefined();
  expect(baseSample, "base-preserved sample should exist").toBeDefined();
  expect(overlaySample, "overlay sample should exist").toBeDefined();

  if (
    clearSample !== undefined &&
    baseSample !== undefined &&
    overlaySample !== undefined
  ) {
    expect(
      pixelDistance(clearSample, rgbaColorToPixel(clearColor)),
      "clear-only region",
    ).toBeLessThan(30);
    expect(
      pixelDistance(baseSample, rgbaColorToPixel(baseLayer)),
      "base-preserved region",
    ).toBeLessThan(85);
    expect(
      pixelDistance(overlaySample, rgbaColorToPixel(overlayLayer)),
      "overlay region",
    ).toBeLessThan(85);
    expect(
      pixelDistance(baseSample, overlaySample),
      "base and overlay regions should differ",
    ).toBeGreaterThan(120);
  }

  validationGuard.expectNoWarnings();
});
