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
      readonly hardFilterLightCount?: number;
      readonly softFilterLightCount?: number;
      readonly maxFilterRadiusTexels?: number;
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
    readonly routeMultiSpotShadowSamplingOk?: boolean;
    readonly routeSpotShadowAtlasSamplingOk?: boolean;
    readonly routeMixedShadowSamplingOk: boolean;
    readonly routeMixedPackedSpotShadowSamplingOk?: boolean;
    readonly routeMixedPackedSpotShadowAtlasSamplingOk?: boolean;
    readonly routeMultiPointShadowSamplingOk?: boolean;
    readonly routePackedShadowCookieShadowReady?: boolean;
    readonly routePackedShadowCookieCookieReady?: boolean;
    readonly routePackedShadowCookiePipelineOk?: boolean;
    readonly routePackedShadowCookieSamplingOk?: boolean;
    readonly routeCookieSamplingOk: boolean;
    readonly routeCookieAtlasSamplingOk?: boolean;
    readonly requiredPointShadowSupportedCount?: number;
    readonly requiredSpotShadowSupportedCount?: number;
    readonly requiredCookieSupportedCount?: number;
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
      readonly supportedLightCount?: number;
      readonly layerCount?: number;
      readonly shadowIds?: readonly number[];
      readonly lightIds?: readonly number[];
    };
    readonly spot?: {
      readonly enabled: boolean;
      readonly supported: boolean;
      readonly mode?: string;
      readonly casterDraws?: number;
      readonly faceCount?: number;
      readonly submission?: string;
      readonly supportedLightCount?: number;
      readonly layerCount?: number;
      readonly atlasWidth?: number;
      readonly atlasHeight?: number;
      readonly atlasTiles?: readonly {
        readonly shadowId: number;
        readonly lightId: number;
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      }[];
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

  const multiSpotPage = await page.context().newPage();
  const multiSpotWebGpuValidation =
    attachWebGpuValidationConsoleGuard(multiSpotPage);

  await multiSpotPage.goto(
    "/examples/clustered-lights.html?enable-cluster-multi-spot-shadow=1",
  );
  await multiSpotPage.bringToFront();

  const multiSpot =
    await waitForExampleStatus<ClusteredLightsStatus>(multiSpotPage);

  await attachExampleStatus("clustered-lights-multi-spot-status", multiSpot);
  expect(
    multiSpot,
    "clustered lights multi-spot status should publish",
  ).toBeDefined();

  if (multiSpot === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(multiSpot);
  expectStatusJsonSafeForGpu(multiSpot);

  const atlasSpotPage = await page.context().newPage();
  const atlasSpotWebGpuValidation =
    attachWebGpuValidationConsoleGuard(atlasSpotPage);

  await atlasSpotPage.goto(
    "/examples/clustered-lights.html?enable-cluster-spot-shadow-atlas=1",
  );
  await atlasSpotPage.bringToFront();

  const atlasSpot =
    await waitForExampleStatus<ClusteredLightsStatus>(atlasSpotPage);

  await attachExampleStatus("clustered-lights-atlas-spot-status", atlasSpot);
  expect(
    atlasSpot,
    "clustered lights atlas-spot status should publish",
  ).toBeDefined();

  if (atlasSpot === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(atlasSpot);
  expectStatusJsonSafeForGpu(atlasSpot);

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

  const multiCookiePage = await page.context().newPage();
  const multiCookieWebGpuValidation =
    attachWebGpuValidationConsoleGuard(multiCookiePage);

  await multiCookiePage.goto(
    "/examples/clustered-lights.html?enable-cluster-multi-cookie=1",
  );
  await multiCookiePage.bringToFront();

  const multiCookie =
    await waitForExampleStatus<ClusteredLightsStatus>(multiCookiePage);

  await attachExampleStatus(
    "clustered-lights-multi-cookie-status",
    multiCookie,
  );
  expect(
    multiCookie,
    "clustered lights multi-cookie status should publish",
  ).toBeDefined();

  if (multiCookie === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(multiCookie);
  expectStatusJsonSafeForGpu(multiCookie);

  const atlasCookiePage = await page.context().newPage();
  const atlasCookieWebGpuValidation =
    attachWebGpuValidationConsoleGuard(atlasCookiePage);

  await atlasCookiePage.goto(
    "/examples/clustered-lights.html?enable-cluster-cookie-atlas=1",
  );
  await atlasCookiePage.bringToFront();

  const atlasCookie =
    await waitForExampleStatus<ClusteredLightsStatus>(atlasCookiePage);

  await attachExampleStatus(
    "clustered-lights-atlas-cookie-status",
    atlasCookie,
  );
  expect(
    atlasCookie,
    "clustered lights atlas-cookie status should publish",
  ).toBeDefined();

  if (atlasCookie === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(atlasCookie);
  expectStatusJsonSafeForGpu(atlasCookie);

  const mixedCookiePage = await page.context().newPage();
  const mixedCookieWebGpuValidation =
    attachWebGpuValidationConsoleGuard(mixedCookiePage);

  await mixedCookiePage.goto(
    "/examples/clustered-lights.html?enable-cluster-mixed-cookie=1",
  );
  await mixedCookiePage.bringToFront();

  const mixedCookie =
    await waitForExampleStatus<ClusteredLightsStatus>(mixedCookiePage);

  await attachExampleStatus(
    "clustered-lights-mixed-cookie-status",
    mixedCookie,
  );
  expect(
    mixedCookie,
    "clustered lights mixed-cookie status should publish",
  ).toBeDefined();

  if (mixedCookie === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(mixedCookie);
  expectStatusJsonSafeForGpu(mixedCookie);

  const mixedShadowPage = await page.context().newPage();
  const mixedShadowWebGpuValidation =
    attachWebGpuValidationConsoleGuard(mixedShadowPage);

  await mixedShadowPage.goto(
    "/examples/clustered-lights.html?enable-cluster-mixed-shadow=1",
  );
  await mixedShadowPage.bringToFront();

  const mixedShadow =
    await waitForExampleStatus<ClusteredLightsStatus>(mixedShadowPage);

  await attachExampleStatus(
    "clustered-lights-mixed-shadow-status",
    mixedShadow,
  );
  expect(
    mixedShadow,
    "clustered lights mixed-shadow status should publish",
  ).toBeDefined();

  if (mixedShadow === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(mixedShadow);
  expectStatusJsonSafeForGpu(mixedShadow);

  const packedShadowPage = await page.context().newPage();
  const packedShadowWebGpuValidation =
    attachWebGpuValidationConsoleGuard(packedShadowPage);

  await packedShadowPage.goto(
    "/examples/clustered-lights.html?enable-cluster-packed-shadow=1",
  );
  await packedShadowPage.bringToFront();

  const packedShadow =
    await waitForExampleStatus<ClusteredLightsStatus>(packedShadowPage);

  await attachExampleStatus(
    "clustered-lights-packed-shadow-status",
    packedShadow,
  );
  expect(
    packedShadow,
    "clustered lights packed-shadow status should publish",
  ).toBeDefined();

  if (packedShadow === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(packedShadow);
  expectStatusJsonSafeForGpu(packedShadow);

  const packedShadowCookiePage = await page.context().newPage();
  const packedShadowCookieWebGpuValidation = attachWebGpuValidationConsoleGuard(
    packedShadowCookiePage,
  );

  await packedShadowCookiePage.goto(
    "/examples/clustered-lights.html?enable-cluster-shadow-cookie=1",
  );
  await packedShadowCookiePage.bringToFront();

  const packedShadowCookie = await waitForExampleStatus<ClusteredLightsStatus>(
    packedShadowCookiePage,
  );

  await attachExampleStatus(
    "clustered-lights-packed-shadow-cookie-status",
    packedShadowCookie,
  );
  expect(
    packedShadowCookie,
    "clustered lights packed-shadow-cookie status should publish",
  ).toBeDefined();

  if (packedShadowCookie === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(packedShadowCookie);
  expectStatusJsonSafeForGpu(packedShadowCookie);

  const multiPointShadowPage = await page.context().newPage();
  const multiPointShadowWebGpuValidation =
    attachWebGpuValidationConsoleGuard(multiPointShadowPage);

  await multiPointShadowPage.goto(
    "/examples/clustered-lights.html?enable-cluster-multi-point-shadow=1",
  );
  await multiPointShadowPage.bringToFront();

  const multiPointShadow =
    await waitForExampleStatus<ClusteredLightsStatus>(multiPointShadowPage);

  await attachExampleStatus(
    "clustered-lights-multi-point-shadow-status",
    multiPointShadow,
  );
  expect(
    multiPointShadow,
    "clustered lights multi-point-shadow status should publish",
  ).toBeDefined();

  if (multiPointShadow === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(multiPointShadow);
  expectStatusJsonSafeForGpu(multiPointShadow);

  const packedShadowAtlasPage = await page.context().newPage();
  const packedShadowAtlasWebGpuValidation = attachWebGpuValidationConsoleGuard(
    packedShadowAtlasPage,
  );

  await packedShadowAtlasPage.goto(
    "/examples/clustered-lights.html?enable-cluster-packed-shadow-atlas=1",
  );
  await packedShadowAtlasPage.bringToFront();

  const packedShadowAtlas = await waitForExampleStatus<ClusteredLightsStatus>(
    packedShadowAtlasPage,
  );

  await attachExampleStatus(
    "clustered-lights-packed-shadow-atlas-status",
    packedShadowAtlas,
  );
  expect(
    packedShadowAtlas,
    "clustered lights packed-shadow-atlas status should publish",
  ).toBeDefined();

  if (packedShadowAtlas === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(packedShadowAtlas);
  expectStatusJsonSafeForGpu(packedShadowAtlas);

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
      routeMixedShadowSamplingOk: false,
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
      wordsPerLight: 5,
    });
    expect(route.shadowCookieMetadata?.totalMetadataLights).toBe(
      route.totalLocalLights,
    );
  }
  expect(spotOnly.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routeSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: false,
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
  expect(multiSpot.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: false,
    routeCookieSamplingOk: false,
    requiredSpotShadowSupportedCount: 2,
  });
  expect(multiSpot.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-spot-array-depth-compare",
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-array-depth-compare",
      casterDraws: 2,
      faceCount: 2,
      supportedLightCount: 2,
      layerCount: 2,
      submission: "submitted",
    },
  });
  expect(multiSpot.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|clusteredLocalLightArrayShadows|shadowMap|opaque|back|less|none",
  );
  expect(
    (multiSpot.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.localRequestCount >= 2 &&
        route.shadowCookieMetadata.shadow.clusteredLightCount >= 2 &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 2,
    ),
  ).toBe(true);
  expect(atlasSpot.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeSpotShadowAtlasSamplingOk: true,
    routeMixedShadowSamplingOk: false,
    routeCookieSamplingOk: false,
    requiredSpotShadowSupportedCount: 2,
  });
  expect(atlasSpot.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-spot-atlas-depth-compare",
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-atlas-depth-compare",
      casterDraws: 2,
      faceCount: 2,
      supportedLightCount: 2,
      layerCount: 1,
      atlasWidth: 384,
      atlasHeight: 256,
      atlasTiles: [
        { x: 0, y: 0, width: 256, height: 256 },
        { x: 256, y: 0, width: 128, height: 128 },
      ],
      submission: "submitted",
    },
  });
  expect(atlasSpot.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|shadowMap|opaque|back|less|none",
  );
  expect(atlasSpot.pipelineKeys ?? []).not.toContain(
    "standard|clusteredLocalLights|clusteredLocalLightArrayShadows|shadowMap|opaque|back|less|none",
  );
  expect(
    (atlasSpot.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.localRequestCount >= 2 &&
        route.shadowCookieMetadata.shadow.clusteredLightCount >= 2 &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 2,
    ),
  ).toBe(true);
  expect(cookie.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routeSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: false,
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
    routeMixedShadowSamplingOk: false,
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
    routeMixedShadowSamplingOk: false,
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
  expect(multiCookie.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: false,
    routeSpotShadowSamplingOk: false,
    routeMixedShadowSamplingOk: false,
    routeCookieSamplingOk: true,
  });
  expect(multiCookie.shadowStatus).toMatchObject({
    enabled: false,
    supported: false,
    mode: "clustered-shadow-unavailable",
  });
  expect(multiCookie.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|clusteredLocalLightArrayCookies|opaque|back|less|none",
  );
  expect(
    (multiCookie.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 2 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 2 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 2,
    ),
  ).toBe(true);
  expect(multiCookie.readbackStatus?.luminanceRange ?? 0).toBeGreaterThan(12);
  expect(atlasCookie.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: false,
    routeSpotShadowSamplingOk: false,
    routeMixedShadowSamplingOk: false,
    routeCookieSamplingOk: true,
    routeCookieAtlasSamplingOk: true,
    requiredCookieSupportedCount: 2,
  });
  expect(atlasCookie.shadowStatus).toMatchObject({
    enabled: false,
    supported: false,
    mode: "clustered-shadow-unavailable",
  });
  expect(atlasCookie.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|opaque|back|less|none",
  );
  expect(atlasCookie.pipelineKeys ?? []).not.toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|clusteredLocalLightArrayCookies|opaque|back|less|none",
  );
  expect(
    (atlasCookie.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 2 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 2 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 2,
    ),
  ).toBe(true);
  expect(atlasCookie.readbackStatus?.luminanceRange ?? 0).toBeGreaterThan(12);
  expect(mixedCookie.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: false,
    routeSpotShadowSamplingOk: false,
    routeMixedShadowSamplingOk: false,
    routeCookieSamplingOk: true,
    requiredCookieSupportedCount: 3,
  });
  expect(mixedCookie.shadowStatus).toMatchObject({
    enabled: false,
    supported: false,
    mode: "clustered-shadow-unavailable",
  });
  expect(mixedCookie.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|clusteredLocalLightCookies|clusteredLocalLightArrayCookies|opaque|back|less|none",
  );
  expect(
    (mixedCookie.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 3 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 3 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 3,
    ),
  ).toBe(true);
  expect(mixedCookie.readbackStatus?.luminanceRange ?? 0).toBeGreaterThan(12);
  expect(mixedShadow.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: true,
    routeSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: true,
    routeCookieSamplingOk: false,
  });
  expect(mixedShadow.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-point-spot-depth-compare",
    point: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-cube-compare",
      casterDraws: 1,
      faceCount: 6,
      submission: "submitted",
    },
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-depth-compare",
      casterDraws: 1,
      faceCount: 1,
      submission: "submitted",
    },
  });
  expect(mixedShadow.pipelineKeys ?? []).toContain(
    "standard|clusteredLocalLights|pointShadowMap|shadowMap|opaque|back|less|none",
  );
  expect(
    (mixedShadow.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.localRequestCount >= 5 &&
        route.shadowCookieMetadata.shadow.clusteredLightCount >= 5 &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 1,
    ),
  ).toBe(true);
  expect(mixedShadow.readbackStatus?.ok).toBe(true);
  expect(mixedShadow.readbackStatus?.maxClearDistance ?? 0).toBeGreaterThan(24);
  expect(packedShadow.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: true,
    routeMixedPackedSpotShadowSamplingOk: true,
    routeCookieSamplingOk: false,
  });
  expect(packedShadow.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-point-spot-array-depth-compare",
    point: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-cube-compare",
    },
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-array-depth-compare",
      supportedLightCount: 2,
      layerCount: 2,
    },
  });
  expect(
    (packedShadow.pipelineKeys ?? []).some(
      (pipelineKey) =>
        pipelineKey.startsWith("standard|") &&
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightArrayShadows") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap"),
    ),
  ).toBe(true);
  expect(packedShadow.readbackStatus?.ok).toBe(true);
  expect(packedShadow.readbackStatus?.maxClearDistance ?? 0).toBeGreaterThan(
    24,
  );
  expect(packedShadowCookie.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: true,
    routeMixedPackedSpotShadowSamplingOk: true,
    routeCookieSamplingOk: true,
    routePackedShadowCookieShadowReady: true,
    routePackedShadowCookieCookieReady: true,
    routePackedShadowCookiePipelineOk: true,
    routePackedShadowCookieSamplingOk: true,
    requiredPointShadowSupportedCount: 1,
    requiredSpotShadowSupportedCount: 2,
    requiredCookieSupportedCount: 1,
  });
  expect(packedShadowCookie.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-point-spot-array-depth-compare",
    point: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-cube-compare",
      supportedLightCount: 1,
    },
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-array-depth-compare",
      supportedLightCount: 2,
      layerCount: 2,
    },
  });
  expect(
    (packedShadowCookie.pipelineKeys ?? []).some(
      (pipelineKey) =>
        pipelineKey.startsWith("standard|") &&
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightCookies") &&
        pipelineKey.includes("clusteredLocalLightShadowCookies") &&
        pipelineKey.includes("clusteredLocalLightArrayShadows") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap"),
    ),
  ).toBe(true);
  expect(
    (packedShadowCookie.localLightClusters?.routes ?? []).some(
      (route) =>
        (route.layerMask ?? 0) === 2 &&
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.localRequestCount >= 6 &&
        route.shadowCookieMetadata.shadow.clusteredLightCount >= 6 &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 3 &&
        route.shadowCookieMetadata.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 1 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 1 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 1,
    ),
  ).toBe(true);
  expect(packedShadowCookie.readbackStatus?.ok).toBe(true);
  expect(
    packedShadowCookie.readbackStatus?.maxClearDistance ?? 0,
  ).toBeGreaterThan(24);
  expect(multiPointShadow.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: true,
    routeMixedPackedSpotShadowSamplingOk: true,
    routeMultiPointShadowSamplingOk: true,
    routeCookieSamplingOk: false,
    requiredPointShadowSupportedCount: 2,
    requiredSpotShadowSupportedCount: 2,
  });
  expect(multiPointShadow.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-point-array-spot-array-depth-compare",
    point: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-2d-array-compare",
      supportedLightCount: 2,
      layerCount: 12,
    },
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-array-depth-compare",
      supportedLightCount: 2,
      layerCount: 2,
    },
  });
  expect(multiPointShadow.shadowStatus?.point?.shadowIds ?? []).toHaveLength(2);
  expect(multiPointShadow.shadowStatus?.point?.lightIds ?? []).toHaveLength(2);
  expect(
    (multiPointShadow.pipelineKeys ?? []).some(
      (pipelineKey) =>
        pipelineKey.startsWith("standard|") &&
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightArrayShadows") &&
        pipelineKey.includes("clusteredLocalLightPointArrayShadows") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap"),
    ),
  ).toBe(true);
  expect(
    (multiPointShadow.localLightClusters?.routes ?? []).some(
      (route) =>
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.localRequestCount >= 5 &&
        route.shadowCookieMetadata.shadow.clusteredLightCount >= 5 &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 2,
    ),
  ).toBe(true);
  expect(multiPointShadow.readbackStatus?.ok).toBe(true);
  expect(
    multiPointShadow.readbackStatus?.maxClearDistance ?? 0,
  ).toBeGreaterThan(24);
  expect(packedShadowAtlas.clusterStatus).toMatchObject({
    ok: true,
    routeMetadataOk: true,
    routePointShadowSamplingOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeSpotShadowAtlasSamplingOk: true,
    routeMixedShadowSamplingOk: true,
    routeMixedPackedSpotShadowAtlasSamplingOk: true,
    routeCookieSamplingOk: false,
  });
  expect(packedShadowAtlas.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-point-spot-atlas-depth-compare",
    point: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-cube-compare",
    },
    spot: {
      enabled: true,
      supported: true,
      mode: "clustered-spot-atlas-depth-compare",
      supportedLightCount: 2,
      atlasWidth: 384,
      atlasHeight: 256,
    },
  });
  expect(
    (packedShadowAtlas.pipelineKeys ?? []).some(
      (pipelineKey) =>
        pipelineKey.startsWith("standard|") &&
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap") &&
        !pipelineKey.includes("clusteredLocalLightArrayShadows"),
    ),
  ).toBe(true);
  expect(packedShadowAtlas.readbackStatus?.ok).toBe(true);
  expect(
    packedShadowAtlas.readbackStatus?.maxClearDistance ?? 0,
  ).toBeGreaterThan(24);
  expect(maxSampleLuminanceDarkening(baseline, spotOnly)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDarkening(baseline, multiSpot)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(spotOnly, cookie)).toBeGreaterThan(12);
  expect(maxSampleLuminanceDelta(baseline, pointCookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(baseline, atlasCookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(baseline, mixedCookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDarkening(baseline, status)).toBeGreaterThan(3);
  expect(maxSampleLuminanceDelta(spotOnly, mixedShadow)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(status, mixedShadow)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(multiSpot, packedShadow)).toBeGreaterThan(1);
  expect(
    maxSampleLuminanceDelta(packedShadow, packedShadowCookie),
  ).toBeGreaterThan(1);
  expect(maxSampleLuminanceDelta(cookie, packedShadowCookie)).toBeGreaterThan(
    1,
  );
  expect(maxSampleLuminanceDelta(atlasSpot, packedShadowAtlas)).toBeGreaterThan(
    1,
  );
  expect(status.readbackStatus?.ok).toBe(true);
  expect(status.readbackStatus?.maxClearDistance ?? 0).toBeGreaterThan(24);
  expect(maxSampleLuminanceDarkening(baseline, atlasSpot)).toBeGreaterThan(2);
  webGpuValidation.expectNoWarnings();
  spotWebGpuValidation.expectNoWarnings();
  multiSpotWebGpuValidation.expectNoWarnings();
  atlasSpotWebGpuValidation.expectNoWarnings();
  cookieWebGpuValidation.expectNoWarnings();
  cookieOnlyWebGpuValidation.expectNoWarnings();
  pointCookieWebGpuValidation.expectNoWarnings();
  multiCookieWebGpuValidation.expectNoWarnings();
  atlasCookieWebGpuValidation.expectNoWarnings();
  mixedCookieWebGpuValidation.expectNoWarnings();
  mixedShadowWebGpuValidation.expectNoWarnings();
  packedShadowWebGpuValidation.expectNoWarnings();
  packedShadowCookieWebGpuValidation.expectNoWarnings();
  multiPointShadowWebGpuValidation.expectNoWarnings();
  packedShadowAtlasWebGpuValidation.expectNoWarnings();
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
