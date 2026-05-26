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

const redLayer = { r: 0.95, g: 0.12, b: 0.08, a: 1 };
const blueLayer = { r: 0.08, g: 0.32, b: 1, a: 1 };

interface CameraRenderLayersStatus extends ExampleStatusBase {
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
    readonly layerMask: number;
    readonly viewportPixels: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
  }[];
  readonly viewPasses: readonly {
    readonly viewId: number;
    readonly layerMask: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
    readonly includedDraws: number;
    readonly skippedDraws: number;
    readonly includedMaterialKeys: readonly string[];
    readonly skippedMaterialKeys: readonly string[];
  }[];
  readonly layerIsolation: {
    readonly mode: "camera-layer-mask";
    readonly cameras: readonly {
      readonly viewId: number;
      readonly layerMask: number;
      readonly includedMaterialKey: string;
      readonly skippedMaterialKey: string;
    }[];
    readonly expectedPerCamera: {
      readonly includedDraws: number;
      readonly skippedDraws: number;
    };
  };
  readonly readback: SceneReadbackStatus;
  readonly diagnosticCounts: ReturnType<typeof expectedDiagnosticCounts>;
}

test("camera render-layer route isolates draws per ECS camera layer mask", async ({
  page,
}) => {
  const validationGuard = attachWebGpuValidationConsoleGuard(page);
  const status = await loadExampleStatus<CameraRenderLayersStatus>(
    page,
    "/examples/camera-render-layers.html",
    "camera-render-layers-status",
  );

  if (status === undefined) {
    return;
  }

  const redMaterialKey = "material:camera-render-layer-red";
  const blueMaterialKey = "material:camera-render-layer-blue";

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "camera-render-layers",
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
    layerIsolation: {
      mode: "camera-layer-mask",
      cameras: [
        {
          viewId: 0,
          layerMask: 1,
          includedMaterialKey: redMaterialKey,
          skippedMaterialKey: blueMaterialKey,
        },
        {
          viewId: 1,
          layerMask: 2,
          includedMaterialKey: blueMaterialKey,
          skippedMaterialKey: redMaterialKey,
        },
      ],
      expectedPerCamera: {
        includedDraws: 1,
        skippedDraws: 1,
      },
    },
  });
  expect(status.viewports.map((viewport) => viewport.viewportPixels)).toEqual([
    { x: 0, y: 0, width: 480, height: 540 },
    { x: 480, y: 0, width: 480, height: 540 },
  ]);
  expect(status.viewPasses).toEqual([
    expect.objectContaining({
      viewId: 0,
      layerMask: 1,
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [redMaterialKey],
      skippedMaterialKeys: [blueMaterialKey],
    }),
    expect.objectContaining({
      viewId: 1,
      layerMask: 2,
      drawCalls: 1,
      indexedDrawCalls: 1,
      includedDraws: 1,
      skippedDraws: 1,
      includedMaterialKeys: [blueMaterialKey],
      skippedMaterialKeys: [redMaterialKey],
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
  const redSample = samples.get("red-layer-camera");
  const blueSample = samples.get("blue-layer-camera");
  const redPixel = rgbaColorToPixel(redLayer);
  const bluePixel = rgbaColorToPixel(blueLayer);

  expect(redSample, "red layer camera sample should exist").toBeDefined();
  expect(blueSample, "blue layer camera sample should exist").toBeDefined();

  if (redSample !== undefined && blueSample !== undefined) {
    expect(pixelDistance(redSample, redPixel), "red layer camera").toBeLessThan(
      80,
    );
    expect(
      pixelDistance(blueSample, bluePixel),
      "blue layer camera",
    ).toBeLessThan(80);
    expect(
      pixelDistance(redSample, blueSample),
      "layer cameras should not show the same material",
    ).toBeGreaterThan(120);
  }

  validationGuard.expectNoWarnings();
});
