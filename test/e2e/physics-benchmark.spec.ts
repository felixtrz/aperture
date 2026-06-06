import { expect, test, type Page } from "@playwright/test";

import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
} from "./webgpu-status.js";
import type { ExampleStatusBase } from "./example-status-types.js";

type PhysicsBenchmarkGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_STATUS__?: PhysicsBenchmarkStatus;
};

interface PhysicsBenchmarkStatus extends ExampleStatusBase {
  readonly phase: string;
  readonly defaultBackend?: string;
  readonly route?: {
    readonly preferred: string;
    readonly dedicatedPhysicsWorker: string;
  };
  readonly benchmark?: {
    readonly scenarioCount: number;
    readonly reportCount: number;
    readonly scenarios: readonly {
      readonly name: string;
      readonly description: string;
    }[];
    readonly reports: readonly PhysicsBenchmarkScenarioReport[];
    readonly summary: readonly {
      readonly scenario: string;
      readonly backend: string;
      readonly execution: string;
      readonly contactPairs: number;
      readonly joints: number;
      readonly characterMoves: number;
      readonly debugGeometryRepeats: number;
      readonly resyncs: number;
      readonly unsupportedFeatures: number;
      readonly bodies: number;
      readonly queries: number;
      readonly debugCalls: number;
      readonly debugLines: number;
      readonly events: number;
      readonly totalMs: number;
      readonly memorySource: string;
      readonly memoryAvailable: boolean;
      readonly memoryDeltaBytes: number | null;
      readonly memoryPeakDeltaBytes: number | null;
      readonly memoryCheckpointCount: number;
      readonly capabilities: string;
      readonly signature: string;
    }[];
  };
}

interface PhysicsBenchmarkScenarioReport {
  readonly name: string;
  readonly description: string;
  readonly report: PhysicsBenchmarkReport;
}

interface PhysicsBenchmarkReport {
  readonly backend: {
    readonly kind: string;
    readonly build: string;
    readonly execution: string;
    readonly capabilities: {
      readonly compoundColliders: boolean;
      readonly characterController: boolean;
      readonly linkedBodyContacts: boolean;
      readonly combinedPositionVelocityMotors: boolean;
      readonly motorForceLimits: boolean;
      readonly automaticBreakForce: boolean;
      readonly jointImpulseReadback: boolean;
      readonly pairedNonFixedFrameB: boolean;
    };
  };
  readonly input: {
    readonly dynamicBodyCount: number;
    readonly contactPairCount: number;
    readonly jointCount: number;
    readonly characterMoveRepeats: number;
    readonly debugGeometryRepeats: number;
    readonly resyncRepeats: number;
    readonly queryRepeats: number;
  };
  readonly counts: {
    readonly commandCount: number;
    readonly syncCount: number;
    readonly resyncCommandCount: number;
    readonly bodyCount: number;
    readonly jointCount: number;
    readonly characterMoveCount: number;
    readonly characterCollisionCount: number;
    readonly characterGroundedCount: number;
    readonly debugGeometryCallCount: number;
    readonly debugLineCount: number;
    readonly eventCount: number;
    readonly queryCount: number;
    readonly raycastFirstHitCount: number;
    readonly overlapHitCount: number;
    readonly shapeCastHitCount: number;
    readonly projectPointHitCount: number;
    readonly unsupportedFeatureCount: number;
  };
  readonly support: {
    readonly overlapShape: boolean;
    readonly castShapeFirst: boolean;
    readonly projectPoint: boolean;
    readonly moveCharacter: boolean;
    readonly debugGeometry: boolean;
  };
  readonly events: {
    readonly totalCount: number;
    readonly byKind: readonly {
      readonly kind: string;
      readonly count: number;
    }[];
  };
  readonly timingsMs: {
    readonly totalMs: number;
    readonly stepMs: number;
    readonly queryMs: number;
  };
  readonly memory: {
    readonly available: boolean;
    readonly source: string;
    readonly usedBeforeBytes: number | null;
    readonly usedAfterBytes: number | null;
    readonly deltaBytes: number | null;
    readonly checkpointCount: number;
    readonly peakUsedBytes: number | null;
    readonly peakDeltaBytes: number | null;
    readonly checkpoints: readonly {
      readonly label: string;
      readonly stepIndex: number | null;
      readonly source: string;
      readonly usedBytes: number | null;
      readonly deltaFromStartBytes: number | null;
      readonly deltaFromPreviousBytes: number | null;
    }[];
  };
  readonly signature: {
    readonly raycastFirstEntity: string | null;
    readonly value: string;
  };
  readonly unsupportedFeatures: readonly {
    readonly code: string;
    readonly feature: string;
    readonly backend: string;
    readonly entity: string;
    readonly value?: number;
  }[];
}

test("browser publishes simulation-worker physics backend benchmark status", async ({
  page,
}) => {
  test.setTimeout(60000);

  await page.goto("/examples/physics-benchmark.html", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const status = await waitForPhysicsBenchmarkStatus(page);

  await attachExampleStatus("physics-benchmark-status", status);
  expect(status, "physics benchmark status should publish").toBeDefined();

  if (status === undefined) {
    return;
  }

  expectStatusJsonSafeForGpu(status);
  expect(status, JSON.stringify(status, null, 2)).toMatchObject({
    example: "physics-benchmark",
    ok: true,
    phase: "benchmark",
    defaultBackend: "rapier",
    route: {
      preferred: "simulation-worker",
      dedicatedPhysicsWorker: "rapier-transferable",
    },
    benchmark: {
      scenarioCount: 9,
      reportCount: 18,
    },
  });

  const scenarioReports = status.benchmark?.reports ?? [];
  const reports = scenarioReports.map((scenario) => scenario.report);
  const byScenario = new Map(
    scenarioReports.map((scenario) => [
      `${scenario.name}:${scenario.report.backend.kind}`,
      scenario.report,
    ]),
  );
  const balancedRapier = byScenario.get("balanced:rapier");

  expect(status.benchmark?.scenarios.map((scenario) => scenario.name)).toEqual([
    "balanced",
    "body-heavy",
    "contact-heavy",
    "query-heavy",
    "character-heavy",
    "debug-heavy",
    "joint-heavy",
    "churn-heavy",
    "allocation-heavy",
  ]);
  expect(
    scenarioReports.map(
      (scenario) => `${scenario.name}:${scenario.report.backend.kind}`,
    ),
  ).toEqual(
    expect.arrayContaining([
      "balanced:test",
      "balanced:rapier",
      "body-heavy:test",
      "body-heavy:rapier",
      "contact-heavy:test",
      "contact-heavy:rapier",
      "query-heavy:test",
      "query-heavy:rapier",
      "character-heavy:test",
      "character-heavy:rapier",
      "debug-heavy:test",
      "debug-heavy:rapier",
      "joint-heavy:test",
      "joint-heavy:rapier",
      "churn-heavy:test",
      "churn-heavy:rapier",
      "allocation-heavy:test",
      "allocation-heavy:rapier",
    ]),
  );
  expect(byScenario.get("balanced:test")?.backend.execution).toBe(
    "simulation-worker",
  );
  expect(balancedRapier?.backend.execution).toBe("simulation-worker");
  expect(balancedRapier?.backend.capabilities).toMatchObject({
    compoundColliders: true,
    continuousCollisionDetection: true,
    characterController: true,
    linkedBodyContacts: true,
    combinedPositionVelocityMotors: true,
    motorForceLimits: false,
    automaticBreakForce: false,
    jointImpulseReadback: false,
    pairedNonFixedFrameB: false,
  });
  expect(balancedRapier?.counts.bodyCount).toBeGreaterThanOrEqual(16);
  expect(balancedRapier?.counts.eventCount).toBeGreaterThan(0);
  expect(balancedRapier?.events.totalCount).toBe(
    balancedRapier?.counts.eventCount,
  );
  expect(balancedRapier?.events.byKind.map((event) => event.kind)).toEqual(
    expect.arrayContaining(["collisionStart", "contactForce", "triggerEnter"]),
  );
  expect(balancedRapier?.counts.queryCount).toBeGreaterThan(0);
  expect(balancedRapier?.counts.raycastFirstHitCount).toBeGreaterThan(0);
  expect(balancedRapier?.counts.unsupportedFeatureCount).toBe(0);
  expect(balancedRapier?.timingsMs.totalMs).toBeGreaterThanOrEqual(0);
  expect(balancedRapier?.memory.source).toMatch(
    /^(performance\.memory|unavailable)$/u,
  );
  expect(typeof balancedRapier?.memory.available).toBe("boolean");
  if (balancedRapier?.memory.available === true) {
    expect(balancedRapier.memory.usedBeforeBytes).toBeGreaterThanOrEqual(0);
    expect(balancedRapier.memory.usedAfterBytes).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(balancedRapier.memory.deltaBytes)).toBe(true);
    expect(balancedRapier.memory.checkpointCount).toBeGreaterThanOrEqual(6);
    expect(balancedRapier.memory.peakUsedBytes).toBeGreaterThanOrEqual(
      balancedRapier.memory.usedBeforeBytes ?? 0,
    );
    expect(balancedRapier.memory.peakDeltaBytes).toBeGreaterThanOrEqual(0);
  }
  expect(
    balancedRapier?.memory.checkpoints.map((checkpoint) => checkpoint.label),
  ).toEqual(
    expect.arrayContaining([
      "beforeInit",
      "afterInit",
      "afterSync",
      "afterReadback",
      "afterQueries",
    ]),
  );
  expect(
    balancedRapier?.memory.checkpoints.some((checkpoint) =>
      checkpoint.label.startsWith("afterStep:"),
    ),
  ).toBe(true);
  expect(balancedRapier?.signature.raycastFirstEntity).toBe(
    "benchmark::solid-a",
  );
  expect(byScenario.get("body-heavy:rapier")?.input.dynamicBodyCount).toBe(64);
  expect(byScenario.get("contact-heavy:rapier")?.input.contactPairCount).toBe(
    16,
  );
  expect(byScenario.get("query-heavy:rapier")?.input.queryRepeats).toBe(40);
  expect(
    byScenario.get("query-heavy:rapier")?.counts.queryCount,
  ).toBeGreaterThan(balancedRapier?.counts.queryCount ?? 0);
  expect(
    byScenario.get("character-heavy:rapier")?.input.characterMoveRepeats,
  ).toBe(24);
  expect(
    byScenario.get("character-heavy:rapier")?.counts.characterMoveCount,
  ).toBe(24);
  expect(
    byScenario.get("character-heavy:rapier")?.counts.characterGroundedCount,
  ).toBeGreaterThan(0);
  expect(byScenario.get("debug-heavy:rapier")?.input.debugGeometryRepeats).toBe(
    12,
  );
  expect(byScenario.get("debug-heavy:rapier")?.support.debugGeometry).toBe(
    true,
  );
  expect(
    byScenario.get("debug-heavy:rapier")?.counts.debugGeometryCallCount,
  ).toBe(12);
  expect(
    byScenario.get("debug-heavy:rapier")?.counts.debugLineCount,
  ).toBeGreaterThan(0);
  expect(
    byScenario.get("debug-heavy:rapier")?.counts.unsupportedFeatureCount,
  ).toBe(0);
  expect(byScenario.get("joint-heavy:rapier")?.input.jointCount).toBe(16);
  expect(byScenario.get("joint-heavy:rapier")?.counts.jointCount).toBe(16);
  expect(
    byScenario.get("joint-heavy:rapier")?.counts.bodyCount,
  ).toBeGreaterThan(balancedRapier?.counts.bodyCount ?? 0);
  expect(byScenario.get("churn-heavy:rapier")?.input.resyncRepeats).toBe(12);
  expect(byScenario.get("churn-heavy:rapier")?.counts.syncCount).toBe(13);
  expect(byScenario.get("churn-heavy:rapier")?.counts.resyncCommandCount).toBe(
    23,
  );
  expect(
    byScenario.get("churn-heavy:rapier")?.counts.commandCount,
  ).toBeGreaterThan(balancedRapier?.counts.commandCount ?? 0);
  expect(
    byScenario
      .get("churn-heavy:rapier")
      ?.memory.checkpoints.map((checkpoint) => checkpoint.label),
  ).toContain("afterResync");
  expect(
    byScenario.get("allocation-heavy:rapier")?.input.dynamicBodyCount,
  ).toBe(96);
  expect(
    byScenario.get("allocation-heavy:rapier")?.input.contactPairCount,
  ).toBe(24);
  expect(
    byScenario.get("allocation-heavy:rapier")?.counts.bodyCount,
  ).toBeGreaterThan(byScenario.get("body-heavy:rapier")?.counts.bodyCount ?? 0);
  expect(status.benchmark?.summary.map((item) => item.backend).sort()).toEqual([
    "rapier",
    "rapier",
    "rapier",
    "rapier",
    "rapier",
    "rapier",
    "rapier",
    "rapier",
    "rapier",
    "test",
    "test",
    "test",
    "test",
    "test",
    "test",
    "test",
    "test",
    "test",
  ]);
  expect(status.benchmark?.summary.map((item) => item.scenario).sort()).toEqual(
    [
      "allocation-heavy",
      "allocation-heavy",
      "balanced",
      "balanced",
      "body-heavy",
      "body-heavy",
      "character-heavy",
      "character-heavy",
      "churn-heavy",
      "churn-heavy",
      "contact-heavy",
      "contact-heavy",
      "debug-heavy",
      "debug-heavy",
      "joint-heavy",
      "joint-heavy",
      "query-heavy",
      "query-heavy",
    ],
  );
  expect(
    status.benchmark?.summary.every(
      (item) =>
        typeof item.memorySource === "string" &&
        typeof item.memoryAvailable === "boolean" &&
        item.memoryCheckpointCount >= 6 &&
        item.capabilities.length > 0 &&
        item.contactPairs >= 4 &&
        item.joints >= 0 &&
        item.characterMoves >= 0 &&
        item.debugGeometryRepeats >= 0 &&
        item.debugCalls >= 0 &&
        item.debugLines >= 0 &&
        item.resyncs >= 0 &&
        item.unsupportedFeatures >= 0 &&
        item.events > 0,
    ),
  ).toBe(true);
  expect(
    status.benchmark?.summary.find(
      (item) => item.scenario === "debug-heavy" && item.backend === "rapier",
    )?.debugCalls,
  ).toBe(12);
  expect(
    status.benchmark?.summary.find(
      (item) => item.scenario === "balanced" && item.backend === "rapier",
    )?.capabilities,
  ).toContain("combined-motors");
  await expect(page.locator("#benchmark-summary")).toContainText(
    "combined-motors",
  );
  expect(
    reports.every((report) => report.backend.execution === "simulation-worker"),
  ).toBe(true);
  await page.close();
});

async function waitForPhysicsBenchmarkStatus(
  page: Page,
): Promise<PhysicsBenchmarkStatus | undefined> {
  await page.waitForFunction(
    () => {
      const status = (globalThis as PhysicsBenchmarkGlobal)
        .__APERTURE_EXAMPLE_STATUS__;

      return status?.phase === "benchmark" || status?.phase === "failed";
    },
    { timeout: 60000 },
  );

  return page.evaluate(
    () =>
      (globalThis as PhysicsBenchmarkGlobal).__APERTURE_EXAMPLE_STATUS__ as
        | PhysicsBenchmarkStatus
        | undefined,
  );
}
