import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  areaLightScenarios,
  areaLightShapes,
  clearColor,
  readbackSamples,
  registerAreaLightShapesScene,
} from "./area-light-shapes-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      ...(readbackUsage.ok ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = registerAreaLightShapesScene(aperture, sourceAssets);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "area-light-shapes-failed",
      error instanceof Error
        ? error.message
        : "Area light shapes example failed.",
    ),
  );
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/area-light-shapes.worker.js",
    {
      name: "aperture-area-light-shapes-simulation",
      type: "module",
    },
  );
  const loop = {
    receivedSnapshots: 0,
    requestedScenarioIndex: 0,
    workerReady: false,
    workerScene: null,
    results: [],
    lastReport: null,
    lastMessage: null,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker-error",
        event.message || "The simulation worker reported an error.",
      ),
    );
    worker.terminate();
  });
  worker.postMessage({
    type: "init",
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  scene,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    requestNextScenario(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        message.reason ?? "worker-error",
        message.message ?? "The simulation worker failed.",
      ),
    );
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  loop.receivedSnapshots += 1;

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.receivedSnapshots,
    clearColor,
    label: `area-light-shapes-${message.scenario?.id ?? "unknown"}`,
    readbackSamples,
  });

  loop.lastReport = report;
  loop.lastMessage = message;
  loop.results.push({
    scenario: message.scenario,
    report,
    samples: prefixSamples(
      message.scenario?.id ?? "unknown",
      message.scenario?.shape ?? "unknown",
      report.readback,
    ),
    workerStep: message.workerStep,
    transport: inspectStructuredCloneSnapshot(report.snapshot),
  });

  if (loop.requestedScenarioIndex < areaLightScenarios.length) {
    requestNextScenario(worker, loop);
    return;
  }

  publishStatus(createStatus(aperture, app, scene, loop));
  worker.terminate();
}

function requestNextScenario(worker, loop) {
  const scenario = areaLightScenarios[loop.requestedScenarioIndex];

  loop.requestedScenarioIndex += 1;
  worker.postMessage({
    type: "frame",
    scenario: scenario.id,
  });
}

function prefixSamples(scenario, shape, readback) {
  return (readback?.samples ?? []).map((sample) => ({
    id: `${scenario}-${sample.id}`,
    scenario,
    shape,
    pixel: sample.pixel,
  }));
}

function createStatus(aperture, app, scene, loop) {
  const lastReport = loop.lastReport;
  const lastMessage = loop.lastMessage;
  const standardResources =
    lastReport?.resources?.resources?.standard?.[0] ?? null;
  const samples = loop.results.flatMap((result) => result.samples);
  const areaLightLtcEntryKeys =
    standardResources?.lightBindGroup?.entryResourceKeys?.filter((key) =>
      key.includes("standard-area-light-ltc"),
    ) ?? [];

  return {
    example: "area-light-shapes",
    ok:
      loop.results.length === areaLightScenarios.length &&
      loop.results.every((result) => result.report.ok),
    phase:
      lastReport?.ok === true &&
      loop.results.length === areaLightScenarios.length
        ? "submit"
        : "render",
    renderingBackend: "webgpu-explicit",
    frame: lastReport?.frame ?? 0,
    areaLights: areaLightShapes.map((shape) => ({
      kind: "rect-area",
      shape: shape.shape,
      width: shape.width,
      height: shape.height,
      intensity: shape.intensity,
    })),
    scenarios: loop.results.map((result) => ({
      id: result.scenario?.id ?? "unknown",
      shape: result.scenario?.shape ?? "unknown",
      material: result.scenario?.material ?? "unknown",
      roughness: result.scenario?.roughness ?? 0,
      surfaceRotationY: result.scenario?.surfaceRotationY ?? 0,
    })),
    counts: {
      meshDraws: lastReport?.snapshot.meshDraws.length ?? 0,
      lights: lastReport?.snapshot.lights.length ?? 0,
      diagnostics: sum(
        loop.results,
        (result) => result.report.diagnostics.length,
      ),
      drawCalls:
        lastReport?.counts?.drawCalls ?? lastReport?.draw?.drawCalls ?? 0,
      submittedShapes: areaLightShapes.length,
      submittedScenarios: loop.results.length,
    },
    resources: {
      lightBindGroup: standardResources?.lightBindGroup === undefined ? 0 : 1,
      lightGpuBuffers:
        standardResources?.lightGpuBuffers?.lightBuffer.count ?? 0,
      areaLightLtc: {
        size: aperture.STANDARD_AREA_LIGHT_LTC_SIZE,
        format: aperture.STANDARD_AREA_LIGHT_LTC_TEXTURE_FORMAT,
        payloadBytes: aperture.STANDARD_AREA_LIGHT_LTC_PAYLOAD_BYTE_LENGTH,
        boundEntries: areaLightLtcEntryKeys,
      },
    },
    readback: {
      ok: loop.results.every((result) => result.report.readback?.ok === true),
      samples,
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: lastMessage?.workerStep ?? null,
    },
    transport: {
      mode: "transferable-postMessage",
      typedArraysPreserved:
        loop.results[loop.results.length - 1]?.transport ?? null,
    },
    meshKey: aperture.assetHandleKey(scene.mesh),
    materialKey: aperture.assetHandleKey(scene.material),
    diagnostics: loop.results.flatMap((result) =>
      result.report.diagnostics.map((diagnostic) =>
        diagnosticToJsonValue(diagnostic),
      ),
    ),
    appDiagnostics: app.getDiagnostics(),
  };
}

function sum(values, read) {
  return values.reduce((total, value) => total + read(value), 0);
}

function diagnosticToJsonValue(diagnostic) {
  if (diagnostic === null || typeof diagnostic !== "object") {
    return diagnostic;
  }

  return Object.fromEntries(
    Object.entries(diagnostic).filter(
      ([, value]) => typeof value !== "function",
    ),
  );
}

function failure(reason, message) {
  return {
    example: "area-light-shapes",
    ok: false,
    reason,
    message,
  };
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
