import {
  createDefaultPhysicsBackendBenchmarkScenarios,
  runPhysicsBackendBenchmarkScenarios,
} from "/aperture/worker-modules/packages/physics/dist/index.js";
import { createTestPhysicsBackend } from "/aperture/worker-modules/packages/physics/dist/testing.js";
import { createRapierPhysicsBackend } from "/aperture/worker-modules/packages/physics-rapier/dist/index.js";

const baseStatus = {
  example: "physics-benchmark",
};
const benchmarkOptions = Object.freeze({
  dynamicBodyCount: 16,
  fixedSteps: 60,
  queryRepeats: 12,
  gravity: [0, -1, 0],
  execution: "simulation-worker",
});
const benchmarkScenarios =
  createDefaultPhysicsBackendBenchmarkScenarios(benchmarkOptions);

publishStatus({
  ...baseStatus,
  ok: false,
  phase: "loading",
});

try {
  const suites = await Promise.all([
    runPhysicsBackendBenchmarkScenarios(
      () => createTestPhysicsBackend(),
      benchmarkScenarios,
    ),
    runPhysicsBackendBenchmarkScenarios(
      () => createRapierPhysicsBackend({ gravity: benchmarkOptions.gravity }),
      benchmarkScenarios,
    ),
  ]);
  const status = createBenchmarkStatus(
    suites.flatMap((suite) => suite.scenarios),
  );

  renderBenchmarkSummary(status);
  publishStatus(status);
} catch (error) {
  publishStatus(
    failure(
      "physics-benchmark-failed",
      error instanceof Error
        ? error.message
        : "Physics backend benchmark failed.",
    ),
  );
}

function createBenchmarkStatus(scenarioReports) {
  const balancedReports = scenarioReports
    .filter((scenario) => scenario.name === "balanced")
    .map((scenario) => scenario.report);
  const balancedReportByKind = Object.fromEntries(
    balancedReports.map((report) => [report.backend.kind, report]),
  );
  const rapier = balancedReportByKind.rapier ?? null;
  const deterministic = balancedReportByKind.test ?? null;

  return {
    ...baseStatus,
    ok:
      deterministic !== null &&
      rapier !== null &&
      scenarioReports.every(
        (scenario) =>
          scenario.report.backend.execution === "simulation-worker" &&
          scenario.report.counts.bodyCount >=
            scenario.report.input.dynamicBodyCount &&
          scenario.report.counts.queryCount > 0 &&
          scenario.report.counts.raycastFirstHitCount > 0 &&
          scenario.report.counts.unsupportedFeatureCount === 0,
      ),
    phase: "benchmark",
    route: {
      preferred: "simulation-worker",
      dedicatedPhysicsWorker: "rapier-transferable",
    },
    defaultBackend: "rapier",
    benchmark: {
      options: benchmarkOptions,
      scenarioCount: benchmarkScenarios.length,
      reportCount: scenarioReports.length,
      scenarios: benchmarkScenarios,
      reports: scenarioReports,
      summary: scenarioReports.map((scenario) =>
        createBenchmarkSummaryRow(scenario.name, scenario.report),
      ),
    },
    adapterCandidates: [],
  };
}

function createBenchmarkSummaryRow(scenario, report) {
  return {
    scenario,
    backend: report.backend.kind,
    build: report.backend.build,
    execution: report.backend.execution,
    contactPairs: report.input.contactPairCount,
    joints: report.input.jointCount,
    characterMoves: report.input.characterMoveRepeats,
    debugGeometryRepeats: report.input.debugGeometryRepeats,
    resyncs: report.input.resyncRepeats,
    unsupportedFeatures: report.counts.unsupportedFeatureCount,
    bodies: report.counts.bodyCount,
    queries: report.counts.queryCount,
    debugCalls: report.counts.debugGeometryCallCount,
    debugLines: report.counts.debugLineCount,
    events: report.events.totalCount,
    totalMs: report.timingsMs.totalMs,
    stepMs: report.timingsMs.stepMs,
    queryMs: report.timingsMs.queryMs,
    memorySource: report.memory.source,
    memoryAvailable: report.memory.available,
    memoryDeltaBytes: report.memory.deltaBytes,
    memoryPeakDeltaBytes: report.memory.peakDeltaBytes,
    memoryCheckpointCount: report.memory.checkpointCount,
    capabilities: capabilityLabel(report.backend.capabilities),
    signature: report.signature.value,
  };
}

function renderBenchmarkSummary(status) {
  const summaryElement = document.querySelector("#benchmark-summary");

  if (summaryElement === null) {
    return;
  }

  summaryElement.replaceChildren(
    ...status.benchmark.summary.map((report) => {
      const article = document.createElement("article");
      const title = document.createElement("strong");
      const body = document.createElement("dl");

      article.className = "benchmark-card";
      title.textContent = `${report.scenario}: ${report.backend} ${report.build}`;
      body.append(
        metric("execution", report.execution),
        metric("contact pairs", report.contactPairs),
        metric("joints", report.joints),
        metric("character moves", report.characterMoves),
        metric("debug repeats", report.debugGeometryRepeats),
        metric("debug calls", report.debugCalls),
        metric("debug lines", report.debugLines),
        metric("resyncs", report.resyncs),
        metric("unsupported", report.unsupportedFeatures),
        metric("bodies", report.bodies),
        metric("queries", report.queries),
        metric("events", report.events),
        metric("step ms", report.stepMs),
        metric("query ms", report.queryMs),
        metric("total ms", report.totalMs),
        metric("memory", memoryLabel(report)),
        metric("memory checkpoints", report.memoryCheckpointCount),
        metric("capabilities", report.capabilities),
      );
      article.append(title, body);

      return article;
    }),
  );
}

function memoryLabel(report) {
  if (report.memoryAvailable !== true || report.memoryDeltaBytes === null) {
    return report.memorySource;
  }

  const peak =
    report.memoryPeakDeltaBytes === null
      ? "unknown peak"
      : `${report.memoryPeakDeltaBytes} B peak`;

  return `${report.memoryDeltaBytes} B final / ${peak}`;
}

function capabilityLabel(capabilities) {
  const enabled = [];

  if (capabilities.compoundColliders === true) {
    enabled.push("compound");
  }
  if (capabilities.characterController === true) {
    enabled.push("character");
  }
  if (capabilities.linkedBodyContacts === true) {
    enabled.push("linked-contacts");
  }
  if (capabilities.combinedPositionVelocityMotors === true) {
    enabled.push("combined-motors");
  }
  if (capabilities.motorForceLimits === true) {
    enabled.push("motor-force");
  }
  if (capabilities.automaticBreakForce === true) {
    enabled.push("break-force");
  }
  if (capabilities.jointImpulseReadback === true) {
    enabled.push("joint-impulse");
  }
  if (capabilities.pairedNonFixedFrameB === true) {
    enabled.push("paired-frameB");
  }

  return enabled.length === 0 ? "none" : enabled.join(", ");
}

function metric(label, value) {
  const wrapper = document.createDocumentFragment();
  const term = document.createElement("dt");
  const detail = document.createElement("dd");

  term.textContent = label;
  detail.textContent = String(value);
  wrapper.append(term, detail);

  return wrapper;
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;

  const stateElement = document.querySelector("#example-state");
  const jsonElement = document.querySelector("#example-json");

  if (stateElement !== null) {
    const state =
      status.phase === "loading" ? "loading" : status.ok ? "ready" : "failed";

    stateElement.textContent = state;
    stateElement.dataset.state = state;
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return {
    ...baseStatus,
    ok: false,
    reason,
    message,
    phase: "failed",
  };
}
