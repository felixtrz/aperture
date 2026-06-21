import {
  matcapClearColor as clearColor,
  matcapSpinAxis as spinAxis,
  matcapSpinRadiansPerSecond as spinRadiansPerSecond,
  registerMatcapAppAssets,
} from "./matcap-app-assets.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const playButton = document.querySelector("#matcap-play");
const pauseButton = document.querySelector("#matcap-pause");

const baseStatus = {
  example: "matcap-app",
  materialModel: "matcap-app-facade",
  workerModel: "ecs-extraction-worker-postmessage-snapshot",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

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
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
    });

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
    } else {
      const scene = registerMatcapAppAssets(aperture, sourceAssets);

      startAnimation(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "dist-import",
      "dist-import-failed",
      error instanceof Error
        ? error.message
        : "The built Aperture workspace packages could not be imported.",
    ),
  );
}

function startAnimation(aperture, app, scene) {
  const worker = new Worker("/aperture/worker-modules/examples/matcap-app.worker.js", {
    name: "aperture-matcap-app-simulation",
    type: "module",
  });
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
    running: true,
    animationRequest: null,
    latestStatus: null,
    resetDelta: false,
  };

  const pause = () => {
    if (!loop.running) {
      return;
    }

    loop.running = false;
    loop.resetDelta = true;

    if (loop.animationRequest !== null) {
      cancelAnimationFrame(loop.animationRequest);
      loop.animationRequest = null;
    }

    publishStatus(pausedStatus(loop.latestStatus));
  };
  const play = () => {
    if (loop.running) {
      return;
    }

    loop.running = true;
    loop.resetDelta = true;
    updatePlaybackControls(loop.running);
    requestWorkerFrame(worker, loop);
  };

  if (playButton !== null) {
    playButton.addEventListener("click", play);
  }

  if (pauseButton !== null) {
    pauseButton.addEventListener("click", pause);
  }

  updatePlaybackControls(loop.running);

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(aperture, app, scene, worker, loop, event.data);
  });
  worker.addEventListener("error", (event) => {
    publishStatus(
      failure(
        "worker",
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
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(
      failure(
        "worker",
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

  // A snapshot already in flight when pause() ran is dropped before rendering:
  // pause freezes the published status AND the presented frame together, so
  // the paused state stays deterministic. play() requests a fresh frame.
  if (!loop.running) {
    return;
  }

  loop.receivedSnapshots += 1;

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "matcap-app-facade",
  });
  const status = createFrameStatus(
    aperture,
    app,
    scene,
    loop,
    message,
    report,
    typedSnapshot,
  );

  // pause() may have fired during the async render above; the paused status
  // it published stays the last word and this straggler's status is dropped,
  // keeping the paused state deterministic.
  if (!loop.running) {
    return;
  }

  loop.latestStatus = status;
  publishStatus(status);

  if (!status.ok) {
    return;
  }

  requestWorkerFrame(worker, loop);
}

function requestWorkerFrame(worker, loop) {
  if (!loop.workerReady || !loop.running || loop.animationRequest !== null) {
    return;
  }

  loop.animationRequest = requestAnimationFrame((timestamp) => {
    loop.animationRequest = null;

    if (!loop.workerReady || !loop.running) {
      return;
    }

    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      timestamp,
      resetDelta: loop.resetDelta,
    });
    loop.resetDelta = false;
  });
}

function createFrameStatus(
  aperture,
  app,
  scene,
  loop,
  message,
  report,
  typedSnapshot,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const matcapResources = firstFamilyResource(resources, "matcap");
  const boundary = report.boundary;
  const reason = firstFailureReason(report, firstDraw, resources);
  const animation = message.animation ?? {
    frames: message.frame ?? 0,
    elapsedSeconds: 0,
    rotationRadians: 0,
    radiansPerSecond: spinRadiansPerSecond,
    spinAxis,
  };

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason === null ? {} : reason),
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    clearColor: {
      r: clearColor[0],
      g: clearColor[1],
      b: clearColor[2],
      a: clearColor[3],
    },
    extraction: snapshotCounts(snapshot),
    material: {
      kind: scene.materialAsset.kind,
      key: aperture.assetHandleKey(scene.material),
      baseColorFactor: Array.from(scene.materialAsset.baseColorFactor),
      matcapTexture: aperture.assetHandleKey(scene.texture),
      matcapSampler: aperture.assetHandleKey(scene.sampler),
    },
    pipeline: {
      key: firstDraw?.batchKey.pipelineKey ?? null,
      cacheKey: report.pipeline?.resource?.cacheKey ?? null,
    },
    resources: {
      materials: familyResourceCount(resources, "matcap", 1),
      bindGroups: resources?.bindGroups.length ?? 0,
      materialBindGroup:
        matcapResources?.materialBindGroup === undefined ? 0 : 1,
      reuse: report.resourceReuse,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    command: {
      commands: boundary?.execution?.commandCount ?? 0,
      drawCount: boundary?.execution?.drawCalls ?? 0,
      indexedDrawCount: boundary?.execution?.indexedDrawCalls ?? 0,
    },
    submission: {
      commandBuffers: boundary?.submit?.submitted ?? 0,
      drawCalls: boundary?.execution?.drawCalls ?? 0,
      indexedDrawCalls: boundary?.execution?.indexedDrawCalls ?? 0,
    },
    execution: {
      running: loop.running,
      ecs: loop.running ? "stepping" : "paused",
    },
    animation: {
      frames: animation.frames,
      elapsedSeconds: Number(animation.elapsedSeconds.toFixed(4)),
      rotationRadians: Number(animation.rotationRadians.toFixed(4)),
      radiansPerSecond: animation.radiansPerSecond,
      spinAxis: animation.spinAxis,
      transformDiagnostics: message.workerStep?.transformDiagnostics ?? 0,
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    report: reportJson,
  };
}

function firstFamilyResource(resources, family) {
  const list = resources?.[family];

  if (Array.isArray(list) && list.length > 0) {
    return list[0];
  }

  return resources;
}

function familyResourceCount(resources, family, fallback) {
  const list = resources?.[family];

  return Array.isArray(list) ? list.length : fallback;
}

function pausedStatus(status) {
  updatePlaybackControls(false);

  return {
    ...(status ?? { ...baseStatus, ok: true }),
    ok: true,
    phase: "paused",
    execution: {
      running: false,
      ecs: "paused",
    },
  };
}

function firstFailureReason(report, firstDraw, resources) {
  if (report.ok) {
    return null;
  }

  if (firstDraw === undefined) {
    return {
      reason: "empty-snapshot",
      message: "The Matcap app scene did not extract a drawable mesh.",
    };
  }

  if (resources === null) {
    return {
      reason: "matcap-resources-unavailable",
      message: "The Matcap app material resources were not ready.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The Matcap app frame could not be rendered.",
  };
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
  };
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent =
      status.phase === "paused" ? "paused" : status.ok ? "animating" : "failed";
    stateElement.dataset.state =
      status.phase === "paused" ? "paused" : status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function updatePlaybackControls(running) {
  if (playButton !== null) {
    playButton.disabled = running;
    playButton.setAttribute("aria-pressed", running ? "true" : "false");
  }

  if (pauseButton !== null) {
    pauseButton.disabled = !running;
    pauseButton.setAttribute("aria-pressed", running ? "false" : "true");
  }
}
