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
  };
  readonly resourceKey: string;
}

interface ClusteredLightsStatus extends ExampleStatusBase {
  readonly pipelineKeys?: readonly string[];
  readonly localLightClusters?:
    | (LocalLightClusterRouteStatus & {
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
      })
    | null;
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
    readonly routeSpotShadowSamplingOk: boolean;
    readonly routeCookieSamplingOk: boolean;
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
      readonly pixel: {
        readonly r: number;
        readonly g: number;
        readonly b: number;
      };
    }[];
  };
  readonly shadowStatus?: {
    readonly enabled: boolean;
    readonly supported: boolean;
    readonly mode?: string;
    readonly casterDraws?: number;
    readonly faceCount?: number;
    readonly submission?: string;
    readonly point?: {
      readonly enabled: boolean;
      readonly supported: boolean;
      readonly mode?: string;
      readonly casterDraws?: number;
      readonly faceCount?: number;
      readonly submission?: string;
    };
    readonly spot?: {
      readonly enabled: boolean;
      readonly supported: boolean;
      readonly mode?: string;
      readonly casterDraws?: number;
      readonly faceCount?: number;
      readonly submission?: string;
    };
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

  await page.goto(
    "/examples/clustered-lights.html?disable-cluster-point-shadow=1&disable-cluster-spot-shadow=1",
  );
  await page.bringToFront();

  const baseline = await waitForExampleStatus<ClusteredLightsStatus>(page);

  await attachExampleStatus("clustered-lights-baseline-status", baseline);
  expect(
    baseline,
    "clustered lights baseline status should publish",
  ).toBeDefined();

  if (baseline === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(baseline);
  expectStatusJsonSafeForGpu(baseline);

  const spotPage = await page.context().newPage();
  const spotWebGpuValidation = attachWebGpuValidationConsoleGuard(spotPage);

  await spotPage.goto(
    "/examples/clustered-lights.html?disable-cluster-point-shadow=1&enable-cluster-spot-shadow=1",
  );
  await spotPage.bringToFront();

  const spotOnly = await waitForExampleStatus<ClusteredLightsStatus>(spotPage);

  await attachExampleStatus("clustered-lights-spot-status", spotOnly);
  expect(spotOnly, "clustered lights spot status should publish").toBeDefined();

  if (spotOnly === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(spotOnly);
  expectStatusJsonSafeForGpu(spotOnly);

  const cookiePage = await page.context().newPage();
  const cookieWebGpuValidation = attachWebGpuValidationConsoleGuard(cookiePage);

  await cookiePage.goto(
    "/examples/clustered-lights.html?disable-cluster-point-shadow=1&enable-cluster-cookie=1",
  );
  await cookiePage.bringToFront();

  const cookie = await waitForExampleStatus<ClusteredLightsStatus>(cookiePage);

  await attachExampleStatus("clustered-lights-cookie-status", cookie);
  expect(cookie, "clustered lights cookie status should publish").toBeDefined();

  if (cookie === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(cookie);
  expectStatusJsonSafeForGpu(cookie);

  const cookieOnlyPage = await page.context().newPage();
  const cookieOnlyWebGpuValidation =
    attachWebGpuValidationConsoleGuard(cookieOnlyPage);

  await cookieOnlyPage.goto(
    "/examples/clustered-lights.html?enable-cluster-cookie-only=1",
  );
  await cookieOnlyPage.bringToFront();

  const cookieOnly =
    await waitForExampleStatus<ClusteredLightsStatus>(cookieOnlyPage);

  await attachExampleStatus("clustered-lights-cookie-only-status", cookieOnly);
  expect(
    cookieOnly,
    "clustered lights cookie-only status should publish",
  ).toBeDefined();

  if (cookieOnly === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(cookieOnly);
  expectStatusJsonSafeForGpu(cookieOnly);

  const pointCookiePage = await page.context().newPage();
  const pointCookieWebGpuValidation =
    attachWebGpuValidationConsoleGuard(pointCookiePage);

  await pointCookiePage.goto(
    "/examples/clustered-lights.html?enable-cluster-point-cookie=1",
  );
  await pointCookiePage.bringToFront();

  const pointCookie =
    await waitForExampleStatus<ClusteredLightsStatus>(pointCookiePage);

  await attachExampleStatus(
    "clustered-lights-point-cookie-status",
    pointCookie,
  );
  expect(
    pointCookie,
    "clustered lights point-cookie status should publish",
  ).toBeDefined();

  if (pointCookie === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(pointCookie);
  expectStatusJsonSafeForGpu(pointCookie);

  const shadowPage = await page.context().newPage();
  const shadowWebGpuValidation = attachWebGpuValidationConsoleGuard(shadowPage);

  await shadowPage.goto("/examples/clustered-lights.html");
  await shadowPage.bringToFront();

  const status = await waitForExampleStatus<ClusteredLightsStatus>(shadowPage);

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
      routeSpotShadowSamplingOk: false,
    },
    counts: {
      meshDraws: 4,
      diagnostics: 0,
    },
    shadowStatus: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-cube-compare",
      point: {
        enabled: true,
        supported: true,
        mode: "clustered-point-depth-cube-compare",
        casterDraws: 1,
        faceCount: 6,
        submission: "submitted",
      },
      spot: {
        enabled: false,
        supported: false,
      },
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
    expect(route.totalLocalLights).toBeGreaterThanOrEqual(64);
    expect(route.clusteredLocalLights).toBeGreaterThanOrEqual(64);
    expect(route.maxLightsPerPopulatedCell).toBeLessThan(64);
    expect(route.averageLightsPerPopulatedCell).toBeLessThan(64);
    expect(route.buildPressure?.assignmentStrategy).toBe("light-range");
    expect(route.buildPressure?.lightCellRangeTests).toBe(
      route.clusteredLocalLights,
    );
    expect(route.buildPressure?.storedLightReferences).toBe(
      route.totalAssignedLightReferences,
    );
    expect(route.buildPressure?.lightCellWriteAttempts ?? 0).toBeLessThan(
      route.buildPressure?.naiveCellLightPairTests ?? 0,
    );
    expect(
      route.shadowCookieMetadata?.shadow.localRequestCount ?? 0,
    ).toBeGreaterThanOrEqual(4);
    expect(
      route.shadowCookieMetadata?.shadow.clusteredLightCount ?? 0,
    ).toBeGreaterThanOrEqual(4);
    expect(route.shadowCookieMetadata?.cookie).toMatchObject({
      status: "not-requested",
      samplingSupported: false,
      localRequestCount: 0,
      clusteredLightCount: 0,
      supportedLightCount: 0,
      fallbackReason: null,
    });
    expect(route.shadowCookieMetadata).toMatchObject({
      wordsPerLight: 4,
      totalMetadataLights: 130,
    });
  }
  expect(spotOnly.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routeSpotShadowSamplingOk: true,
    routeCookieSamplingOk: false,
  });
  expect(spotOnly.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-spot-depth-compare",
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-depth-compare",
      casterDraws: 1,
      faceCount: 1,
      submission: "submitted",
    },
  });
  expect(spotOnly.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|shadowMap|opaque|back|less|none",
  );
  expect(cookie.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routeSpotShadowSamplingOk: true,
    routeCookieSamplingOk: true,
  });
  expect(cookie.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-spot-depth-compare",
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-depth-compare",
      casterDraws: 1,
      faceCount: 1,
      submission: "submitted",
    },
  });
  expect(cookie.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|shadowMap|opaque|back|less|none",
  );
  expect(
    (cookie.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 1 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 1 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 1,
    ),
  ).toBe(true);
  expect(cookieOnly.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: false,
    routeSpotShadowSamplingOk: false,
    routeCookieSamplingOk: true,
  });
  expect(cookieOnly.shadowStatus).toMatchObject({
    enabled: false,
    supported: false,
    mode: "clustered-shadow-unavailable",
    point: {
      enabled: false,
      supported: false,
    },
    spot: {
      enabled: false,
      supported: false,
    },
  });
  expect(cookieOnly.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|opaque|back|less|none",
  );
  expect(cookieOnly.pipelineKeys ?? []).not.toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|shadowMap|opaque|back|less|none",
  );
  expect(
    (cookieOnly.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 1 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 1 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 1,
    ),
  ).toBe(true);
  expect(
    (cookieOnly.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true,
    ),
  ).toBe(false);
  expect(pointCookie.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: false,
    routeSpotShadowSamplingOk: false,
    routeCookieSamplingOk: true,
  });
  expect(pointCookie.shadowStatus).toMatchObject({
    enabled: false,
    supported: false,
    mode: "clustered-shadow-unavailable",
    point: {
      enabled: false,
      supported: false,
    },
    spot: {
      enabled: false,
      supported: false,
    },
  });
  expect(pointCookie.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|clusteredLocalLightCubeCookies|opaque|back|less|none",
  );
  expect(pointCookie.pipelineKeys ?? []).not.toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|clusteredLocalLightCubeCookies|pointShadowMap|opaque|back|less|none",
  );
  expect(pointCookie.pipelineKeys ?? []).not.toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|clusteredLocalLightCubeCookies|shadowMap|opaque|back|less|none",
  );
  expect(
    (pointCookie.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 1 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 1 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 1,
    ),
  ).toBe(true);
  expect(maxSampleLuminanceDarkening(baseline, spotOnly)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(spotOnly, cookie)).toBeGreaterThan(12);
  expect(maxSampleLuminanceDelta(baseline, pointCookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDarkening(baseline, status)).toBeGreaterThan(3);
  expect(status.readbackStatus?.ok).toBe(true);
  expect(status.readbackStatus?.maxClearDistance ?? 0).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
  spotWebGpuValidation.expectNoWarnings();
  cookieWebGpuValidation.expectNoWarnings();
  cookieOnlyWebGpuValidation.expectNoWarnings();
  pointCookieWebGpuValidation.expectNoWarnings();
  shadowWebGpuValidation.expectNoWarnings();
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

function maxSampleLuminanceDelta(
  a: ClusteredLightsStatus,
  b: ClusteredLightsStatus,
): number {
  const aSamples = new Map(
    (a.readback?.samples ?? []).map((sample) => [sample.id, sample]),
  );
  let maxDelta = 0;

  for (const bSample of b.readback?.samples ?? []) {
    const aSample = aSamples.get(bSample.id);

    if (aSample === undefined) {
      continue;
    }

    maxDelta = Math.max(
      maxDelta,
      Math.abs(sampleLuminance(aSample) - sampleLuminance(bSample)),
    );
  }

  return maxDelta;
}

function sampleLuminance(sample: {
  readonly pixel: {
    readonly r: number;
    readonly g: number;
    readonly b: number;
  };
}): number {
  const pixel = sample.pixel;
  return pixel.r * 0.2126 + pixel.g * 0.7152 + pixel.b * 0.0722;
}
