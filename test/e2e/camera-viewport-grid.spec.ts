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

const gridCells = [
  {
    id: "top-left",
    sampleId: "grid-top-left",
    layerMask: 1,
    priority: 0,
    materialKey: "material:camera-viewport-grid-red",
    viewport: [0, 0, 0.5, 0.5],
    pixels: { x: 0, y: 0, width: 480, height: 270 },
    color: { r: 0.95, g: 0.16, b: 0.08, a: 1 },
  },
  {
    id: "top-right",
    sampleId: "grid-top-right",
    layerMask: 2,
    priority: 1,
    materialKey: "material:camera-viewport-grid-green",
    viewport: [0.5, 0, 0.5, 0.5],
    pixels: { x: 480, y: 0, width: 480, height: 270 },
    color: { r: 0.12, g: 0.82, b: 0.28, a: 1 },
  },
  {
    id: "bottom-left",
    sampleId: "grid-bottom-left",
    layerMask: 4,
    priority: 2,
    materialKey: "material:camera-viewport-grid-blue",
    viewport: [0, 0.5, 0.5, 0.5],
    pixels: { x: 0, y: 270, width: 480, height: 270 },
    color: { r: 0.08, g: 0.32, b: 1, a: 1 },
  },
  {
    id: "bottom-right",
    sampleId: "grid-bottom-right",
    layerMask: 8,
    priority: 3,
    materialKey: "material:camera-viewport-grid-yellow",
    viewport: [0.5, 0.5, 0.5, 0.5],
    pixels: { x: 480, y: 270, width: 480, height: 270 },
    color: { r: 0.95, g: 0.78, b: 0.08, a: 1 },
  },
] as const;

interface CameraViewportGridStatus extends ExampleStatusBase {
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
  readonly viewports: readonly {
    readonly viewId: number;
    readonly priority: number;
    readonly layerMask: number;
    readonly viewport: readonly number[];
    readonly scissor: readonly number[];
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
    readonly priority: number;
    readonly layerMask: number;
    readonly clearBehavior: string;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly includedDraws: number;
    readonly skippedDraws: number;
    readonly includedMaterialKeys: readonly string[];
    readonly skippedMaterialKeys: readonly string[];
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
  readonly cameraPassOrder: readonly {
    readonly viewId: number;
    readonly priority: number;
    readonly layerMask: number;
    readonly clearBehavior: string;
    readonly drawCalls: number;
  }[];
  readonly viewportGrid: {
    readonly mode: "four-camera-normalized-viewport-grid";
    readonly rows: number;
    readonly columns: number;
    readonly sharedMeshKey: string;
    readonly expectedPerCamera: {
      readonly includedDraws: number;
      readonly skippedDraws: number;
    };
    readonly cells: readonly {
      readonly id: string;
      readonly viewId: number;
      readonly priority: number;
      readonly layerMask: number;
      readonly viewport: readonly number[];
      readonly scissor: readonly number[];
      readonly viewportPixels: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      };
      readonly materialKey: string;
      readonly sampleId: string;
      readonly expectedColor: readonly number[];
    }[];
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("camera viewport grid route renders four ECS camera cells", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraViewportGridStatus>(
    page,
    "/examples/camera-viewport-grid.html",
    "camera-viewport-grid-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-viewport-grid",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 4, meshDraws: 4, diagnostics: 0 },
    resources: { materials: 4, perViewBindGroups: 4 },
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
      viewPasses: 4,
      drawCalls: 4,
      indexedDrawCalls: 4,
    },
    viewportGrid: {
      mode: "four-camera-normalized-viewport-grid",
      rows: 2,
      columns: 2,
      sharedMeshKey: "mesh:camera-viewport-grid-plane",
      expectedPerCamera: {
        includedDraws: 1,
        skippedDraws: 3,
      },
    },
  });

  expect(status.viewports.map((viewport) => viewport.viewportPixels)).toEqual(
    gridCells.map((cell) => cell.pixels),
  );
  expect(status.viewports.map((viewport) => viewport.scissorPixels)).toEqual(
    gridCells.map((cell) => cell.pixels),
  );
  expect(status.viewportGrid.cells).toEqual(
    gridCells.map((cell, index) => ({
      id: cell.id,
      viewId: index,
      priority: cell.priority,
      layerMask: cell.layerMask,
      viewport: cell.viewport,
      scissor: cell.viewport,
      viewportPixels: cell.pixels,
      materialKey: cell.materialKey,
      sampleId: cell.sampleId,
      expectedColor: [cell.color.r, cell.color.g, cell.color.b, cell.color.a],
    })),
  );
  expect(status.cameraPassOrder).toEqual(
    gridCells.map((cell, index) => ({
      viewId: index,
      priority: cell.priority,
      layerMask: cell.layerMask,
      clearBehavior:
        index === 0 ? "target-cleared-before-view" : "load-existing-target",
      drawCalls: 1,
    })),
  );
  expect(status.viewPasses).toEqual(
    gridCells.map((cell, index) =>
      expect.objectContaining({
        viewId: index,
        priority: cell.priority,
        layerMask: cell.layerMask,
        clearBehavior:
          index === 0 ? "target-cleared-before-view" : "load-existing-target",
        drawCalls: 1,
        indexedDrawCalls: 1,
        includedDraws: 1,
        skippedDraws: 3,
        includedMaterialKeys: [cell.materialKey],
        skippedMaterialKeys: gridCells
          .filter((otherCell) => otherCell.id !== cell.id)
          .map((otherCell) => otherCell.materialKey),
        viewportPixels: cell.pixels,
        scissorPixels: cell.pixels,
      }),
    ),
  );
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

  for (const cell of gridCells) {
    const sample = samples.get(cell.sampleId);

    expect(sample, `${cell.sampleId} sample should exist`).toBeDefined();

    if (sample !== undefined) {
      expect(
        pixelDistance(sample, rgbaColorToPixel(cell.color)),
        cell.sampleId,
      ).toBeLessThan(90);
    }
  }

  const samplePixels = gridCells
    .map((cell) => samples.get(cell.sampleId))
    .filter(
      (sample): sample is NonNullable<typeof sample> => sample !== undefined,
    );
  const firstSamplePixel = samplePixels[0];

  if (firstSamplePixel !== undefined) {
    for (let index = 1; index < samplePixels.length; index += 1) {
      const nextSamplePixel = samplePixels[index];

      if (nextSamplePixel === undefined) {
        continue;
      }

      expect(
        pixelDistance(firstSamplePixel, nextSamplePixel),
        "grid cells should show distinct material evidence",
      ).toBeGreaterThan(80);
    }
  }

  validationGuard.expectNoWarnings();
});

test("camera viewport grid renders four cells through the single-encoder FrameGraph (M3-T4)", async ({
  page,
}) => {
  // M3-T4: ?graph=1 merges the four camera viewport submissions to the swapchain
  // into ONE command buffer. Each quadrant must still show its camera's color
  // (the multi-target merge renders byte-correctly) with no validation warnings.
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraViewportGridStatus>(
    page,
    "/examples/camera-viewport-grid.html?graph=1",
    "camera-viewport-grid-graph-status",
  );

  if (status === undefined) {
    return;
  }

  expect(status.ok).toBe(true);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-viewport-grid",
    extraction: { views: 4, meshDraws: 4, diagnostics: 0 },
  });
  expectStatusJsonSafeForGpu(status);

  test.skip(
    status.readback.ok !== true,
    status.readback.ok ? "" : "Current-texture readback unavailable",
  );
  if (!status.readback.ok) {
    return;
  }

  const samples = new Map(
    status.readback.samples.map((sample) => [sample.id, sample.pixel]),
  );
  for (const cell of gridCells) {
    const sample = samples.get(cell.sampleId);
    expect(sample, `${cell.sampleId} graph sample should exist`).toBeDefined();
    if (sample !== undefined) {
      expect(
        pixelDistance(sample, rgbaColorToPixel(cell.color)),
        `${cell.sampleId} (graph path)`,
      ).toBeLessThan(90);
    }
  }

  validationGuard.expectNoWarnings();
});
