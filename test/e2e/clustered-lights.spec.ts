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
    readonly coordinateSpace: "world" | "view-depth";
    readonly viewId: number | null;
    readonly populatedCells: number;
    readonly maxLightsPerPopulatedCell: number;
    readonly averageLightsPerPopulatedCell: number;
    readonly totalAssignedLightReferences: number;
    readonly occupancyHash: number;
    readonly resourceReuse: {
      readonly buffersCreated: number;
      readonly buffersReused: number;
    };
  } | null;
  readonly clusterStatus?: {
    readonly ok: boolean;
    readonly clusterPipelineUsed: boolean;
    readonly coordinateSpace: "world" | "view-depth" | null;
    readonly viewId: number | null;
    readonly totalLocalLights: number;
    readonly populatedCells: number | null;
    readonly averageLightsPerPopulatedCell: number;
    readonly maxLightsPerPopulatedCell: number | null;
    readonly totalAssignedLightReferences: number | null;
    readonly occupancyHash: number | null;
    readonly previousOccupancyHash: number | null;
    readonly occupancyChanged: boolean;
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
      coordinateSpace: "view-depth",
      occupancyChanged: true,
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
    coordinateSpace: "view-depth",
    clusterDimensions: { x: 8, y: 4, z: 8 },
  });
  expect(status.localLightClusters?.viewId).not.toBeNull();
  expect(status.localLightClusters?.occupancyHash ?? 0).toBeGreaterThan(0);
  expect(status.clusterStatus?.previousOccupancyHash).not.toBe(
    status.clusterStatus?.occupancyHash,
  );
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
