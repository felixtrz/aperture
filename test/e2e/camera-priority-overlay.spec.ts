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

const baseLayer = { r: 0.9, g: 0.18, b: 0.08, a: 1 };
const overlayLayer = { r: 0.08, g: 0.72, b: 1, a: 1 };

interface CameraPriorityOverlayStatus extends ExampleStatusBase {
  readonly extraction: {
    readonly views: number;
    readonly meshDraws: number;
    readonly diagnostics: number;
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
    readonly includedDraws: number;
    readonly skippedDraws: number;
    readonly includedMaterialKeys: readonly string[];
  }[];
  readonly priorityOverlay: {
    readonly mode: "same-target-priority-overlay";
    readonly expectedPassOrder: readonly {
      readonly viewId: number;
      readonly priority: number;
      readonly layerMask: number;
      readonly materialKey: string;
      readonly clearBehavior: string;
    }[];
    readonly samples: {
      readonly baseOnly: string;
      readonly overlay: string;
    };
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("camera priority route overlays higher-priority camera without clearing base", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraPriorityOverlayStatus>(
    page,
    "/examples/camera-priority-overlay.html",
    "camera-priority-overlay-status",
  );

  if (status === undefined) {
    return;
  }

  const baseMaterialKey = "material:camera-priority-base";
  const overlayMaterialKey = "material:camera-priority-overlay";

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-priority-overlay",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 2, meshDraws: 2, diagnostics: 0 },
    binding: { planned: 2, applied: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    command: {
      drawCount: 2,
      indexedDrawCount: 2,
      nonIndexedDrawCount: 0,
    },
    submission: {
      commandBuffers: 1,
      viewPasses: 2,
      drawCalls: 2,
      indexedDrawCalls: 2,
    },
    priorityOverlay: {
      mode: "same-target-priority-overlay",
      expectedPassOrder: [
        {
          viewId: 0,
          priority: 0,
          layerMask: 1,
          materialKey: baseMaterialKey,
          clearBehavior: "target-cleared-before-view",
        },
        {
          viewId: 1,
          priority: 10,
          layerMask: 2,
          materialKey: overlayMaterialKey,
          clearBehavior: "load-existing-target",
        },
      ],
      samples: {
        baseOnly: "base-only",
        overlay: "overlay-center",
      },
    },
  });
  expect(status.cameraPassOrder).toEqual([
    {
      viewId: 0,
      priority: 0,
      layerMask: 1,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 1,
    },
    {
      viewId: 1,
      priority: 10,
      layerMask: 2,
      clearBehavior: "load-existing-target",
      drawCalls: 1,
    },
  ]);
  expect(status.viewPasses).toEqual([
    expect.objectContaining({
      viewId: 0,
      priority: 0,
      layerMask: 1,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [baseMaterialKey],
    }),
    expect.objectContaining({
      viewId: 1,
      priority: 10,
      layerMask: 2,
      clearBehavior: "load-existing-target",
      drawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [overlayMaterialKey],
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
  const baseSample = samples.get("base-only");
  const overlaySample = samples.get("overlay-center");
  const basePixel = rgbaColorToPixel(baseLayer);
  const overlayPixel = rgbaColorToPixel(overlayLayer);

  expect(baseSample, "base-only sample should exist").toBeDefined();
  expect(overlaySample, "overlay sample should exist").toBeDefined();

  if (baseSample !== undefined && overlaySample !== undefined) {
    expect(
      pixelDistance(baseSample, basePixel),
      "base-only region",
    ).toBeLessThan(85);
    expect(
      pixelDistance(overlaySample, overlayPixel),
      "higher-priority overlay",
    ).toBeLessThan(85);
    expect(
      pixelDistance(baseSample, overlaySample),
      "base and overlay samples should differ",
    ).toBeGreaterThan(120);
  }

  validationGuard.expectNoWarnings();
});
