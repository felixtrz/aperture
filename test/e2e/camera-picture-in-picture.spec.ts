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

const baseColor = { r: 0.9, g: 0.18, b: 0.08, a: 1 };
const insetColor = { r: 0.08, g: 0.72, b: 1, a: 1 };
const insetViewport = [0.625, 0.125, 0.25, 0.25] as const;
const insetPixels = { x: 600, y: 68, width: 240, height: 135 };

interface CameraPictureInPictureStatus extends ExampleStatusBase {
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
  readonly pictureInPicture: {
    readonly mode: "same-target-inset-camera";
    readonly target: "current-texture";
    readonly base: {
      readonly viewId: number;
      readonly priority: number;
      readonly layerMask: number;
      readonly materialKey: string;
      readonly viewport: readonly number[];
      readonly scissor: readonly number[];
      readonly clearBehavior: string;
    };
    readonly inset: {
      readonly viewId: number;
      readonly priority: number;
      readonly layerMask: number;
      readonly materialKey: string;
      readonly viewport: readonly number[];
      readonly scissor: readonly number[];
      readonly viewportPixels: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      };
      readonly clearBehavior: string;
    };
    readonly expectedSamples: {
      readonly base: readonly string[];
      readonly inset: string;
    };
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("camera picture-in-picture route draws an inset camera over the base view", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraPictureInPictureStatus>(
    page,
    "/examples/camera-picture-in-picture.html",
    "camera-picture-in-picture-status",
  );

  if (status === undefined) {
    return;
  }

  const baseMaterialKey = "material:camera-picture-in-picture-base";
  const insetMaterialKey = "material:camera-picture-in-picture-inset";

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-picture-in-picture",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 2, meshDraws: 2, diagnostics: 0 },
    resources: { materials: 2, perViewBindGroups: 2 },
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
      viewPasses: 2,
      drawCalls: 2,
      indexedDrawCalls: 2,
    },
    pictureInPicture: {
      mode: "same-target-inset-camera",
      target: "current-texture",
      base: {
        viewId: 0,
        priority: 0,
        layerMask: 1,
        materialKey: baseMaterialKey,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearBehavior: "target-cleared-before-view",
      },
      inset: {
        viewId: 1,
        priority: 1,
        layerMask: 2,
        materialKey: insetMaterialKey,
        viewport: insetViewport,
        scissor: insetViewport,
        viewportPixels: insetPixels,
        clearBehavior: "load-existing-target",
      },
      expectedSamples: {
        base: ["base-left", "base-under-inset"],
        inset: "inset-center",
      },
    },
  });
  expect(status.viewports).toEqual([
    expect.objectContaining({
      viewId: 0,
      priority: 0,
      layerMask: 1,
      viewport: [0, 0, 1, 1],
      scissor: [0, 0, 1, 1],
      viewportPixels: { x: 0, y: 0, width: 960, height: 540 },
      scissorPixels: { x: 0, y: 0, width: 960, height: 540 },
    }),
    expect.objectContaining({
      viewId: 1,
      priority: 1,
      layerMask: 2,
      viewport: insetViewport,
      scissor: insetViewport,
      viewportPixels: insetPixels,
      scissorPixels: insetPixels,
    }),
  ]);
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
      priority: 1,
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
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [baseMaterialKey],
      skippedMaterialKeys: [insetMaterialKey],
      viewportPixels: { x: 0, y: 0, width: 960, height: 540 },
      scissorPixels: { x: 0, y: 0, width: 960, height: 540 },
    }),
    expect.objectContaining({
      viewId: 1,
      priority: 1,
      layerMask: 2,
      clearBehavior: "load-existing-target",
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [insetMaterialKey],
      skippedMaterialKeys: [baseMaterialKey],
      viewportPixels: insetPixels,
      scissorPixels: insetPixels,
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
  const baseLeftSample = samples.get("base-left");
  const baseUnderInsetSample = samples.get("base-under-inset");
  const insetSample = samples.get("inset-center");
  const basePixel = rgbaColorToPixel(baseColor);
  const insetPixel = rgbaColorToPixel(insetColor);

  expect(baseLeftSample, "base-left sample should exist").toBeDefined();
  expect(
    baseUnderInsetSample,
    "base-under-inset sample should exist",
  ).toBeDefined();
  expect(insetSample, "inset-center sample should exist").toBeDefined();

  if (
    baseLeftSample !== undefined &&
    baseUnderInsetSample !== undefined &&
    insetSample !== undefined
  ) {
    expect(
      pixelDistance(baseLeftSample, basePixel),
      "base left region",
    ).toBeLessThan(85);
    expect(
      pixelDistance(baseUnderInsetSample, basePixel),
      "base region below inset",
    ).toBeLessThan(85);
    expect(
      pixelDistance(insetSample, insetPixel),
      "inset center region",
    ).toBeLessThan(85);
    expect(
      pixelDistance(baseUnderInsetSample, insetSample),
      "inset should differ from preserved base",
    ).toBeGreaterThan(120);
  }

  validationGuard.expectNoWarnings();
});
