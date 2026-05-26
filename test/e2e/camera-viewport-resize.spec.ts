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
const resizeColor = { r: 0.86, g: 0.2, b: 0.95, a: 1 };
const oldViewport = [0.125, 0.125, 0.25, 0.25] as const;
const newViewport = [0.5, 0.375, 0.5, 0.5] as const;
const oldPixels = { x: 120, y: 68, width: 240, height: 135 };
const newPixels = { x: 480, y: 203, width: 480, height: 270 };

interface CameraViewportResizeStatus extends ExampleStatusBase {
  readonly extraction: {
    readonly frames: number;
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
    readonly commands: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly viewports: readonly ViewportStatus[];
  readonly viewPasses: readonly (ViewPassStatus & { readonly frame: number })[];
  readonly cameraPassOrder: readonly {
    readonly frame: number;
    readonly viewId: number;
    readonly priority: number;
    readonly layerMask: number;
    readonly clearBehavior: string;
    readonly drawCalls: number;
  }[];
  readonly viewportResizeMatrix: {
    readonly mode: "same-ecs-camera-viewport-scissor-resize";
    readonly source: "Camera.viewport+Camera.scissor";
    readonly target: "current-texture";
    readonly framesRendered: number;
    readonly cameraHandle: {
      readonly kind: "ecs-entity-index";
      readonly index: number;
    };
    readonly meshAuthoring: {
      readonly meshKey: string;
      readonly materialKey: string;
      readonly stableAcrossFrames: boolean;
    };
    readonly expectedSamples: {
      readonly before: {
        readonly material: string;
        readonly clear: string;
      };
      readonly after: {
        readonly material: string;
        readonly clear: string;
      };
    };
    readonly before: ViewportResizeFrameStatus;
    readonly after: ViewportResizeFrameStatus;
    readonly frames: readonly ViewportResizeFrameStatus[];
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

interface ViewportStatus {
  readonly viewId: number;
  readonly priority: number;
  readonly layerMask: number;
  readonly viewport: readonly number[];
  readonly scissor: readonly number[];
  readonly viewportPixels: ResolvedRect;
  readonly scissorPixels: ResolvedRect;
}

interface ViewPassStatus {
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
  readonly viewportPixels: ResolvedRect;
  readonly scissorPixels: ResolvedRect;
}

interface ViewportResizeFrameStatus extends ViewportStatus {
  readonly frame: number;
  readonly role: string;
  readonly cameraHandle: {
    readonly kind: "ecs-entity-index";
    readonly index: number;
  };
  readonly passOrder: readonly {
    readonly frame: number;
    readonly viewId: number;
    readonly priority: number;
    readonly layerMask: number;
    readonly clearBehavior: string;
    readonly drawCalls: number;
  }[];
  readonly sampleIds: readonly string[];
  readonly readback: SceneReadbackStatus;
}

interface ResolvedRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

test("camera viewport resize route moves one ECS camera viewport across frames", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraViewportResizeStatus>(
    page,
    "/examples/camera-viewport-resize.html",
    "camera-viewport-resize-status",
  );

  if (status === undefined) {
    return;
  }

  const materialKey = "material:camera-viewport-resize-material";
  const meshKey = "mesh:camera-viewport-resize-plane";

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-viewport-resize",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { frames: 2, views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, perViewBindGroups: 2 },
    binding: { planned: 2, applied: 2, diagnostics: 0 },
    renderWorld: { active: 2, ready: 2, blocked: 0 },
    draw: { packages: 2, descriptors: 2, drawList: 2, resolved: 2 },
    command: {
      drawCount: 2,
      indexedDrawCount: 2,
      nonIndexedDrawCount: 0,
    },
    submission: {
      commandBuffers: 2,
      viewPasses: 2,
      drawCalls: 2,
      indexedDrawCalls: 2,
    },
    viewportResizeMatrix: {
      mode: "same-ecs-camera-viewport-scissor-resize",
      source: "Camera.viewport+Camera.scissor",
      target: "current-texture",
      framesRendered: 2,
      meshAuthoring: {
        meshKey,
        materialKey,
        stableAcrossFrames: true,
      },
      expectedSamples: {
        before: {
          material: "old-viewport-center",
          clear: "new-viewport-center",
        },
        after: {
          material: "new-viewport-center",
          clear: "old-viewport-center",
        },
      },
    },
  });
  expect(status.viewportResizeMatrix.cameraHandle).toEqual({
    kind: "ecs-entity-index",
    index: status.viewportResizeMatrix.before.cameraHandle.index,
  });
  expect(status.viewportResizeMatrix.after.cameraHandle).toEqual(
    status.viewportResizeMatrix.before.cameraHandle,
  );
  expect(status.viewportResizeMatrix.frames).toHaveLength(2);
  expect(status.viewportResizeMatrix.before).toMatchObject({
    frame: 1,
    role: "before",
    viewId: 0,
    priority: 0,
    layerMask: 1,
    viewport: oldViewport,
    scissor: oldViewport,
    viewportPixels: oldPixels,
    scissorPixels: oldPixels,
    sampleIds: ["old-viewport-center", "new-viewport-center"],
  });
  expect(status.viewportResizeMatrix.after).toMatchObject({
    frame: 2,
    role: "after",
    viewId: 0,
    priority: 0,
    layerMask: 1,
    viewport: newViewport,
    scissor: newViewport,
    viewportPixels: newPixels,
    scissorPixels: newPixels,
    sampleIds: ["old-viewport-center", "new-viewport-center"],
  });
  expect(status.viewports).toEqual([
    expect.objectContaining({
      viewId: 0,
      priority: 0,
      layerMask: 1,
      viewport: newViewport,
      scissor: newViewport,
      viewportPixels: newPixels,
      scissorPixels: newPixels,
    }),
  ]);
  expect(status.cameraPassOrder).toEqual([
    {
      frame: 1,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 1,
    },
    {
      frame: 2,
      viewId: 0,
      priority: 0,
      layerMask: 1,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 1,
    },
  ]);
  expect(status.viewPasses).toEqual([
    expect.objectContaining({
      frame: 1,
      viewId: 0,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 0,
      includedMaterialKeys: [materialKey],
      viewportPixels: oldPixels,
      scissorPixels: oldPixels,
    }),
    expect.objectContaining({
      frame: 2,
      viewId: 0,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 0,
      includedMaterialKeys: [materialKey],
      viewportPixels: newPixels,
      scissorPixels: newPixels,
    }),
  ]);
  expect(status.diagnosticCounts).toEqual(expectedDiagnosticCounts({}));
  expectStatusJsonSafeForGpu(status);

  const beforeReadback = status.viewportResizeMatrix.before.readback;
  const afterReadback = status.viewportResizeMatrix.after.readback;

  test.skip(
    beforeReadback.ok !== true || afterReadback.ok !== true,
    beforeReadback.ok && afterReadback.ok
      ? ""
      : "Current-texture readback unavailable for one of the viewport resize frames.",
  );

  if (!beforeReadback.ok || !afterReadback.ok) {
    return;
  }

  const beforeSamples = new Map(
    beforeReadback.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const afterSamples = new Map(
    afterReadback.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const materialPixel = rgbaColorToPixel(resizeColor);
  const clearPixel = rgbaColorToPixel(clearColor);
  const beforeOld = beforeSamples.get("old-viewport-center");
  const beforeNew = beforeSamples.get("new-viewport-center");
  const afterOld = afterSamples.get("old-viewport-center");
  const afterNew = afterSamples.get("new-viewport-center");

  expect(beforeOld, "before old viewport sample should exist").toBeDefined();
  expect(beforeNew, "before new viewport sample should exist").toBeDefined();
  expect(afterOld, "after old viewport sample should exist").toBeDefined();
  expect(afterNew, "after new viewport sample should exist").toBeDefined();

  if (
    beforeOld !== undefined &&
    beforeNew !== undefined &&
    afterOld !== undefined &&
    afterNew !== undefined
  ) {
    expect(
      pixelDistance(beforeOld, materialPixel),
      "old viewport center should draw before resize",
    ).toBeLessThan(85);
    expect(
      pixelDistance(beforeNew, clearPixel),
      "new viewport center should be clear before resize",
    ).toBeLessThan(36);
    expect(
      pixelDistance(afterOld, clearPixel),
      "old viewport center should be clear after resize",
    ).toBeLessThan(36);
    expect(
      pixelDistance(afterNew, materialPixel),
      "new viewport center should draw after resize",
    ).toBeLessThan(85);
    expect(
      pixelDistance(beforeOld, afterOld),
      "old sample should change after viewport move",
    ).toBeGreaterThan(120);
    expect(
      pixelDistance(beforeNew, afterNew),
      "new sample should change after viewport move",
    ).toBeGreaterThan(120);
  }

  validationGuard.expectNoWarnings();
});
