const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.018, 0.024, 0.034, 1];

const baseStatus = {
  example: "sab-cube",
  workerModel: "ecs-extraction-worker-shared-array-buffer-snapshot",
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
    const sourceAssets = new aperture.AssetRegistry();
    const scene = registerPresentationAssets(aperture, sourceAssets);
    const simulationWorker = createSabSimulationWorker();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker,
      sourceAssets,
      transport: "shared-array-buffer",
      sharedSnapshotTransport: {
        maxEntities: 8,
        maxViews: 2,
        maxPacketWords: 2048,
      },
    });

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
    } else {
      const transport = created.app.getDiagnostics().transport;

      if (transport.active !== "shared-array-buffer") {
        const diagnostic = transport.sharedArrayBuffer?.diagnostic;

        publishStatus({
          ...failure(
            "transport",
            diagnostic?.reason ?? "shared-array-buffer-unavailable",
            diagnostic?.message ??
              "SharedArrayBuffer transport is unavailable for this page.",
          ),
          apertureVersion: aperture.APERTURE_VERSION,
          renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
          transport,
        });
      } else {
        startSabStatusLoop(aperture, created.app, scene, simulationWorker);
      }
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

function registerPresentationAssets(aperture, sourceAssets) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SabSnapshotCube",
      width: 1.55,
      height: 1.55,
      depth: 1.55,
    }),
    { id: "sab-cube" },
  );
  const materialAsset = aperture.createDebugNormalMaterialAsset({
    label: "SabSnapshotNormals",
  });
  const material = assets.materials.debugNormal.add(materialAsset, {
    id: "sab-cube-debug-normal",
  });

  return { mesh, material, materialAsset };
}

function createSabSimulationWorker() {
  const worker = new Worker("/worker-modules/examples/sab-cube.worker.js", {
    name: "aperture-sab-cube-simulation",
    type: "module",
  });
  const snapshotCallbacks = new Set();
  const errorCallbacks = new Set();
  let lastWorkerMessage = null;

  worker.addEventListener("message", (event) => {
    const message = event.data;

    if (message?.type === "snapshot") {
      lastWorkerMessage = message;

      for (const callback of snapshotCallbacks) {
        callback({
          snapshot: createPlaceholderSnapshot(message.frame ?? 0),
          frame: message.frame ?? 0,
          message,
        });
      }
      return;
    }

    if (message?.type === "error") {
      const eventPayload = {
        reason: message.reason ?? "worker-error",
        message: message.message ?? "The simulation worker failed.",
      };

      for (const callback of errorCallbacks) {
        callback(eventPayload);
      }
    }
  });
  worker.addEventListener("error", (event) => {
    const eventPayload = {
      reason: "worker-error",
      message: event.message || "The simulation worker reported an error.",
    };

    for (const callback of errorCallbacks) {
      callback(eventPayload);
    }
  });

  return {
    get lastWorkerMessage() {
      return lastWorkerMessage;
    },
    start(options = {}) {
      worker.postMessage({
        type: "start",
        options,
        canvas: {
          width: canvas?.width ?? 960,
          height: canvas?.height ?? 540,
        },
      });
    },
    onSnapshot(callback) {
      snapshotCallbacks.add(callback);
      return () => {
        snapshotCallbacks.delete(callback);
      };
    },
    onError(callback) {
      errorCallbacks.add(callback);
      return () => {
        errorCallbacks.delete(callback);
      };
    },
    terminate() {
      worker.terminate();
      snapshotCallbacks.clear();
      errorCallbacks.clear();
    },
  };
}

function startSabStatusLoop(aperture, app, scene, simulationWorker) {
  let lastPublishedFrame = -1;

  app.start();

  const publishLatestFrame = () => {
    const diagnostics = app.getDiagnostics();
    const frame = diagnostics.lastFrame;
    const workerMessage = simulationWorker.lastWorkerMessage;

    if (frame !== null && frame.frame !== lastPublishedFrame) {
      lastPublishedFrame = frame.frame;
      publishStatus(
        createFrameStatus(aperture, app, scene, diagnostics, workerMessage),
      );
    }

    requestAnimationFrame(publishLatestFrame);
  };

  requestAnimationFrame(publishLatestFrame);
}

function createFrameStatus(aperture, app, scene, diagnostics, workerMessage) {
  const frame = diagnostics.lastFrame;
  const materialQueue = frame?.diagnosticsSummary?.materialQueue;
  const routedResourceSet = frame?.diagnosticsSummary?.routedResourceSet;

  return {
    ...baseStatus,
    ok: frame?.ok === true,
    phase: frame?.ok === true ? "animate" : "render",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
    clearColor: colorStatus(clearColor),
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    transport: {
      requested: diagnostics.transport.requested,
      mode: diagnostics.transport.active,
      fallback: diagnostics.transport.fallback,
      sharedArrayBufferSupported:
        diagnostics.transport.sharedArrayBuffer?.supported ?? false,
      layout:
        diagnostics.transport.sharedArrayBuffer?.supported === true
          ? diagnostics.transport.sharedArrayBuffer.layout
          : null,
      write: workerMessage?.writeReport ?? null,
      packetRegistry: workerMessage?.packetRegistry ?? null,
      microbenchmark: workerMessage?.microbenchmark ?? null,
    },
    worker: {
      running: workerMessage !== null,
      scene: workerMessage?.scene ?? null,
      step: workerMessage?.workerStep ?? null,
    },
    extraction: frame?.counts ?? null,
    material: {
      kind: scene.materialAsset.kind,
      meshKey: aperture.assetHandleKey(scene.mesh),
      materialKey: aperture.assetHandleKey(scene.material),
      workerMeshKey: workerMessage?.scene?.meshKey ?? null,
      workerMaterialKey: workerMessage?.scene?.materialKey ?? null,
    },
    resources: {
      drawCalls: frame?.counts.drawCalls ?? 0,
      materialQueueFamilies: materialQueue?.byFamily ?? [],
      routedResourceFamilies: routedResourceSet?.byFamily ?? [],
    },
    draw: {
      packages: frame?.counts.drawPackages ?? 0,
      commands: frame?.counts.drawCommands ?? 0,
      drawCalls: frame?.counts.drawCalls ?? 0,
    },
    animation: workerMessage?.animation ?? null,
    diagnosticsSummary: frame?.diagnosticsSummary ?? null,
    diagnostics: frame?.diagnostics ?? [],
    resourceReuse: frame?.resourceReuse ?? null,
  };
}

function createPlaceholderSnapshot(frame) {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function colorStatus(color) {
  return {
    r: Math.round(color[0] * 255),
    g: Math.round(color[1] * 255),
    b: Math.round(color[2] * 255),
    a: Math.round(color[3] * 255),
  };
}

function failure(phase, reason, message) {
  return {
    ...baseStatus,
    ok: false,
    phase,
    reason,
    message,
  };
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "ready" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
