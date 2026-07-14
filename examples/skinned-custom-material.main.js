import { mirrorSourceAssetRegistryFromMessage } from "/packages/app/dist/asset-mirror.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.02, 0.03, 0.05, 1];
const params = new URLSearchParams(window.location.search);
const staticBend = finiteOrNull(params.get("bend"));
const staticDissolve = finiteOrNull(params.get("dissolve"));

// A grid of readback probes over the strip's projected band. The e2e compares
// these across poses (bind vs bent proves skinning moves vertices) and across
// frames (proves the dissolve animates).
const readbackSamples = [];
for (let gy = 0; gy < 5; gy += 1) {
  for (let gx = 0; gx < 3; gx += 1) {
    readbackSamples.push({
      id: `s-${gx}-${gy}`,
      x: 0.4 + gx * 0.1,
      y: 0.22 + gy * 0.13,
    });
  }
}
const animationSamples = [];

const baseStatus = {
  example: "skinned-custom-material",
  scenario: "skinned-dissolve",
  mode:
    staticBend !== null || staticDissolve !== null ? "static-pose" : "animated",
  bend: staticBend,
  dissolve: staticDissolve,
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
      startWorkerLoop(aperture, created.app, sourceAssets);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "skinned-custom-material-example-failed",
      error instanceof Error
        ? error.message
        : "The skinned custom material example failed.",
    ),
  );
}

function startWorkerLoop(aperture, app, sourceAssets) {
  const worker = new Worker(
    "/worker-modules/examples/skinned-custom-material.worker.js",
    {
      name: "aperture-skinned-custom-material-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    ready: false,
    startedAt: performance.now(),
    lastTimestamp: performance.now(),
    scene: null,
    mirroredSourceAssets: 0,
    skippedSourceAssets: 0,
  };

  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      sourceAssets,
      worker,
      loop,
      event.data,
    );
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
    ...(staticBend === null ? {} : { bend: staticBend }),
    ...(staticDissolve === null ? {} : { dissolve: staticDissolve }),
    canvas: {
      width: canvas?.width ?? 960,
      height: canvas?.height ?? 540,
    },
  });
}

async function handleWorkerMessage(
  aperture,
  app,
  sourceAssets,
  worker,
  loop,
  message,
) {
  if (message?.type === "ready") {
    loop.ready = true;
    loop.scene = message.scene ?? null;
    requestWorkerFrame(worker, loop);
    return;
  }

  if (message?.type === "error") {
    publishStatus(failure(message.reason ?? "worker-error", message.message));
    worker.terminate();
    return;
  }

  if (message?.type !== "snapshot") {
    return;
  }

  const mirror = mirrorSourceAssetRegistryFromMessage(sourceAssets, message);
  loop.mirroredSourceAssets += mirror.mirrored;
  loop.skippedSourceAssets += mirror.skipped;

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "skinned-custom-material-app-route",
    readbackSamples,
  });
  const status = createStatus(aperture, report, message, loop, mirror);

  publishStatus(status);

  if (status.ok !== true) {
    worker.terminate();
    return;
  }

  requestWorkerFrame(worker, loop);
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame((timestamp) => {
    if (!loop.ready) {
      return;
    }

    const elapsedSeconds = (timestamp - loop.startedAt) / 1000;
    const deltaSeconds = Math.max(0, (timestamp - loop.lastTimestamp) / 1000);

    loop.lastTimestamp = timestamp;
    loop.frame += 1;
    worker.postMessage({
      type: "frame",
      frame: loop.frame,
      time: elapsedSeconds,
      delta: deltaSeconds,
    });
  });
}

function createStatus(aperture, report, message, loop, mirror) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const firstDraw = report.snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const diagnosticsByCode = countDiagnosticsByCode(report.diagnostics);
  const readback = report.readback;
  // Custom-material draws carry a bone-matrix range but keep batchKey.skinned
  // FALSE (that flag drives the STANDARD skinned pipeline), so a custom draw is
  // "skinned" when it has a bone-matrix count.
  const skinnedDraws = report.snapshot.meshDraws.filter(
    (draw) => (draw.boneMatrixCount ?? 0) > 0,
  ).length;
  const boneCount = Math.floor((report.snapshot.bones?.length ?? 0) / 16);

  if (readback?.samples !== undefined && readback.samples.length > 0) {
    animationSamples.push({
      frame: message.frame,
      bend: message.bend,
      dissolve: message.dissolve,
      samples: readback.samples.map((sample) => ({
        id: sample.id,
        pixel: sample.pixel,
      })),
    });

    if (animationSamples.length > 8) {
      animationSamples.shift();
    }
  }

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    reason: report.ok ? undefined : "skinned-custom-material-render-failed",
    renderingBackend: "webgpu-app-route",
    clearColor,
    customMaterial: {
      family: firstDraw?.batchKey.pipelineKey.split("|")[0] ?? null,
      sourceMaterialKey: loop.scene?.materialKey ?? null,
      shaderAssetKey: loop.scene?.shaderKey ?? null,
      materialResourceKey: resources?.material?.resourceKey ?? null,
      pipelineKey: firstDraw?.batchKey.pipelineKey ?? null,
      resourcePipelineKey: resources?.custom?.pipeline?.cacheKey ?? null,
      bindGroupResourceKey: resources?.material?.resourceKey ?? null,
      bindingCount:
        resources?.custom?.bindGroup?.descriptor?.entries.length ?? 0,
      diagnostics: report.diagnostics.length,
      diagnosticsByCode,
    },
    skinning: {
      skinnedDraws,
      boneCount,
      boneMatrixOffset: firstDraw?.boneMatrixOffset ?? null,
      boneMatrixCount: firstDraw?.boneMatrixCount ?? null,
    },
    worker: {
      ready: loop.ready,
      scene: loop.scene,
      frame: message.frame,
      bend: message.bend,
      dissolve: message.dissolve,
    },
    transport: {
      snapshot: inspectStructuredCloneSnapshot(message.snapshot),
      mirroredSourceAssets: loop.mirroredSourceAssets,
      skippedSourceAssets: loop.skippedSourceAssets,
      lastMirror: mirror,
    },
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      skinnedDraws,
      bones: boneCount,
      diagnostics: report.snapshot.diagnostics.length,
    },
    rendering: {
      drawPackages: report.counts.drawPackages,
      drawCommands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
      resourceReuse: reportJson.resourceReuse,
      diagnosticsSummary: reportJson.diagnosticsSummary ?? null,
    },
    readback,
    animation: {
      frame: message.frame,
      elapsedSeconds: message.time,
      deltaSeconds: message.delta,
      bend: message.bend,
      dissolve: message.dissolve,
      samples: [...animationSamples],
    },
    diagnostics: reportJson.diagnostics,
  };
}

function countDiagnosticsByCode(diagnostics) {
  const counts = {};

  for (const diagnostic of diagnostics) {
    const code =
      typeof diagnostic === "object" &&
      diagnostic !== null &&
      typeof diagnostic.code === "string"
        ? diagnostic.code
        : "unknown";

    counts[code] = (counts[code] ?? 0) + 1;
  }

  return counts;
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ok" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}

function failure(reason, message) {
  return {
    ...baseStatus,
    ok: false,
    phase: reason,
    reason,
    message,
  };
}

function finiteOrNull(value) {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
