import { expect, test } from "@playwright/test";

import {
  attachWebGpuValidationConsoleGuard,
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

interface LocalLightClusterRouteStatus {
  readonly enabled: boolean;
  readonly totalLocalLights: number;
  readonly clusteredLocalLights: number;
  readonly layerMask: number | null;
  readonly lightSetKey: string;
  readonly coordinateSpace: "world" | "view-depth";
  readonly viewId: number | null;
  readonly populatedCells: number;
  readonly maxLightsPerPopulatedCell: number;
  readonly averageLightsPerPopulatedCell: number;
  readonly totalAssignedLightReferences: number;
  readonly occupancyHash: number;
  readonly buildPressure?: {
    readonly assignmentStrategy: "none" | "light-range";
    readonly naiveCellLightPairTests: number;
    readonly lightCellRangeTests: number;
    readonly lightCellWriteAttempts: number;
    readonly storedLightReferences: number;
    readonly skippedOverflowReferences: number;
  };
  readonly shadowCookieMetadata?: {
    readonly wordsPerLight: number;
    readonly totalMetadataLights: number;
    readonly shadow: {
      readonly status:
        | "not-requested"
        | "sampling-ready"
        | "metadata-only"
        | "not-supported";
      readonly samplingSupported: boolean;
      readonly localRequestCount: number;
      readonly clusteredLightCount: number;
      readonly supportedLightCount: number;
      readonly fallbackReason: string | null;
    };
    readonly cookie: {
      readonly status: "not-requested" | "metadata-only" | "not-supported";
      readonly samplingSupported: boolean;
      readonly localRequestCount: number;
      readonly clusteredLightCount: number;
      readonly supportedLightCount: number;
      readonly fallbackReason: string | null;
    };
  };
  readonly resourceKey: string;
}

interface ClusteredLightsStatus extends ExampleStatusBase {
  readonly pipelineKeys?: readonly string[];
  readonly localLightClusters?: LocalLightClusterRouteStatus & {
    readonly enabled: boolean;
    readonly clusterDimensions: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly resourceReuse: {
      readonly buffersCreated: number;
      readonly buffersReused: number;
    };
    readonly routes?: readonly LocalLightClusterRouteStatus[];
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
    readonly routeCount: number;
    readonly routeViewIds: readonly (number | null)[];
    readonly routeOccupancyHashes: readonly (number | null)[];
    readonly distinctViewIds: number;
    readonly distinctOccupancyHashes: number;
    readonly routePressureOk: boolean;
    readonly routeMetadataOk: boolean;
    readonly routePointShadowSamplingOk: boolean;
    readonly routes: readonly LocalLightClusterRouteStatus[];
    readonly buffersCreated: number;
    readonly buffersReused: number;
  };
  readonly readbackStatus?: {
    readonly ok: boolean;
    readonly maxClearDistance?: number;
    readonly luminanceRange?: number;
  };
  readonly readback?: {
    readonly samples?: readonly {
      readonly id: string;
      readonly pixel: { readonly r: number; readonly g: number; readonly b: number };
    }[];
  };
  readonly shadowStatus?: {
    readonly enabled: boolean;
    readonly supported: boolean;
    readonly mode?: string;
    readonly casterDraws?: number;
    readonly faceCount?: number;
    readonly submission?: string;
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

  await page.goto("/examples/clustered-lights.html?disable-cluster-point-shadow=1");
  await page.bringToFront();

  const baseline = await waitForExampleStatus<ClusteredLightsStatus>(page);

  await attachExampleStatus("clustered-lights-baseline-status", baseline);
  expect(baseline, "clustered lights baseline status should publish")
    .toBeDefined();

  if (baseline === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(baseline);
  expectStatusJsonSafeForGpu(baseline);

  await page.goto("/examples/clustered-lights.html");
  await page.bringToFront();

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
      routeCount: 2,
      distinctViewIds: 2,
      distinctOccupancyHashes: 2,
      routePressureOk: true,
      routeMetadataOk: true,
      routePointShadowSamplingOk: true,
    },
    counts: {
      meshDraws: 3,
      diagnostics: 0,
    },
    shadowStatus: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-cube-compare",
      casterDraws: 1,
      faceCount: 6,
      submission: "submitted",
    },
  });
  expect(status.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|pointShadowMap|opaque|back|less|none",
  );
  expect(status.localLightClusters).toMatchObject({
    enabled: true,
    totalLocalLights: 64,
    clusteredLocalLights: 64,
    coordinateSpace: "view-depth",
    clusterDimensions: { x: 8, y: 4, z: 8 },
  });
  expect(status.clusterStatus?.buffersReused ?? 0).toBeGreaterThanOrEqual(12);
  const routes = status.localLightClusters?.routes ?? [];

  expect(routes).toHaveLength(2);
  expect(new Set(routes.map((route) => route.viewId)).size).toBe(2);
  expect(new Set(routes.map((route) => route.occupancyHash)).size).toBe(2);
  expect(new Set(routes.map((route) => route.layerMask))).toEqual(
    new Set([1, 2]),
  );
  expect(
    routes.some(
      (route) =>
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 1,
    ),
  ).toBe(true);
  expect(status.localLightClusters?.viewId).not.toBeNull();
  expect(status.localLightClusters?.occupancyHash ?? 0).toBeGreaterThan(0);
  expect(status.clusterStatus?.previousOccupancyHash).not.toBe(
    status.clusterStatus?.occupancyHash,
  );
  for (const route of routes) {
    expect(route.totalLocalLights).toBe(64);
    expect(route.clusteredLocalLights).toBe(64);
    expect(route.maxLightsPerPopulatedCell).toBeLessThan(64);
    expect(route.averageLightsPerPopulatedCell).toBeLessThan(64);
    expect(route.buildPressure).toMatchObject({
      assignmentStrategy: "light-range",
      lightCellRangeTests: 64,
      storedLightReferences: route.totalAssignedLightReferences,
    });
    expect(route.buildPressure?.lightCellWriteAttempts ?? 0).toBeLessThan(
      route.buildPressure?.naiveCellLightPairTests ?? 0,
    );
    expect(route.shadowCookieMetadata?.shadow.localRequestCount).toBe(4);
    expect(route.shadowCookieMetadata?.shadow.clusteredLightCount).toBe(4);
    expect(route.shadowCookieMetadata?.cookie).toMatchObject({
      status: "not-supported",
      samplingSupported: false,
      localRequestCount: 0,
      clusteredLightCount: 0,
      supportedLightCount: 0,
      fallbackReason: "light-cookie-authoring-not-implemented",
    });
    expect(route.shadowCookieMetadata).toMatchObject({
      wordsPerLight: 4,
      totalMetadataLights: 130,
    });
  }
  expect(maxSampleLuminanceDarkening(baseline, status)).toBeGreaterThan(3);
  expect(status.readbackStatus?.ok).toBe(true);
  expect(status.readbackStatus?.maxClearDistance ?? 0).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

function maxSampleLuminanceDarkening(
  baseline: ClusteredLightsStatus,
  status: ClusteredLightsStatus,
): number {
  const shadowSamples = status.readback?.samples ?? [];
  const baselineSamples = new Map(
    (baseline.readback?.samples ?? []).map((sample) => [sample.id, sample]),
  );
  let maxDarkening = 0;

  for (const shadowSample of shadowSamples) {
    const baselineSample = baselineSamples.get(shadowSample.id);

    if (baselineSample === undefined) {
      continue;
    }

    maxDarkening = Math.max(
      maxDarkening,
      sampleLuminance(baselineSample) - sampleLuminance(shadowSample),
    );
  }

  return maxDarkening;
}

function sampleLuminance(sample: {
  readonly pixel: { readonly r: number; readonly g: number; readonly b: number };
}): number {
  const pixel = sample.pixel;
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
