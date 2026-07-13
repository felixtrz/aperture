import { mirrorSourceAssetRegistryFromMessage } from "/packages/app/dist/asset-mirror.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import {
  clearColor,
  readbackSamples,
  sliceColors,
} from "./volume-texture-lut-scene.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

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
      "volume-texture-lut-failed",
      error instanceof Error
        ? error.message
        : "The volume texture example failed.",
    ),
  );
}

function startWorkerLoop(aperture, app, sourceAssets) {
  const worker = new Worker(
    "/worker-modules/examples/volume-texture-lut.worker.js",
    {
      name: "aperture-volume-texture-lut-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    ready: false,
    scene: null,
    mirroredSourceAssets: 0,
    lastReport: null,
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
    canvas: { width: canvas?.width ?? 960, height: canvas?.height ?? 540 },
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

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "volume-texture-lut",
    readbackSamples,
  });
  loop.lastReport = report;

  if ((report.ok !== true || report.readback?.ok !== true) && loop.frame < 30) {
    requestWorkerFrame(worker, loop);
    return;
  }

  publishStatus(createStatus(aperture, app, report, loop));
  worker.terminate();
}

function requestWorkerFrame(worker, loop) {
  requestAnimationFrame(() => {
    if (!loop.ready) {
      return;
    }
    loop.frame += 1;
    worker.postMessage({ type: "frame", frame: loop.frame });
  });
}

function createStatus(aperture, app, report, loop) {
  const resources = report.resources?.resources ?? null;
  const samples = report.readback?.samples ?? [];
  const readbackOk = report.readback?.ok === true;

  return {
    example: "volume-texture-lut",
    ok: report.ok === true && report.diagnostics.length === 0 && readbackOk,
    phase: report.ok === true ? "submit" : "render",
    renderingBackend: "webgpu-app-route",
    frame: report.frame ?? 0,
    volume: {
      dimension: "3d",
      size: 4,
      sliceColors,
    },
    counts: {
      meshDraws: report.snapshot.meshDraws.length,
      diagnostics: report.diagnostics.length,
      drawCalls: report.counts?.drawCalls ?? 0,
    },
    customMaterial: {
      family:
        report.snapshot.meshDraws[0]?.batchKey.pipelineKey.split("|")[0] ??
        null,
      pipelineKey: report.snapshot.meshDraws[0]?.batchKey.pipelineKey ?? null,
      bindingCount:
        resources?.custom?.bindGroup?.descriptor?.entries.length ?? 0,
      sourceMaterialKey: loop.scene?.materialKey ?? null,
      textureKey: loop.scene?.textureKey ?? null,
    },
    readback: {
      ok: readbackOk,
      samples: samples.map((sample) => ({
        id: sample.id,
        pixel: sample.pixel,
      })),
    },
    worker: {
      ready: loop.ready,
      scene: loop.scene,
      mirroredSourceAssets: loop.mirroredSourceAssets,
    },
    diagnostics: aperture.webGpuAppRenderReportToJsonValue(report).diagnostics,
    appDiagnostics: app.getDiagnostics(),
  };
}

function failure(reason, message) {
  return { example: "volume-texture-lut", ok: false, reason, message };
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
