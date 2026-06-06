import { describe, expect, it } from "vitest";
import {
  createDefaultPhysicsBackendBenchmarkScenarios,
  runPhysicsBackendBenchmark,
  runPhysicsBackendBenchmarkScenarios,
} from "@aperture-engine/physics";
import { createRapierPhysicsBackend } from "@aperture-engine/physics-rapier";

describe("rapier physics backend benchmark", () => {
  it("runs the backend-neutral body/query benchmark against Rapier", async () => {
    const report = await runPhysicsBackendBenchmark(
      createRapierPhysicsBackend({ gravity: [0, -1, 0] }),
      {
        dynamicBodyCount: 4,
        fixedSteps: 8,
        queryRepeats: 2,
      },
    );

    expect(report.backend).toMatchObject({
      kind: "rapier",
      build: "performance",
      execution: "simulation-worker",
      capabilities: {
        compoundColliders: true,
        continuousCollisionDetection: true,
        characterController: true,
        linkedBodyContacts: true,
        combinedPositionVelocityMotors: true,
        motorForceLimits: false,
        automaticBreakForce: false,
        jointImpulseReadback: false,
        pairedNonFixedFrameB: false,
      },
    });
    expect(report.input.contactPairCount).toBe(4);
    expect(report.support).toMatchObject({
      overlapShape: true,
      castShapeFirst: true,
      projectPoint: true,
      moveCharacter: true,
      debugGeometry: true,
    });
    expect(report.counts.commandCount).toBe(20);
    expect(report.counts.syncCount).toBe(1);
    expect(report.counts.resyncCommandCount).toBe(0);
    expect(report.counts.bodyCount).toBe(19);
    expect(report.counts.readbackBodyCount).toBe(19);
    expect(report.counts.eventCount).toBeGreaterThan(0);
    expect(report.counts.queryCount).toBe(12);
    expect(report.counts.raycastFirstHitCount).toBe(2);
    expect(report.counts.sensorRaycastHitCount).toBeGreaterThanOrEqual(4);
    expect(report.counts.groupedRaycastHitCount).toBeGreaterThanOrEqual(4);
    expect(report.counts.overlapHitCount).toBeGreaterThanOrEqual(2);
    expect(report.counts.shapeCastHitCount).toBe(2);
    expect(report.counts.projectPointHitCount).toBe(2);
    expect(report.signature.raycastFirstEntity).toBe("benchmark::solid-a");
    expect(report.signature.projectPointEntity).toBe("benchmark::sensor-a");
    expect(report.signature.value).toContain("benchmark::solid-a");
    expect(report.events.totalCount).toBe(report.counts.eventCount);
    expect(report.events.byKind.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining([
        "collisionStart",
        "contactForce",
        "triggerEnter",
      ]),
    );

    for (const value of Object.values(report.timingsMs)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(report.memory.available).toBe(true);
    expect(report.memory.source).toBe("process.memoryUsage");
    expect(report.memory.usedBeforeBytes).toBeGreaterThanOrEqual(0);
    expect(report.memory.usedAfterBytes).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(report.memory.deltaBytes)).toBe(true);
    expect(report.memory.checkpointCount).toBeGreaterThanOrEqual(6);
    expect(report.memory.checkpoints.map((checkpoint) => checkpoint.label)).toEqual(
      expect.arrayContaining([
        "beforeInit",
        "afterInit",
        "afterSync",
        "afterReadback",
        "afterQueries",
      ]),
    );
    expect(
      report.memory.checkpoints.some((checkpoint) =>
        checkpoint.label.startsWith("afterStep:"),
      ),
    ).toBe(true);
    expect(report.memory.checkpoints[0]).toMatchObject({
      label: "beforeInit",
      stepIndex: null,
      deltaFromStartBytes: 0,
      deltaFromPreviousBytes: null,
    });
    expect(report.memory.peakUsedBytes).toBeGreaterThanOrEqual(
      report.memory.usedBeforeBytes ?? 0,
    );
    expect(report.memory.peakDeltaBytes).toBeGreaterThanOrEqual(0);
  });

  it("runs the simulation-worker workload matrix against Rapier", async () => {
    const scenarios = createDefaultPhysicsBackendBenchmarkScenarios({
      dynamicBodyCount: 4,
      contactPairCount: 3,
      fixedSteps: 8,
      queryRepeats: 3,
      gravity: [0, -1, 0],
    });
    const suite = await runPhysicsBackendBenchmarkScenarios(
      () => createRapierPhysicsBackend({ gravity: [0, -1, 0] }),
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
    expect(byScenario.get("balanced")?.backend.kind).toBe("rapier");
    expect(byScenario.get("body-heavy")?.input.dynamicBodyCount).toBe(64);
    expect(byScenario.get("contact-heavy")?.input.contactPairCount).toBe(16);
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
    expect(
      byScenario.get("debug-heavy")?.counts.unsupportedFeatureCount,
    ).toBe(0);
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
    expect(byScenario.get("allocation-heavy")?.counts.bodyCount).toBeGreaterThan(
      byScenario.get("body-heavy")?.counts.bodyCount ?? 0,
    );
    expect(
      byScenario.get("contact-heavy")?.events.byKind.map((entry) => entry.kind),
    ).toEqual(expect.arrayContaining(["contactForce"]));
    for (const scenario of suite.scenarios) {
      expect(scenario.report.backend.execution).toBe("simulation-worker");
      expect(scenario.report.counts.eventCount).toBeGreaterThan(0);
      expect(scenario.report.memory.checkpointCount).toBeGreaterThanOrEqual(6);
    }
  });
});
