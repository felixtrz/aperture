import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.012, 0.016, 0.024, 1];
const columns = 16;
const rows = 16;
const instanceCount = columns * rows;
const spacing = 0.44;
const orthographicHeight = 7.2;

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
      publishStatus(failure(created.reason, created.message));
    } else {
      const scene = registerInstanceTintAssets(aperture, sourceAssets, canvas);

      startWorkerSnapshotLoop(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "instance-tint-failed",
      error instanceof Error ? error.message : "Instance tint example failed.",
    ),
  );
}

function registerInstanceTintAssets(aperture, sourceAssets, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const aspect = targetCanvas.width / targetCanvas.height;
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "InstanceTintBox",
      width: 1,
      height: 1,
      depth: 1,
    }),
    { id: "instance-tint-box" },
  );
  const material = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "InstanceTintSharedStandard",
      baseColorFactor: new Float32Array([1, 1, 1, 1]),
      metallicFactor: 0,
      roughnessFactor: 1,
      renderState: { cullMode: "none" },
    }),
    { id: "instance-tint-standard" },
  );
  const samples = {};

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tint = tintForCell(column, row);
      const translation = translationForCell(column, row);

      if (row === Math.floor(rows / 2) && column === 1) {
        samples.red = sampleForCell("red", translation, tint, aspect);
      } else if (
        row === Math.floor(rows / 2) &&
        column === Math.floor((columns - 1) / 2)
      ) {
        samples.green = sampleForCell("green", translation, tint, aspect);
      } else if (row === Math.floor(rows / 2) && column === columns - 2) {
        samples.blue = sampleForCell("blue", translation, tint, aspect);
      }
    }
  }

  return {
    meshKey: aperture.assetHandleKey(mesh),
    materialKey: aperture.assetHandleKey(material),
    samples: [samples.red, samples.green, samples.blue].filter(Boolean),
  };
}

function startWorkerSnapshotLoop(aperture, app, scene) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/instance-tint.worker.js",
    {
      name: "aperture-instance-tint-simulation",
      type: "module",
    },
  );
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

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? 1,
    clearColor,
    label: "instance-tint",
  });

  publishStatus(
    statusFromReport(aperture, report, scene, loop, message, typedSnapshot),
  );
  worker.terminate();
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

function translationForCell(column, row) {
  return [
    (column - (columns - 1) / 2) * spacing,
    ((rows - 1) / 2 - row) * spacing,
  ];
}

function tintForCell(column, row) {
  const hue = (column / Math.max(1, columns - 1)) * (2 / 3);
  const value = 0.86 + (1 - row / Math.max(1, rows - 1)) * 0.14;
  const rgb = hsvToRgb(hue, 0.92, value);

  return [rgb[0], rgb[1], rgb[2], 1];
}

function hsvToRgb(hue, saturation, value) {
  const scaled = hue * 6;
  const sector = Math.floor(scaled);
  const fraction = scaled - sector;
  const p = value * (1 - saturation);
  const q = value * (1 - fraction * saturation);
  const t = value * (1 - (1 - fraction) * saturation);

  switch (sector % 6) {
    case 0:
      return [value, t, p];
    case 1:
      return [q, value, p];
    case 2:
      return [p, value, t];
    case 3:
      return [p, q, value];
    case 4:
      return [t, p, value];
    default:
      return [value, p, q];
  }
}

function sampleForCell(id, translation, tint, aspect) {
  const viewWidth = orthographicHeight * aspect;

  return {
    id,
    x: 0.5 + translation[0] / viewWidth,
    y: 0.5 - translation[1] / orthographicHeight,
    expectedTint: toRgbaObject(tint),
  };
}

function statusFromReport(
  aperture,
  report,
  scene,
  loop,
  message,
  typedSnapshot,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);
  const snapshot = report.snapshot;
  const meshKeys = new Set(snapshot.meshDraws.map((draw) => draw.mesh.id));
  const materialKeys = new Set(
    snapshot.meshDraws.map((draw) => draw.material.id),
  );
  const pipelineKeys = [
    ...new Set(snapshot.meshDraws.map((draw) => draw.batchKey.pipelineKey)),
  ];

  return {
    example: "instance-tint",
    ok: report.ok,
    phase: report.ok ? "submit" : "failed",
    renderingBackend: "webgpu-explicit",
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    instanceCount,
    grid: { columns, rows },
    sharedHandles: {
      meshKey: scene.meshKey,
      materialKey: scene.materialKey,
      uniqueMeshCount: meshKeys.size,
      uniqueMaterialCount: materialKeys.size,
    },
    pipelineKeys,
    samples: scene.samples,
    clearColor: toRgbaObject(clearColor),
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    counts: reportJson.counts,
    report: reportJson,
    diagnostics: reportJson.diagnostics,
  };
}

function failure(reason, message) {
  return {
    example: "instance-tint",
    ok: false,
    phase: "failed",
    reason,
    message,
    clearColor: toRgbaObject(clearColor),
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

function toRgbaObject(color) {
  return {
    r: color[0] ?? 0,
    g: color[1] ?? 0,
    b: color[2] ?? 0,
    a: color[3] ?? 1,
  };
}
