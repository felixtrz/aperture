import { expect, test } from "@playwright/test";

import {
  expectedDiagnosticCounts,
  loadMultiEntityScenarioStatus,
} from "./webgpu-status.js";

test("ECS browser example routes directional-light-extraction to light submit status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "directional-light-extraction",
    "directional-light-extraction-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "directional-light-extraction",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 1, diagnostics: 0 },
    lightingResources: {
      lightBuffer: {
        count: 1,
        byteLength: 140,
      },
      environments: {
        environmentCount: 0,
        nullHandleCount: 0,
        resourceKeys: [],
      },
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    light: {
      authored: 1,
      extracted: 1,
      expectedKind: "directional",
      kinds: ["directional"],
      intensities: [1.75],
      layerMasks: [1],
      expectedDiagnostics: [],
      diagnostics: [],
    },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
});

test("ECS browser example routes ambient-light-extraction to transformless light status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "ambient-light-extraction",
    "ambient-light-extraction-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "ambient-light-extraction",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    light: {
      authored: 1,
      extracted: 1,
      expectedKind: "ambient",
      kinds: ["ambient"],
      intensities: [0.25],
      layerMasks: [1],
      expectedDiagnostics: [],
      diagnostics: [],
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
});

test("ECS browser example routes environment-light-extraction to transformless light status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "environment-light-extraction",
    "environment-light-extraction-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "environment-light-extraction",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 0,
      environments: 1,
      diagnostics: 0,
    },
    lightingResources: {
      lightBuffer: {
        count: 0,
        byteLength: 0,
      },
      environments: {
        environmentCount: 1,
        nullHandleCount: 1,
        resourceKeys: [],
      },
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    environment: {
      authored: 1,
      extracted: 1,
      expectedKind: "environment",
      intensities: [0.5],
      layerMasks: [1],
      handles: [null],
      expectedDiagnostics: [],
      diagnostics: [],
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
});

test("ECS browser example routes missing-environment-map to environment diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "missing-environment-map",
    "missing-environment-map-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = ["render.environment.missing"];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "missing-environment-map",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 0,
      environments: 0,
      diagnostics: 1,
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    environment: {
      authored: 1,
      extracted: 0,
      expectedKind: "environment",
      intensities: [],
      layerMasks: [],
      handles: [],
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
      diagnosticAssetKeys: ["environment-map:missing-studio"],
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(status.diagnostics).toMatchObject([
    {
      code: "render.environment.missing",
      assetKey: "environment-map:missing-studio",
    },
  ]);
});

test("ECS browser example routes loading-environment-map to environment diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "loading-environment-map",
    "loading-environment-map-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = ["render.environment.loading"];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "loading-environment-map",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 0,
      environments: 0,
      diagnostics: 1,
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    environment: {
      authored: 1,
      extracted: 0,
      expectedKind: "environment",
      handles: [],
      expectedHandleKey: "environment-map:loading-studio",
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
      diagnosticAssetKeys: ["environment-map:loading-studio"],
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(status.diagnostics).toMatchObject([
    {
      code: "render.environment.loading",
      assetKey: "environment-map:loading-studio",
    },
  ]);
});

test("ECS browser example routes failed-environment-map to environment diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "failed-environment-map",
    "failed-environment-map-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = ["render.environment.failed"];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "failed-environment-map",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 0,
      environments: 0,
      diagnostics: 1,
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    environment: {
      authored: 1,
      extracted: 0,
      expectedKind: "environment",
      handles: [],
      expectedHandleKey: "environment-map:failed-studio",
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
      diagnosticAssetKeys: ["environment-map:failed-studio"],
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(status.diagnostics).toMatchObject([
    {
      code: "render.environment.failed",
      assetKey: "environment-map:failed-studio",
    },
  ]);
});

test("ECS browser example routes malformed-environment-map to environment diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "malformed-environment-map",
    "malformed-environment-map-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = ["render.environment.invalidHandle"];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "malformed-environment-map",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 0,
      environments: 0,
      diagnostics: 1,
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    environment: {
      authored: 1,
      extracted: 0,
      expectedKind: "environment",
      handles: [],
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(status.diagnostics).toMatchObject([
    { code: "render.environment.invalidHandle" },
  ]);
  expect(status.diagnostics?.[0]).not.toHaveProperty("assetKey");
});

test("ECS browser example routes environment-map-handle to extracted handle status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "environment-map-handle",
    "environment-map-handle-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "environment-map-handle",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 0,
      environments: 1,
      diagnostics: 0,
    },
    lightingResources: {
      lightBuffer: {
        count: 0,
        byteLength: 0,
      },
      environments: {
        environmentCount: 1,
        nullHandleCount: 0,
        resourceKeys: ["environment-map:studio-ready"],
      },
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    environment: {
      authored: 1,
      extracted: 1,
      expectedKind: "environment",
      intensities: [0.5],
      layerMasks: [1],
      handles: [{ kind: "environment-map", id: "studio-ready" }],
      handleKeys: ["environment-map:studio-ready"],
      expectedHandleKey: "environment-map:studio-ready",
      expectedDiagnostics: [],
      diagnostics: [],
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
});

test("ECS browser example routes point-light-extraction to point light status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "point-light-extraction",
    "point-light-extraction-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "point-light-extraction",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    light: {
      authored: 1,
      extracted: 1,
      expectedKind: "point",
      kinds: ["point"],
      intensities: [2],
      ranges: [5],
      layerMasks: [1],
      expectedDiagnostics: [],
      diagnostics: [],
    },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
});

test("ECS browser example routes spot-light-extraction to spot light status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "spot-light-extraction",
    "spot-light-extraction-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "spot-light-extraction",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 1, diagnostics: 0 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    light: {
      authored: 1,
      extracted: 1,
      expectedKind: "spot",
      kinds: ["spot"],
      intensities: [2.5],
      ranges: [4],
      innerConeAngles: [0.25],
      outerConeAngles: [0.5],
      layerMasks: [1],
      expectedDiagnostics: [],
      diagnostics: [],
    },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
});

test("ECS browser example routes missing-light-transform to light diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "missing-light-transform",
    "missing-light-transform-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = ["render.lightMissingTransform"];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "missing-light-transform",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 0, diagnostics: 1 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    light: {
      authored: 1,
      extracted: 0,
      expectedKind: "directional",
      kinds: [],
      intensities: [],
      layerMasks: [],
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
      transformless: true,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(status.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual(
    expectedDiagnostics,
  );
});

test("ECS browser example routes invalid-light-extraction to light diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "invalid-light-extraction",
    "invalid-light-extraction-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = [
    "render.light.invalidIntensity",
    "render.light.invalidRange",
    "render.light.invalidSpotCone",
    "render.light.zeroLayerMask",
  ];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "invalid-light-extraction",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: { views: 1, meshDraws: 1, lights: 0, diagnostics: 4 },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    light: {
      authored: 1,
      extracted: 0,
      expectedKind: "spot",
      kinds: [],
      intensities: [],
      layerMasks: [],
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 4 }),
  });
  expect(status.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual(
    expectedDiagnostics,
  );
});

test("ECS browser example routes directional-shadow-request to shadow request status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "directional-shadow-request",
    "directional-shadow-request-route",
  );

  if (status === undefined) {
    return;
  }

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "directional-shadow-request",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      diagnostics: 0,
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    shadow: {
      expectedRequests: 1,
      requests: 1,
      shadowIds: [expect.any(Number)],
      lightIds: [expect.any(Number)],
      casterLayerMasks: [1],
      receiverLayerMasks: [1],
      expectedCasterLayerMasks: [1],
      expectedReceiverLayerMasks: [1],
      expectedDiagnostics: [],
      diagnostics: [],
    },
    diagnosticCounts: expectedDiagnosticCounts({}),
  });
  expect(status.shadow?.shadowIds).toEqual(status.shadow?.lightIds);
});

test("ECS browser example routes invalid-shadow-settings to shadow diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "invalid-shadow-settings",
    "invalid-shadow-settings-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = [
    "render.shadow.invalidMapSize",
    "render.shadow.invalidBias",
    "render.shadow.zeroLayerMask",
  ];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "invalid-shadow-settings",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 1,
      environments: 0,
      shadowRequests: 0,
      diagnostics: 3,
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    shadow: {
      expectedRequests: 0,
      requests: 0,
      shadowIds: [],
      lightIds: [],
      casterLayerMasks: [],
      receiverLayerMasks: [],
      expectedCasterLayerMasks: [],
      expectedReceiverLayerMasks: [],
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 3 }),
  });
  expect(status.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual(
    expectedDiagnostics,
  );
});

test("ECS browser example routes unsupported-shadow-request to shadow diagnostic status", async ({
  page,
}) => {
  const status = await loadMultiEntityScenarioStatus(
    page,
    "unsupported-shadow-request",
    "unsupported-shadow-request-route",
  );

  if (status === undefined) {
    return;
  }

  const expectedDiagnostics = ["render.shadowUnsupportedLightKind.ambient"];

  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "ecs-multi-entity",
    scenario: "unsupported-shadow-request",
    ok: true,
    phase: "submit",
    renderingBackend: "webgpu-explicit",
    extraction: {
      views: 1,
      meshDraws: 1,
      lights: 1,
      environments: 0,
      shadowRequests: 0,
      diagnostics: 1,
    },
    renderWorld: { active: 1, ready: 1, blocked: 0 },
    shadow: {
      expectedRequests: 0,
      requests: 0,
      expectedDiagnostics,
      diagnostics: expectedDiagnostics,
    },
    diagnosticCounts: expectedDiagnosticCounts({ extraction: 1 }),
  });
  expect(status.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual(
    expectedDiagnostics,
  );
});
