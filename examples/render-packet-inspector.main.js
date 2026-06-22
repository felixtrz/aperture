import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const meshId = "render-packet-inspector-cube";
const materialId = "render-packet-inspector-unlit";
const environmentMapId = "render-packet-inspector-studio";
const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.018, 0.026, 0.035, 1];

const baseStatus = {
  example: "render-packet-inspector",
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
    const scene = registerPresentationAssets(aperture, sourceAssets);
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
      startWorkerSnapshot(aperture, created.app, scene);
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
      label: "RenderPacketInspectorCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: meshId },
  );
  const materialAsset = aperture.createUnlitMaterialAsset({
    label: "RenderPacketInspectorUnlit",
    baseColorFactor: new Float32Array([0.18, 0.78, 1, 1]),
  });
  const material = assets.materials.unlit.add(materialAsset, {
    id: materialId,
  });
  const environmentMap = aperture.createEnvironmentMapHandle(environmentMapId);

  sourceAssets.register(environmentMap, {
    label: "Render packet inspector studio IBL",
  });
  sourceAssets.markReady(environmentMap, {
    label: "Render packet inspector studio IBL",
    diffuseResourceKey: "render-packet-inspector/studio/diffuse",
  });

  return { mesh, material, materialAsset, environmentMap };
}

function startWorkerSnapshot(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/render-packet-inspector.worker.js",
    {
      name: "aperture-render-packet-inspector-simulation",
      type: "module",
    },
  );
  const loop = {
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
    requestAnimationFrame((timestamp) => {
      worker.postMessage({
        type: "snapshot",
        frame: 1,
        timestamp,
      });
    });
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
  const report = await app.renderSnapshot(snapshot, {
    clearColor,
    label: "render-packet-inspector-snapshot",
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

  if (!status.ok) {
    worker.terminate();
  }
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
  const materialQueue = reportJson.diagnosticsSummary?.materialQueue;
  const routedResourceSet = reportJson.diagnosticsSummary?.routedResourceSet;

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "inspect" : "render",
    ...(report.ok
      ? {}
      : {
          reason: "packet-inspector-render-failed",
          message: "The worker-produced render snapshot could not be rendered.",
        }),
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
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
      environmentMapKey: aperture.assetHandleKey(scene.environmentMap),
      workerMeshKey: loop.workerScene?.meshKey ?? null,
      workerMaterialKey: loop.workerScene?.materialKey ?? null,
      workerEnvironmentMapKey: loop.workerScene?.environmentMapKey ?? null,
    },
    resources: {
      drawCalls: report.counts.drawCalls,
      materialQueueFamilies: materialQueue?.byFamily ?? [],
      routedResourceFamilies: routedResourceSet?.byFamily ?? [],
    },
    draw: {
      packages: report.counts.drawPackages,
      commands: report.counts.drawCommands,
      drawCalls: report.counts.drawCalls,
    },
    packetInspector: createPacketInspectorStatus(
      aperture,
      snapshot,
      loop.workerScene,
    ),
    diagnosticsSummary: reportJson.diagnosticsSummary,
    diagnostics: reportJson.diagnostics,
    resourceReuse: reportJson.resourceReuse,
  };
}

function createPacketInspectorStatus(aperture, snapshot, workerScene) {
  const inspection = aperture.inspectRenderSnapshot(snapshot);
  const visibleEntity = workerScene?.visibleEntity;
  const disabledEntity = workerScene?.disabledEntity;

  return {
    counts: inspection.counts,
    handles: inspection.handles,
    views: snapshot.views.map((view) => ({
      viewId: view.viewId,
      camera: view.camera,
      priority: view.priority,
      layerMask: view.layerMask,
      viewport: Array.from(view.viewport),
      renderTargetKey: assetKeyOrNull(aperture, view.renderTarget),
    })),
    draws: snapshot.meshDraws.map((draw) => ({
      renderId: draw.renderId,
      entity: draw.entity,
      meshKey: aperture.assetHandleKey(draw.mesh),
      materialKey: aperture.assetHandleKey(draw.material),
      submesh: draw.submesh,
      materialSlot: draw.materialSlot,
      boundsIndex: draw.boundsIndex,
      layerMask: draw.layerMask,
      sortKey: draw.sortKey,
      batchKey: draw.batchKey,
    })),
    lights: snapshot.lights.map((light) => ({
      lightId: light.lightId,
      entity: light.entity,
      kind: light.kind,
      intensity: light.intensity,
      layerMask: light.layerMask,
      worldTransformOffset: light.worldTransformOffset,
    })),
    environments: snapshot.environments.map((environment) => ({
      environmentId: environment.environmentId,
      handleKey: assetKeyOrNull(aperture, environment.handle),
      intensity: environment.intensity,
      layerMask: environment.layerMask,
    })),
    shadowRequests: snapshot.shadowRequests.map((shadow) => ({
      shadowId: shadow.shadowId,
      lightId: shadow.lightId,
      lightKind: shadow.lightKind ?? null,
      casterLayerMask: shadow.casterLayerMask,
      receiverLayerMask: shadow.receiverLayerMask,
    })),
    bounds: snapshot.bounds.map((bound) => ({
      boundsId: bound.boundsId,
      entity: bound.entity,
      localAabb: aabbStatus(bound.localAabb),
      worldAabb: aabbStatus(bound.worldAabb),
    })),
    cullStats: snapshot.report.cullStats ?? [],
    queueKeys: snapshot.meshDraws.map((draw) => ({
      renderId: draw.renderId,
      queue: draw.sortKey.queue,
      pipelineKey: draw.sortKey.pipelineKey,
      materialKey: draw.sortKey.materialKey,
      meshKey: draw.sortKey.meshKey,
      batchPipelineKey: draw.batchKey.pipelineKey,
      instanced: draw.batchKey.instanced,
    })),
    skippedEntities: {
      ...(visibleEntity === undefined
        ? {}
        : {
            visible: aperture.explainRenderSnapshotEntity(
              snapshot,
              visibleEntity,
            ),
          }),
      ...(disabledEntity === undefined
        ? {}
        : {
            disabled: aperture.explainRenderSnapshotEntity(
              snapshot,
              disabledEntity,
            ),
          }),
    },
    diagnosticCodes: snapshot.diagnostics.map((diagnostic) => diagnostic.code),
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
    cullStats: snapshot.report.cullStats ?? [],
  };
}

function aabbStatus(aabb) {
  return {
    min: Array.from(aabb.min),
    max: Array.from(aabb.max),
  };
}

function assetKeyOrNull(aperture, handle) {
  return handle === null ? null : aperture.assetHandleKey(handle);
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
