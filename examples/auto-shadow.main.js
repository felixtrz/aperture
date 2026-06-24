import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";
import {
  clearColor,
  registerCsmDirectionalShadowScene,
  shadowIntent,
} from "./csm-directional-shadow-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const shadowReceiverToggle = document.querySelector("#shadow-receiver-toggle");
const exampleParams = new URLSearchParams(globalThis.location.search);
const shadowControls = {
  receiverEnabled: !exampleParams.has("disable-shadow-receiver"),
};
const stopAfterReady = exampleParams.has("stop-after-ready");

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("@aperture-engine/simulation"),
      import("@aperture-engine/render"),
      import("@aperture-engine/runtime"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-auto-shadow",
        }),
      );
    } else {
      const scene = createPresentationScene(aperture, sourceAssets, canvas);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "auto-shadow-failed",
      error instanceof Error ? error.message : "Auto-shadow example failed.",
    ),
  );
}

function createPresentationScene(aperture, sourceAssets, targetCanvas) {
  const assets = registerCsmDirectionalShadowScene(aperture, sourceAssets);

  setupShadowControls(shadowControls);

  return {
    canvas: targetCanvas,
    receiverMeshKeys: assets.receiverMeshKeys,
    casterMeshKeys: assets.casterMeshKeys,
    shadowControls,
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/worker-modules/examples/auto-shadow.worker.js", {
    name: "aperture-auto-shadow-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
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
    controls: scene.shadowControls,
  });
  globalThis.__APERTURE_STOP_EXAMPLE__ = () => {
    loop.workerReady = false;
    worker.terminate();
  };
  window.__APERTURE_STOP_EXAMPLE__ = globalThis.__APERTURE_STOP_EXAMPLE__;
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
    requestWorkerFrame(worker, loop);
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
    frame: message.frame,
    clearColor,
    label: "auto-shadow-app",
  });

  publishFrameStatus(aperture, app, scene, loop, message.workerStep, report);
  requestWorkerFrame(worker, loop);
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.workerReady) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
    });
  });
}

function publishFrameStatus(aperture, app, scene, loop, step, report) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const route = findAutoShadowRoute(reportJson);
  const shadowSubmissionStatus = report.shadow?.commandBufferSubmission.status;
  const renderingSupported =
    scene.shadowControls.receiverEnabled &&
    report.frame >= 3 &&
    report.shadow?.ready === true &&
    (report.shadow?.drawCalls ?? 0) > 0 &&
    (shadowSubmissionStatus === "submitted" ||
      shadowSubmissionStatus === "ready") &&
    route !== null;

  publishStatus({
    example: "auto-shadow",
    ok: report.ok,
    phase: report.ok ? "render" : "failed",
    renderingBackend: "webgpu-auto-shadow",
    frame: report.frame,
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    transport: {
      mode: "transferable-postMessage",
      typedArraysPreserved: inspectStructuredCloneSnapshot(report.snapshot),
    },
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    scene: {
      receiverMeshKeys: scene.receiverMeshKeys,
      casterMeshKeys: scene.casterMeshKeys,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      shadowRequests: report.snapshot.shadowRequests.length,
      diagnostics: report.snapshot.diagnostics.length,
      transformDiagnostics: step?.diagnostics ?? 0,
    },
    shadow: {
      controls: {
        receiverEnabled: scene.shadowControls.receiverEnabled,
      },
      intent: {
        ...shadowIntent,
        kind: "directional",
      },
      requests: report.snapshot.shadowRequests.map((request) => ({
        shadowId: request.shadowId,
        lightId: request.lightId,
        lightKind: request.lightKind,
        cascadeCount: request.cascadeCount ?? 1,
        casterLayerMask: request.casterLayerMask,
        receiverLayerMask: request.receiverLayerMask,
      })),
      report: reportJson.shadow ?? null,
      rendering: {
        supported: renderingSupported,
        mode: "frame-loop-auto-directional-csm",
        cascadeCount: shadowIntent.cascadeCount,
        pipelineKey: route?.pipelineKey ?? null,
      },
    },
    resources: {
      routeFamilies: familyBuckets(report),
      cascadedShadowRoute: route,
      bindGroups: report.resources?.resources?.bindGroups.length ?? 0,
      reuse: report.resourceReuse,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
      indexedDrawCalls: report.boundary?.execution?.indexedDrawCalls ?? 0,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
  });

  if (stopAfterReady && renderingSupported) {
    globalThis.__APERTURE_STOP_EXAMPLE__?.();
  }
}

function findAutoShadowRoute(reportJson) {
  const pipelines =
    reportJson.diagnosticsSummary?.routedResourceSet?.byPipeline ?? [];

  return (
    pipelines.find(
      (pipeline) =>
        pipeline.pipelineKey.includes("shadowMap") ||
        pipeline.pipelineKey.includes("cascadedShadowMap"),
    ) ?? null
  );
}

function familyBuckets(report) {
  const buckets = report.resources?.routeSummary?.familyBuckets;

  if (!Array.isArray(buckets)) {
    return [];
  }

  return buckets.map((bucket) => ({
    family: bucket.family,
    routedItems: bucket.routedItems,
    frameResources: bucket.frameResources,
  }));
}

function setupShadowControls(controls) {
  if (shadowReceiverToggle !== null) {
    shadowReceiverToggle.checked = controls.receiverEnabled;
    shadowReceiverToggle.addEventListener("change", () => {
      const nextParams = new URLSearchParams(globalThis.location.search);

      if (shadowReceiverToggle.checked) {
        nextParams.delete("disable-shadow-receiver");
      } else {
        nextParams.set("disable-shadow-receiver", "1");
      }

      globalThis.location.search = nextParams.toString();
    });
  }
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? (status.phase ?? "ready") : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message, extra = {}) {
  return {
    example: "auto-shadow",
    ok: false,
    phase: "failed",
    reason,
    message,
    ...extra,
  };
}
