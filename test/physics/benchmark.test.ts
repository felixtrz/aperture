import { describe, expect, it } from "vitest";
import {
  createDefaultPhysicsBackendBenchmarkScenarios,
  runPhysicsBackendBenchmark,
  runPhysicsBackendBenchmarkScenarios,
} from "@aperture-engine/physics";
import { createTestPhysicsBackend } from "@aperture-engine/physics/testing";

describe("physics backend benchmark", () => {
  it("reports deterministic body/query behavior for the test backend", async () => {
    const first = await runPhysicsBackendBenchmark(createTestPhysicsBackend(), {
      dynamicBodyCount: 6,
      fixedSteps: 12,
      queryRepeats: 3,
    });
    const second = await runPhysicsBackendBenchmark(
      createTestPhysicsBackend(),
      {
        dynamicBodyCount: 6,
        fixedSteps: 12,
        queryRepeats: 3,
      },
    );

    expect(first.backend).toMatchObject({
      kind: "test",
      build: "test",
      execution: "simulation-worker",
      capabilities: {
        compoundColliders: true,
        continuousCollisionDetection: false,
        characterController: true,
        linkedBodyContacts: false,
        combinedPositionVelocityMotors: false,
        motorForceLimits: false,
        automaticBreakForce: false,
        jointImpulseReadback: false,
        pairedNonFixedFrameB: false,
      },
    });
    expect(first.input.contactPairCount).toBe(4);
    expect(first.support).toMatchObject({
      overlapShape: true,
      castShapeFirst: true,
      projectPoint: true,
      moveCharacter: true,
      debugGeometry: true,
    });
    expect(first.counts).toMatchObject({
      commandCount: 22,
      syncCount: 1,
      resyncCommandCount: 0,
      bodyCount: 21,
      colliderCount: 21,
      readbackBodyCount: 21,
      eventCount: 1,
      queryCount: 18,
      raycastFirstHitCount: 3,
      sensorRaycastHitCount: 9,
      groupedRaycastHitCount: 6,
      overlapHitCount: 3,
      shapeCastHitCount: 3,
      projectPointHitCount: 3,
      unsupportedFeatureCount: 0,
    });
    expect(first.events).toEqual({
      totalCount: 1,
      byKind: [{ kind: "triggerEnter", count: 1 }],
    });
    expect(first.signature.raycastFirstEntity).toBe("benchmark::solid-a");
    expect(first.signature.sensorRaycastFirstEntity).toBe("benchmark::solid-a");
    expect(first.signature.groupedRaycastEntities).toEqual([
      "benchmark::solid-a",
      "benchmark::sensor-a",
    ]);
    expect(first.signature.overlapEntities).toEqual(["benchmark::sensor-a"]);
    expect(first.signature.shapeCastEntity).toBe("benchmark::solid-a");
    expect(first.signature.projectPointEntity).toBe("benchmark::sensor-a");
    expect(first.signature.value).toBe(second.signature.value);

    for (const value of Object.values(first.timingsMs)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(first.memory.available).toBe(true);
    expect(first.memory.source).toBe("process.memoryUsage");
    expect(first.memory.usedBeforeBytes).toBeGreaterThanOrEqual(0);
    expect(first.memory.usedAfterBytes).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(first.memory.deltaBytes)).toBe(true);
    expect(first.memory.checkpointCount).toBeGreaterThanOrEqual(6);
    expect(
      first.memory.checkpoints.map((checkpoint) => checkpoint.label),
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
      first.memory.checkpoints.some((checkpoint) =>
        checkpoint.label.startsWith("afterStep:"),
      ),
    ).toBe(true);
    expect(first.memory.checkpoints[0]).toMatchObject({
      label: "beforeInit",
      stepIndex: null,
      deltaFromStartBytes: 0,
      deltaFromPreviousBytes: null,
    });
    expect(first.memory.peakUsedBytes).toBeGreaterThanOrEqual(
      first.memory.usedBeforeBytes ?? 0,
    );
    expect(first.memory.peakDeltaBytes).toBeGreaterThanOrEqual(0);
    expect(
      first.memory.checkpoints.every(
        (checkpoint) =>
          checkpoint.usedBytes === null ||
          Number.isFinite(checkpoint.deltaFromStartBytes),
      ),
    ).toBe(true);
  });

  it("runs a deterministic simulation-worker workload matrix", async () => {
    const scenarios = createDefaultPhysicsBackendBenchmarkScenarios({
      dynamicBodyCount: 6,
      contactPairCount: 3,
      fixedSteps: 12,
      queryRepeats: 4,
    });
    const suite = await runPhysicsBackendBenchmarkScenarios(
      () => createTestPhysicsBackend(),
      scenarios,
    );
    const byScenario = new Map(
      suite.scenarios.map((scenario) => [scenario.name, scenario.report]),
    );

    expect(suite.scenarioCount).toBe(9);
    expect(suite.scenarios.map((scenario) => scenario.name)).toEqual([
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
    expect(byScenario.get("balanced")?.backend.kind).toBe("test");
    expect(byScenario.get("body-heavy")?.input.dynamicBodyCount).toBe(64);
    expect(byScenario.get("body-heavy")?.counts.bodyCount).toBeGreaterThan(
      byScenario.get("balanced")?.counts.bodyCount ?? 0,
    );
    expect(byScenario.get("contact-heavy")?.input.contactPairCount).toBe(16);
    expect(byScenario.get("contact-heavy")?.counts.bodyCount).toBeGreaterThan(
      byScenario.get("balanced")?.counts.bodyCount ?? 0,
    );
    expect(byScenario.get("query-heavy")?.input.queryRepeats).toBe(40);
    expect(byScenario.get("query-heavy")?.counts.queryCount).toBeGreaterThan(
      byScenario.get("balanced")?.counts.queryCount ?? 0,
    );
    expect(byScenario.get("character-heavy")?.input.characterMoveRepeats).toBe(
      24,
    );
    expect(byScenario.get("character-heavy")?.counts.characterMoveCount).toBe(
      24,
    );
    expect(
      byScenario.get("character-heavy")?.counts.characterGroundedCount,
    ).toBeGreaterThan(0);
    expect(byScenario.get("debug-heavy")?.input.debugGeometryRepeats).toBe(12);
    expect(byScenario.get("debug-heavy")?.support.debugGeometry).toBe(true);
    expect(byScenario.get("debug-heavy")?.counts.debugGeometryCallCount).toBe(
      12,
    );
    expect(
      byScenario.get("debug-heavy")?.counts.debugLineCount,
    ).toBeGreaterThan(0);
    expect(byScenario.get("debug-heavy")?.counts.unsupportedFeatureCount).toBe(
      0,
    );
    expect(byScenario.get("joint-heavy")?.input.jointCount).toBe(16);
    expect(byScenario.get("joint-heavy")?.counts.jointCount).toBe(16);
    expect(byScenario.get("joint-heavy")?.counts.bodyCount).toBeGreaterThan(
      byScenario.get("balanced")?.counts.bodyCount ?? 0,
    );
    expect(byScenario.get("churn-heavy")?.input.resyncRepeats).toBe(12);
    expect(byScenario.get("churn-heavy")?.counts.syncCount).toBe(13);
    expect(byScenario.get("churn-heavy")?.counts.resyncCommandCount).toBe(23);
    expect(byScenario.get("churn-heavy")?.counts.commandCount).toBeGreaterThan(
      byScenario.get("balanced")?.counts.commandCount ?? 0,
    );
    expect(
      byScenario
        .get("churn-heavy")
        ?.memory.checkpoints.map((checkpoint) => checkpoint.label),
    ).toContain("afterResync");
    expect(byScenario.get("allocation-heavy")?.input.dynamicBodyCount).toBe(96);
    expect(byScenario.get("allocation-heavy")?.input.contactPairCount).toBe(24);
    expect(
      byScenario.get("allocation-heavy")?.counts.bodyCount,
    ).toBeGreaterThan(byScenario.get("body-heavy")?.counts.bodyCount ?? 0);
    for (const scenario of suite.scenarios) {
      expect(scenario.report.backend.execution).toBe("simulation-worker");
      expect(scenario.report.memory.checkpointCount).toBeGreaterThanOrEqual(6);
      expect(scenario.report.signature.value).toContain("benchmark::solid-a");
    }
  });
});
