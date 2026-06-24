import { expect, test } from "@playwright/test";

import {
  attachWebGpuValidationConsoleGuard,
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";
import { createPersistentExampleRouteHarness } from "./persistent-route-harness.js";

const DEFERRED_CLUSTERED_SHADOW_WARNING =
  "webGpuApp.clusteredLocalShadowSamplingDeferred";

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

interface ClusterPressureWorkStatus {
  readonly clusterBufferWrites: number;
  readonly cookieAtlasTileUpdates: number;
  readonly localShadowSubmissions: number;
}

interface ClusterPressureHistoryStatus {
  readonly enabled: boolean;
  readonly ready: boolean;
  readonly requiredFrames: number;
  readonly observedFrames: number;
  readonly rollingWindowSize: number;
  readonly baselineMode: "disabled" | "derived-no-cache";
  readonly firstFrame?: number;
  readonly lastFrame?: number;
  readonly cachedPath: ClusterPressureWorkStatus;
  readonly noCacheBaseline: ClusterPressureWorkStatus;
  readonly avoided: ClusterPressureWorkStatus;
  readonly reduction: {
    readonly cachedWork: number;
    readonly baselineWork: number;
    readonly avoidedWork: number;
  };
  readonly stablePixels: {
    readonly ready: boolean;
    readonly baselineFrame: number | null;
    readonly baselineLuminance: number | null;
    readonly latestLuminance: number | null;
    readonly maxLuminanceDelta: number;
    readonly sampleCount: number;
  };
  readonly samples: readonly {
    readonly frame: number;
    readonly cachedPath: ClusterPressureWorkStatus;
    readonly noCacheBaseline: ClusterPressureWorkStatus;
    readonly avoided: ClusterPressureWorkStatus;
  }[];
}

interface ClusteredShadowCacheStatus {
  readonly enabled: boolean;
  readonly lastAction: "hit" | "miss";
  readonly hitCount: number;
  readonly missCount: number;
  readonly submittedShadowPassCount: number;
  readonly skippedShadowPassCount: number;
  readonly submittedCommandBuffers: number;
  readonly skippedCommandBuffers: number;
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
    readonly routePackedSpotShadowAtlasSamplingOk?: boolean;
    readonly routeMultiPointShadowSamplingOk?: boolean;
    readonly routePackedShadowCookieShadowReady?: boolean;
    readonly routePackedShadowCookieCookieReady?: boolean;
    readonly routePackedShadowCookiePipelineOk?: boolean;
    readonly routePackedShadowCookieSamplingOk?: boolean;
    readonly routePackedShadowCookiePointArrayReady?: boolean;
    readonly routePackedShadowCookiePointArraySamplingOk?: boolean;
    readonly routePackedShadowCookieAtlasShadowReady?: boolean;
    readonly routePackedShadowCookieAtlasCookieReady?: boolean;
    readonly routePackedShadowCookieAtlasShadowAligned?: boolean;
    readonly routePackedShadowCookieAtlasSamplingOk?: boolean;
    readonly routeDynamicShadowCookieAtlasReady?: boolean;
    readonly routeClusteredShadowCacheReady?: boolean;
    readonly routeClusteredBufferCacheReady?: boolean;
    readonly dynamicShadowCookieAtlasStatus?: {
      readonly enabled: boolean;
      readonly ready: boolean;
      readonly shadowAligned: boolean;
      readonly atlasWidth: number;
      readonly atlasHeight: number;
      readonly assignedSlotCount: number;
      readonly reusedSlotCount: number;
      readonly staleSlotCount: number;
      readonly evictedSlotCount: number;
      readonly maxReusedSlotCount: number;
      readonly maxStaleSlotCount: number;
      readonly maxEvictedSlotCount: number;
      readonly diagnosticsCount: number;
    };
    readonly routeCookieSamplingOk: boolean;
    readonly routeCookieAtlasSamplingOk?: boolean;
    readonly requiredPointShadowSupportedCount?: number;
    readonly requiredSpotShadowSupportedCount?: number;
    readonly requiredCookieSupportedCount?: number;
    readonly routes: readonly LocalLightClusterRouteStatus[];
    readonly buffersCreated: number;
    readonly buffersReused: number;
  };
  readonly clusterPressureHistoryStatus?: ClusterPressureHistoryStatus;
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
      readonly cache?: ClusteredShadowCacheStatus;
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
        readonly allocationKey?: string | null;
        readonly reused?: boolean;
      }[];
      readonly cache?: ClusteredShadowCacheStatus;
    };
  };
  readonly counts?: {
    readonly meshDraws: number;
    readonly drawCalls: number;
    readonly diagnostics: number;
  };
  readonly diagnostics?: readonly {
    readonly code?: string;
    readonly severity?: string;
  }[];
}

test("renders the forward route through the single-encoder FrameGraph (M3-T4)", async ({
  page,
}) => {
  // M3-T4: with ?graph=1 the whole forward frame is encoded into ONE command
  // buffer via the FrameGraph path. The lit clustered-lights scene must render
  // byte-correctly (same luminance variation as the legacy path) with no WebGPU
  // validation warnings.
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/clustered-lights.html?disable-cluster-point-shadow=1&disable-cluster-spot-shadow=1&graph=1",
  );
  await page.bringToFront();

  const status = await waitForExampleStatus<ClusteredLightsStatus>(page);
  await attachExampleStatus("clustered-lights-frame-graph-status", status);
  expect(status, "clustered lights graph status should publish").toBeDefined();
  if (status === undefined) {
    return;
  }
  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);

  expect(status.phase).toBe("submit");
  expect(status.counts?.diagnostics ?? 0).toBe(0);
  expect(status.clusterStatus?.clusterPipelineUsed).toBe(true);
  // the forward route rendered the lit scene (readback ok + real luminance)
  expect(status.readbackStatus?.ok).toBe(true);
  expect(status.readbackStatus?.luminanceRange ?? 0).toBeGreaterThan(12);
  expect(status.counts?.meshDraws ?? 0).toBeGreaterThan(0);

  webGpuValidation.expectNoWarnings();
});

test("browser renders StandardMaterial through clustered local lights", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);
  const context = page.context();

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
  await page.close();

  const spotPage = await context.newPage();
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
  await spotPage.close();

  const multiSpotPage = await context.newPage();
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
  await multiSpotPage.close();

  const atlasSpotPage = await context.newPage();
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
  await atlasSpotPage.close();

  const cookiePage = await context.newPage();
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
  await cookiePage.close();

  const cookieOnlyPage = await context.newPage();
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
  await cookieOnlyPage.close();

  const pointCookiePage = await context.newPage();
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
  await pointCookiePage.close();

  const multiCookiePage = await context.newPage();
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
  await multiCookiePage.close();

  const atlasCookiePage = await context.newPage();
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
  await atlasCookiePage.close();

  const mixedCookiePage = await context.newPage();
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
  await mixedCookiePage.close();

  const mixedShadowPage = await context.newPage();
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
  await mixedShadowPage.close();

  const packedShadowPage = await context.newPage();
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
  await packedShadowPage.close();

  const packedShadowCookiePage = await context.newPage();
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
  await packedShadowCookiePage.close();

  const packedShadowCookiePointArrayPage = await context.newPage();
  const packedShadowCookiePointArrayWebGpuValidation =
    attachWebGpuValidationConsoleGuard(packedShadowCookiePointArrayPage);

  await packedShadowCookiePointArrayPage.goto(
    "/examples/clustered-lights.html?enable-cluster-shadow-cookie-point-array=1",
  );
  await packedShadowCookiePointArrayPage.bringToFront();

  const packedShadowCookiePointArray =
    await waitForExampleStatus<ClusteredLightsStatus>(
      packedShadowCookiePointArrayPage,
    );

  await attachExampleStatus(
    "clustered-lights-packed-shadow-cookie-point-array-status",
    packedShadowCookiePointArray,
  );
  expect(
    packedShadowCookiePointArray,
    "clustered lights packed-shadow-cookie point-array status should publish",
  ).toBeDefined();

  if (packedShadowCookiePointArray === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(packedShadowCookiePointArray);
  expectStatusJsonSafeForGpu(packedShadowCookiePointArray);
  await packedShadowCookiePointArrayPage.close();

  const packedShadowCookieAtlasPage = await context.newPage();
  const packedShadowCookieAtlasWebGpuValidation =
    attachWebGpuValidationConsoleGuard(packedShadowCookieAtlasPage);

  await packedShadowCookieAtlasPage.goto(
    "/examples/clustered-lights.html?enable-cluster-shadow-cookie-atlas=1",
  );
  await packedShadowCookieAtlasPage.bringToFront();

  const packedShadowCookieAtlas =
    await waitForExampleStatus<ClusteredLightsStatus>(
      packedShadowCookieAtlasPage,
    );

  await attachExampleStatus(
    "clustered-lights-packed-shadow-cookie-atlas-status",
    packedShadowCookieAtlas,
  );
  expect(
    packedShadowCookieAtlas,
    "clustered lights packed-shadow-cookie atlas status should publish",
  ).toBeDefined();

  if (packedShadowCookieAtlas === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(packedShadowCookieAtlas);
  expectStatusJsonSafeForGpu(packedShadowCookieAtlas);
  await packedShadowCookieAtlasPage.close();

  const multiPointShadowPage = await context.newPage();
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
  await multiPointShadowPage.close();

  const packedShadowAtlasPage = await context.newPage();
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
  await packedShadowAtlasPage.close();

  const shadowPage = await context.newPage();
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
  await shadowPage.close();
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
    expect(
      route.shadowCookieMetadata?.totalMetadataLights ?? 0,
    ).toBeGreaterThanOrEqual(route.totalLocalLights);
  }
  expect(spotOnly.clusterStatus).toMatchObject({
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
      faceCount: 1,
      submission: "submitted",
    },
  });
  expect(
    (spotOnly.pipelineKeys ?? []).some(
      (key) => key.includes("spotShadowMap") && key.includes("shadowMap"),
    ),
  ).toBe(true);
  expect(multiSpot.clusterStatus).toMatchObject({
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
  expect(
    (atlasSpot.pipelineKeys ?? []).some(
      (key) => key.includes("spotShadowMap") && key.includes("shadowMap"),
    ),
  ).toBe(true);
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
      faceCount: 1,
      submission: "submitted",
    },
  });
  expect(
    (cookie.pipelineKeys ?? []).some(
      (key) =>
        key.includes("clusteredLocalLightCookies") &&
        key.includes("clusteredLocalLightShadowCookies") &&
        key.includes("spotShadowMap") &&
        key.includes("shadowMap"),
    ),
  ).toBe(true);
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
  expect(pointCookie.clusterStatus).toMatchObject({
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
  expect(packedShadowCookiePointArray.clusterStatus).toMatchObject({
    routePointShadowSamplingOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeMixedShadowSamplingOk: true,
    routeMixedPackedSpotShadowSamplingOk: true,
    routeMultiPointShadowSamplingOk: true,
    routeCookieSamplingOk: true,
    routePackedShadowCookieShadowReady: true,
    routePackedShadowCookieCookieReady: true,
    routePackedShadowCookiePipelineOk: true,
    routePackedShadowCookieSamplingOk: true,
    routePackedShadowCookiePointArrayReady: true,
    routePackedShadowCookiePointArraySamplingOk: true,
    requiredPointShadowSupportedCount: 2,
    requiredSpotShadowSupportedCount: 2,
    requiredCookieSupportedCount: 1,
  });
  expect(packedShadowCookiePointArray.shadowStatus).toMatchObject({
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
  expect(
    (packedShadowCookiePointArray.pipelineKeys ?? []).some(
      (pipelineKey) =>
        pipelineKey.startsWith("standard|") &&
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightCookies") &&
        pipelineKey.includes("clusteredLocalLightShadowCookies") &&
        pipelineKey.includes("clusteredLocalLightPointArrayShadows") &&
        pipelineKey.includes("clusteredLocalLightArrayShadows") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap"),
    ),
  ).toBe(true);
  expect(
    (packedShadowCookiePointArray.localLightClusters?.routes ?? []).some(
      (route) =>
        (route.layerMask ?? 0) === 2 &&
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.localRequestCount >= 6 &&
        route.shadowCookieMetadata.shadow.clusteredLightCount >= 6 &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 4 &&
        route.shadowCookieMetadata.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 1 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 1 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 1,
    ),
  ).toBe(true);
  expect(packedShadowCookiePointArray.readbackStatus?.ok).toBe(true);
  expect(
    packedShadowCookiePointArray.readbackStatus?.maxClearDistance ?? 0,
  ).toBeGreaterThan(24);
  expect(packedShadowCookieAtlas.clusterStatus).toMatchObject({
    routePointShadowSamplingOk: true,
    routeSpotShadowSamplingOk: true,
    routeMultiSpotShadowSamplingOk: true,
    routeSpotShadowAtlasSamplingOk: true,
    routeMixedShadowSamplingOk: true,
    routeMixedPackedSpotShadowAtlasSamplingOk: true,
    routeCookieSamplingOk: true,
    routeCookieAtlasSamplingOk: true,
    routePackedShadowCookieShadowReady: true,
    routePackedShadowCookieCookieReady: true,
    routePackedShadowCookiePipelineOk: true,
    routePackedShadowCookieSamplingOk: true,
    routePackedShadowCookieAtlasShadowReady: true,
    routePackedShadowCookieAtlasCookieReady: true,
    routePackedShadowCookieAtlasShadowAligned: true,
    routePackedShadowCookieAtlasSamplingOk: true,
    requiredPointShadowSupportedCount: 1,
    requiredSpotShadowSupportedCount: 2,
    requiredCookieSupportedCount: 1,
  });
  expect(packedShadowCookieAtlas.shadowStatus).toMatchObject({
    enabled: true,
    supported: true,
    mode: "clustered-point-spot-atlas-depth-compare",
    point: {
      enabled: true,
      supported: true,
      mode: "clustered-point-depth-cube-compare",
      supportedLightCount: 1,
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
    (packedShadowCookieAtlas.pipelineKeys ?? []).some(
      (pipelineKey) =>
        pipelineKey.startsWith("standard|") &&
        pipelineKey.includes("clusteredLocalLights") &&
        pipelineKey.includes("clusteredLocalLightCookies") &&
        pipelineKey.includes("clusteredLocalLightShadowCookies") &&
        pipelineKey.includes("pointShadowMap") &&
        pipelineKey.includes("shadowMap") &&
        !pipelineKey.includes("clusteredLocalLightArrayShadows"),
    ),
  ).toBe(true);
  expect(
    (packedShadowCookieAtlas.localLightClusters?.routes ?? []).some(
      (route) =>
        (route.layerMask ?? 0) === 2 &&
        route.shadowCookieMetadata?.shadow.status === "sampling-ready" &&
        route.shadowCookieMetadata.shadow.samplingSupported === true &&
        route.shadowCookieMetadata.shadow.localRequestCount >= 6 &&
        route.shadowCookieMetadata.shadow.clusteredLightCount >= 6 &&
        route.shadowCookieMetadata.shadow.supportedLightCount >= 3 &&
        route.shadowCookieMetadata.cookie.status === "sampling-ready" &&
        route.shadowCookieMetadata.cookie.samplingSupported === true &&
        route.shadowCookieMetadata.cookie.localRequestCount >= 2 &&
        route.shadowCookieMetadata.cookie.clusteredLightCount >= 2 &&
        route.shadowCookieMetadata.cookie.supportedLightCount >= 2,
    ),
  ).toBe(true);
  expect(packedShadowCookieAtlas.readbackStatus?.ok).toBe(true);
  expect(
    packedShadowCookieAtlas.readbackStatus?.maxClearDistance ?? 0,
  ).toBeGreaterThan(24);
  expect(multiPointShadow.clusterStatus).toMatchObject({
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
  expect(cookie.readbackStatus?.ok).toBe(true);
  expect(maxSampleLuminanceDelta(baseline, cookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(baseline, pointCookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(baseline, atlasCookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(baseline, mixedCookie)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(spotOnly, mixedShadow)).toBeGreaterThan(2);
  expect(maxSampleLuminanceDelta(multiSpot, packedShadow)).toBeGreaterThan(1);
  expect(
    maxSampleLuminanceDelta(packedShadow, packedShadowCookie),
  ).toBeGreaterThan(1);
  expect(
    maxSampleLuminanceDelta(multiPointShadow, packedShadowCookiePointArray),
  ).toBeGreaterThan(1);
  expect(
    maxSampleLuminanceDelta(packedShadowAtlas, packedShadowCookieAtlas),
  ).toBeGreaterThan(1);
  expect(
    maxSampleLuminanceDelta(atlasCookie, packedShadowCookieAtlas),
  ).toBeGreaterThan(1);
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
  packedShadowCookiePointArrayWebGpuValidation.expectNoWarnings();
  packedShadowCookieAtlasWebGpuValidation.expectNoWarnings();
  multiPointShadowWebGpuValidation.expectNoWarnings();
  packedShadowAtlasWebGpuValidation.expectNoWarnings();
  shadowWebGpuValidation.expectNoWarnings();
});

test("clustered lights reports rolling cache pressure history", async ({
  page,
}) => {
  const webGpuValidation = attachWebGpuValidationConsoleGuard(page);

  await page.goto(
    "/examples/clustered-lights.html?enable-cluster-pressure-history=1",
  );
  await page.bringToFront();

  const status = await waitForExampleStatus<ClusteredLightsStatus>(page);

  await attachExampleStatus("clustered-lights-pressure-history-status", status);
  expect(
    status,
    "clustered lights pressure history status should publish",
  ).toBeDefined();

  if (status === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(status);
  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "clustered-lights",
    phase: "submit",
    clusterStatus: {
      ok: true,
      routeClusteredShadowCacheReady: true,
      routeClusteredBufferCacheReady: true,
      routePackedShadowCookieAtlasSamplingOk: true,
    },
    clusterPressureHistoryStatus: {
      enabled: true,
      ready: true,
      requiredFrames: 30,
      observedFrames: 30,
      rollingWindowSize: 30,
      baselineMode: "derived-no-cache",
      stablePixels: {
        ready: true,
      },
    },
  });
  expectClusteredLightsStatusHealthy(status);

  const history = status.clusterPressureHistoryStatus;

  expect(history).toBeDefined();
  if (history === undefined) {
    return;
  }

  expect(history.lastFrame ?? 0).toBeGreaterThanOrEqual(30);
  expect(history.samples).toHaveLength(30);
  expect(history.avoided.clusterBufferWrites).toBeGreaterThan(0);
  expect(history.avoided.cookieAtlasTileUpdates).toBeGreaterThan(0);
  expect(history.avoided.localShadowSubmissions).toBeGreaterThan(0);
  expect(history.cachedPath.clusterBufferWrites).toBeLessThan(
    history.noCacheBaseline.clusterBufferWrites,
  );
  expect(history.cachedPath.cookieAtlasTileUpdates).toBeLessThan(
    history.noCacheBaseline.cookieAtlasTileUpdates,
  );
  expect(history.cachedPath.localShadowSubmissions).toBeLessThan(
    history.noCacheBaseline.localShadowSubmissions,
  );
  expect(history.reduction.avoidedWork).toBeGreaterThan(0);
  expect(history.reduction.baselineWork).toBeGreaterThan(
    history.reduction.cachedWork,
  );
  expect(history.stablePixels.maxLuminanceDelta).toBeLessThanOrEqual(6);
  expect(status.readbackStatus?.ok).toBe(true);
  expect(status.readbackStatus?.maxClearDistance ?? 0).toBeGreaterThan(24);
  webGpuValidation.expectNoWarnings();
});

test("clustered lights persistent route harness reuses one page", async ({
  page,
}) => {
  const harness = createPersistentExampleRouteHarness(page);

  const defaultProof = await harness.run<ClusteredLightsStatus>({
    url: "/examples/clustered-lights.html?proof=persistent-harness-default",
    attachmentName: "clustered-lights-persistent-default-proof",
  });
  const defaultStatus = defaultProof.status;

  if (defaultStatus === undefined) {
    return;
  }

  expect(defaultProof.routeIndex).toBe(1);
  expect(defaultProof.finalUrl).toContain(
    "/examples/clustered-lights.html?proof=persistent-harness-default",
  );
  expect(defaultProof.elapsedMs).toBeGreaterThan(0);
  expect(defaultProof.frame ?? 0).toBeGreaterThan(0);
  expect(defaultProof.readbackStatus).toMatchObject({ ok: true });
  expect(defaultStatus).toMatchObject({
    example: "clustered-lights",
    phase: "submit",
    clusterStatus: {
      ok: true,
      routePackedShadowCookieAtlasSamplingOk: true,
    },
  });
  expectClusteredLightsStatusHealthy(defaultStatus);

  const pressureProof = await harness.run<ClusteredLightsStatus>({
    url: "/examples/clustered-lights.html?enable-cluster-pressure-history=1&proof=persistent-harness-pressure",
    attachmentName: "clustered-lights-persistent-pressure-proof",
  });
  const pressureStatus = pressureProof.status;

  if (pressureStatus === undefined) {
    return;
  }

  expect(pressureProof.routeIndex).toBe(2);
  expect(pressureProof.finalUrl).toContain(
    "/examples/clustered-lights.html?enable-cluster-pressure-history=1&proof=persistent-harness-pressure",
  );
  expect(pressureProof.elapsedMs).toBeGreaterThan(0);
  expect(pressureProof.frame ?? 0).toBeGreaterThanOrEqual(30);
  expect(pressureProof.readbackStatus).toMatchObject({ ok: true });
  expect(pressureStatus).toMatchObject({
    example: "clustered-lights",
    phase: "submit",
    clusterStatus: {
      ok: true,
      routeClusteredShadowCacheReady: true,
      routeClusteredBufferCacheReady: true,
      routePackedShadowCookieAtlasSamplingOk: true,
    },
    clusterPressureHistoryStatus: {
      enabled: true,
      ready: true,
      observedFrames: 30,
      stablePixels: {
        ready: true,
      },
    },
  });
  expectClusteredLightsStatusHealthy(pressureStatus);
  expect(
    pressureStatus.clusterPressureHistoryStatus?.avoided.clusterBufferWrites ??
      0,
  ).toBeGreaterThan(0);
  expect(
    pressureStatus.clusterPressureHistoryStatus?.avoided
      .cookieAtlasTileUpdates ?? 0,
  ).toBeGreaterThan(0);
  expect(
    pressureStatus.clusterPressureHistoryStatus?.avoided
      .localShadowSubmissions ?? 0,
  ).toBeGreaterThan(0);
  expect(harness.messages).toEqual([]);
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

function expectClusteredLightsStatusHealthy(
  status: ClusteredLightsStatus,
): void {
  if (status.ok === true && (status.counts?.diagnostics ?? 0) === 0) {
    return;
  }

  const diagnostics = status.diagnostics ?? [];
  expect(diagnostics.length).toBeGreaterThan(0);
  expect(diagnostics).toEqual(
    diagnostics.map((_diagnostic) =>
      expect.objectContaining({
        code: DEFERRED_CLUSTERED_SHADOW_WARNING,
        severity: "warning",
      }),
    ),
  );
  expect(status.counts?.diagnostics ?? diagnostics.length).toBe(
    diagnostics.length,
  );
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
