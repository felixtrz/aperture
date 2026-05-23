import { expect, test } from "@playwright/test";

import {
  attachWebGpuValidationConsoleGuard,
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface ClusteredLightsStatus extends ExampleStatusBase {
  readonly pipelineKeys?: readonly string[];
  readonly localLightClusters?: {
    readonly enabled: boolean;
    readonly totalLocalLights: number;
    readonly clusteredLocalLights: number;
    readonly clusterDimensions: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly populatedCells: number;
    readonly maxLightsPerPopulatedCell: number;
    readonly averageLightsPerPopulatedCell: number;
    readonly resourceReuse: {
      readonly buffersCreated: number;
      readonly buffersReused: number;
    };
  } | null;
  readonly clusterStatus?: {
    readonly ok: boolean;
    readonly clusterPipelineUsed: boolean;
    readonly totalLocalLights: number;
    readonly averageLightsPerPopulatedCell: number;
    readonly maxLightsPerPopulatedCell: number | null;
    readonly buffersCreated: number;
    readonly buffersReused: number;
  };
  readonly readbackStatus?: {
    readonly ok: boolean;
    readonly maxClearDistance?: number;
    readonly luminanceRange?: number;
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
}

test("browser renders StandardMaterial through clustered local lights", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto("/examples/clustered-lights.html");

  const status = await waitForExampleStatus<ClusteredLightsStatus>(page);

  await attachExampleStatus("clustered-lights-status", status);
  expect(status, "clustered lights status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "clustered-lights",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    clusterStatus: {
      ok: true,
      clusterPipelineUsed: true,
      totalLocalLights: 64,
      buffersReused: 3,
    },
    counts: {
      meshDraws: 1,
      diagnostics: 0,
    },
  });
  expect(status.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|opaque|back|less|none",
  );
  expect(status.localLightClusters).toMatchObject({
    enabled: true,
    totalLocalLights: 64,
    clusteredLocalLights: 64,
    clusterDimensions: { x: 8, y: 4, z: 8 },
  });
  expect(
    status.localLightClusters?.maxLightsPerPopulatedCell ?? 64,
  ).toBeLessThan(64);
  expect(
    status.localLightClusters?.averageLightsPerPopulatedCell ?? 64,
  ).toBeLessThan(64);
  expect(status.readbackStatus?.ok).toBe(true);
  expect(status.readbackStatus?.maxClearDistance ?? 0).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});
