const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.018, 0.024, 0.034, 1];

const baseStatus = {
  example: "worker-cube",
  workerModel: "ecs-extraction-worker-postmessage-snapshot",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas", "canvas-unavailable", "Canvas missing."));
  } else {
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 1 },
    });

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
    } else {
      const scene = registerPresentationAssets(aperture, created.app);

      startWorkerSnapshotLoop(aperture, created.app, scene);
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

function registerPresentationAssets(aperture, app) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "WorkerSnapshotCube",
      width: 1.55,
      height: 1.55,
      depth: 1.55,
    }),
    { id: "worker-cube" },
  );
  const materialAsset = aperture.createDebugNormalMaterialAsset({
    label: "WorkerSnapshotNormals",
  });
  const material = assets.materials.debugNormal.add(materialAsset, {
    id: "worker-cube-debug-normal",
  });

  return { mesh, material, materialAsset };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker("/worker-modules/examples/worker-cube.worker.js", {
    name: "aperture-worker-cube-simulation",
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

  loop.receivedSnapshots += 1;

  const snapshot = message.snapshot;
  const typedSnapshot = inspectStructuredCloneSnapshot(snapshot);
  const report = await app.render({
    snapshot,
    clearColor,
    label: "worker-cube-snapshot",
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

  publishStatus(status);

  if (status.ok) {
    requestWorkerFrame(worker, loop);
  } else {
    worker.terminate();
  }
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
  const firstResourceSet = reportJson.diagnosticsSummary?.routedResourceSet;
  const materialQueue = reportJson.diagnosticsSummary?.materialQueue;
  const reason = report.ok
    ? null
    : {
        reason: "worker-snapshot-render-failed",
        message: "The worker-produced render snapshot could not be rendered.",
      };

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason ?? {}),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
    clearColor: colorStatus(clearColor),
    worker: {
      running: loop.workerReady,
      scene: loop.workerScene,
      step: message.workerStep,
    },
    transport: {
      mode: "structured-clone-postMessage",
      jsonRoundTrip: false,
      snapshotsReceived: loop.receivedSnapshots,
      typedArraysPreserved: typedSnapshot,
    },
    extraction: snapshotCounts(snapshot),
    material: {
      kind: scene.materialAsset.kind,
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      workerMeshKey: loop.workerScene?.meshKey ?? null,
      workerMaterialKey: loop.workerScene?.materialKey ?? null,
      pipelineKey: firstDraw?.batchKey.pipelineKey ?? null,
    },
    resources: {
      drawCalls: report.counts.drawCalls,
      bindGroups:
        report.resources?.resources === null ||
        report.resources?.resources === undefined
          ? 0
          : report.resources.resources.bindGroups.length,
      materialQueueFamilies: materialQueue?.byFamily ?? [],
      routedResourceFamilies: firstResourceSet?.byFamily ?? [],
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    animation: message.animation,
    diagnosticsSummary: reportJson.diagnosticsSummary,
    diagnostics: reportJson.diagnostics,
    resourceReuse: reportJson.resourceReuse,
  };
}

function inspectStructuredCloneSnapshot(snapshot) {
  return {
    transforms: snapshot?.transforms instanceof Float32Array,
    viewMatrices: snapshot?.viewMatrices instanceof Float32Array,
    viewsArray: Array.isArray(snapshot?.views),
    meshDrawsArray: Array.isArray(snapshot?.meshDraws),
    diagnosticsArray: Array.isArray(snapshot?.diagnostics),
  };
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    environments: snapshot.environments.length,
    shadowRequests: snapshot.shadowRequests.length,
    bounds: snapshot.bounds.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
  };
}

function colorStatus(color) {
  return { r: color[0], g: color[1], b: color[2], a: color[3] };
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
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
