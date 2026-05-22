import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
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
    requestedShapeIndex: 0,
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
    requestNextShape(worker, loop);
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
    label: `area-light-shapes-${message.shape?.shape ?? "unknown"}`,
    readbackSamples,
  });

  loop.lastReport = report;
  loop.lastMessage = message;
  loop.results.push({
    shape: message.shape,
    report,
    samples: prefixSamples(message.shape?.shape ?? "unknown", report.readback),
    workerStep: message.workerStep,
    transport: inspectStructuredCloneSnapshot(report.snapshot),
  });

  if (loop.requestedShapeIndex < areaLightShapes.length) {
    requestNextShape(worker, loop);
    return;
  }

  publishStatus(createStatus(aperture, app, scene, loop));
  worker.terminate();
}

function requestNextShape(worker, loop) {
  const shape = areaLightShapes[loop.requestedShapeIndex];

  loop.requestedShapeIndex += 1;
  worker.postMessage({
    type: "frame",
    shape: shape.shape,
  });
}

function prefixSamples(shape, readback) {
  return (readback?.samples ?? []).map((sample) => ({
    id: `${shape}-${sample.id}`,
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

  return {
    example: "area-light-shapes",
    ok:
      loop.results.length === areaLightShapes.length &&
      loop.results.every((result) => result.report.ok),
    phase:
      lastReport?.ok === true && loop.results.length === areaLightShapes.length
        ? "submit"
        : "render",
    renderingBackend: "webgpu-explicit",
    frame: lastReport?.frame ?? 0,
    areaLights: loop.results.map((result) => ({
      kind: "rect-area",
      shape: result.shape?.shape ?? "unknown",
      width: result.shape?.width ?? 0,
      height: result.shape?.height ?? 0,
      intensity: result.shape?.intensity ?? 0,
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
      submittedShapes: loop.results.length,
    },
    resources: {
      lightBindGroup: standardResources?.lightBindGroup === undefined ? 0 : 1,
      lightGpuBuffers:
        standardResources?.lightGpuBuffers?.lightBuffer.count ?? 0,
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
