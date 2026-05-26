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

const cropColor = { r: 0.12, g: 0.88, b: 0.36, a: 1 };
const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };

interface CameraSubViewCropStatus extends ExampleStatusBase {
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
  readonly viewports: readonly {
    readonly viewId: number;
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
  readonly subViewCrop: {
    readonly mode: "normalized-viewport-scissor-crop";
    readonly source: string;
    readonly viewport: readonly number[];
    readonly scissor: readonly number[];
    readonly expectedViewportPixels: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly expectedSamples: {
      readonly inside: string;
      readonly outside: readonly string[];
    };
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("camera sub-view crop route confines rendering to the cropped viewport", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraSubViewCropStatus>(
    page,
    "/examples/camera-sub-view-crop.html",
    "camera-sub-view-crop-status",
  );

  if (status === undefined) {
    return;
  }

  const cropPixels = { x: 240, y: 135, width: 480, height: 270 };

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-sub-view-crop",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
    resources: { materials: 1, perViewBindGroups: 1 },
    binding: { planned: 1, applied: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
    command: {
      drawCount: 1,
      indexedDrawCount: 1,
      nonIndexedDrawCount: 0,
    },
    submission: {
      commandBuffers: 1,
      viewPasses: 1,
      drawCalls: 1,
      indexedDrawCalls: 1,
    },
    subViewCrop: {
      mode: "normalized-viewport-scissor-crop",
      source: "Camera.viewport+Camera.scissor",
      viewport: [0.25, 0.25, 0.5, 0.5],
      scissor: [0.25, 0.25, 0.5, 0.5],
      expectedViewportPixels: cropPixels,
      expectedSamples: {
        inside: "crop-center",
        outside: ["outside-top-left", "outside-bottom-right"],
      },
    },
  });
  expect(status.viewports).toHaveLength(1);
  expect(status.viewports[0]?.viewportPixels).toEqual(cropPixels);
  expect(status.viewports[0]?.scissorPixels).toEqual(cropPixels);
  expect(status.viewPasses).toEqual([
    expect.objectContaining({
      viewId: 0,
      priority: 0,
      layerMask: 1,
      clearBehavior: "target-cleared-before-view",
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 0,
      includedMaterialKeys: ["material:camera-sub-view-crop-material"],
      skippedMaterialKeys: [],
      viewportPixels: cropPixels,
      scissorPixels: cropPixels,
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
  const cropSample = samples.get("crop-center");
  const outsideTopLeft = samples.get("outside-top-left");
  const outsideBottomRight = samples.get("outside-bottom-right");
  const cropPixel = rgbaColorToPixel(cropColor);
  const clearPixel = rgbaColorToPixel(clearColor);

  expect(cropSample, "crop center sample should exist").toBeDefined();
  expect(outsideTopLeft, "outside top-left sample should exist").toBeDefined();
  expect(
    outsideBottomRight,
    "outside bottom-right sample should exist",
  ).toBeDefined();

  if (
    cropSample !== undefined &&
    outsideTopLeft !== undefined &&
    outsideBottomRight !== undefined
  ) {
    expect(pixelDistance(cropSample, cropPixel), "crop center").toBeLessThan(
      85,
    );
    expect(
      pixelDistance(outsideTopLeft, clearPixel),
      "outside top-left remains clear",
    ).toBeLessThan(30);
    expect(
      pixelDistance(outsideBottomRight, clearPixel),
      "outside bottom-right remains clear",
    ).toBeLessThan(30);
    expect(
      pixelDistance(cropSample, outsideTopLeft),
      "crop should differ from outside clear sample",
    ).toBeGreaterThan(80);
  }

  validationGuard.expectNoWarnings();
});
