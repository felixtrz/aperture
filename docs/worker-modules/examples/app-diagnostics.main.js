import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  appDiagnosticScenarios,
  clearColor,
  createAppDiagnosticScenarioStatus,
  createAppDiagnosticsBaseStatus,
  createExampleSamplerFidelitySummary,
  createExampleTextureFidelitySummary,
  failure,
  registerAppDiagnosticScene,
  webGpuFailure,
} from "./app-diagnostics-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const baseStatus = createAppDiagnosticsBaseStatus(canvas);

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("/aperture/worker-modules/packages/simulation/dist/index.js"),
      import("/aperture/worker-modules/packages/render/dist/index.js"),
      import("/aperture/worker-modules/packages/runtime/dist/index.js"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("/aperture/worker-modules/packages/webgpu/dist/index.js"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(
      failure(baseStatus, "canvas", "canvas-unavailable", "Canvas missing."),
    );
  } else {
    const scenarioStatuses = {};

    for (const scenario of appDiagnosticScenarios) {
      const result = await runDiagnosticScenario(aperture, scenario);

      if (!result.ready) {
        publishStatus(result.status);
        break;
      }

      scenarioStatuses[scenario.statusKey] = result.status;
    }

    if (
      Object.keys(scenarioStatuses).length === appDiagnosticScenarios.length
    ) {
      publishStatus({
        ...baseStatus,
        ok: true,
        phase: "diagnostics-ready",
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
        scenarios: scenarioStatuses,
        textureFidelitySummary: createExampleTextureFidelitySummary(aperture),
        samplerFidelitySummary: createExampleSamplerFidelitySummary(aperture),
        diagnosticCodes: [
          ...scenarioStatuses.mixedMaterials.diagnosticCodes,
          ...scenarioStatuses.materialDependencies.diagnosticCodes,
          ...scenarioStatuses.standardMaterialDependencies.diagnosticCodes,
        ],
      });
    }
  }
} catch (error) {
  publishStatus(
    failure(
      baseStatus,
      "dist-import",
      "dist-import-failed",
      error instanceof Error
        ? error.message
        : "The built Aperture workspace packages could not be imported.",
    ),
  );
}

async function runDiagnosticScenario(aperture, scenario) {
  const sourceAssets = new aperture.AssetRegistry();
  const scene = registerAppDiagnosticScene(aperture, sourceAssets, scenario.id);
  const created = await aperture.createWebGpuApp({
    canvas,
    simulationWorker: createNoopSimulationWorker(),
    sourceAssets,
  });

  if (!created.ok) {
    return {
      ready: false,
      status: webGpuFailure(aperture, baseStatus, created),
    };
  }

  const workerResult = await requestWorkerSnapshot(scene);

  if (!workerResult.ok) {
    return {
      ready: false,
      status: failure(
        baseStatus,
        "worker",
        workerResult.reason,
        workerResult.message,
      ),
    };
  }

  const report = await created.app.renderSnapshot(workerResult.snapshot, {
    frame: workerResult.frame,
    clearColor,
    label: scene.label,
  });

  return {
    ready: true,
    status: createAppDiagnosticScenarioStatus(aperture, scene, report, {
      worker: {
        running: true,
        snapshotsReceived: 1,
        step: workerResult.workerStep,
      },
      transport: {
        mode: "transferable-postMessage",
        typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
      },
    }),
  };
}

function requestWorkerSnapshot(scene) {
  return new Promise((resolve) => {
    const worker = new Worker(
      "/aperture/worker-modules/examples/app-diagnostics.worker.js",
      {
        name: `aperture-app-diagnostics-${scene.id}`,
        type: "module",
      },
    );

    worker.addEventListener("message", (event) => {
      const message = event.data;

      if (message?.type === "snapshot") {
        worker.terminate();
        resolve({
          ok: true,
          frame: message.frame ?? scene.frame,
          snapshot: message.snapshot,
          workerStep: message.workerStep ?? null,
        });
        return;
      }

      if (message?.type === "error") {
        worker.terminate();
        resolve({
          ok: false,
          reason: message.reason ?? "worker-error",
          message: message.message ?? "The app diagnostics worker failed.",
        });
      }
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      resolve({
        ok: false,
        reason: "worker-error",
        message:
          event.message || "The app diagnostics worker reported an error.",
      });
    });
    worker.postMessage({
      type: "run-scenario",
      scenario: scene.id,
      canvas: {
        width: canvas?.width ?? 960,
        height: canvas?.height ?? 540,
      },
    });
  });
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
