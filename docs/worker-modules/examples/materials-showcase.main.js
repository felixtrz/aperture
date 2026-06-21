import {
  materialsShowcaseClearColor as clearColor,
  materialsShowcaseCubeSpecs as cubeSpecs,
  materialsShowcaseMaterialNames as materialNames,
  registerMaterialsShowcaseAssets,
} from "./materials-showcase-assets.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

try {
  const [core, webgpu] = await Promise.all([
    Promise.all([
      import("/aperture/worker-modules/packages/simulation/dist/index.js"),
      import("/aperture/worker-modules/packages/render/dist/index.js"),
      import("/aperture/worker-modules/packages/runtime/dist/index.js"),
    ]).then(([simulation, render, runtime]) => ({
      ...simulation,
      ...render,
      ...runtime,
    })),
    import("/aperture/worker-modules/packages/webgpu/dist/index.js"),
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
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createMainScene(
        aperture,
        created.app,
        sourceAssets,
        canvas,
      );

      startAnimation(aperture, created.app, scene);
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "showcase-failed",
      error instanceof Error ? error.message : "Material showcase failed.",
    ),
  );
}

function createMainScene(aperture, app, sourceAssets, targetCanvas) {
  const scene = registerMaterialsShowcaseAssets(aperture, sourceAssets);
  const environmentAssetInputs = createShowcaseEnvironmentAssetInputs(scene);
  const environmentAssets = aperture.prepareWebGpuAppEnvironmentAssets({
    app,
    assets: environmentAssetInputs,
    activeHandle: scene.environmentMap,
  });

  return {
    ...scene,
    canvas: targetCanvas,
    cubes: cubeSpecs,
    environmentAssetInputs,
    environmentAssets,
  };
}

function startAnimation(aperture, app, scene) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/materials-showcase.worker.js",
    {
      name: "aperture-materials-showcase-simulation",
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

  const activeEnvironmentKey =
    message.environment?.activeEnvironmentMapKey ??
    activeEnvironmentMapKeyFromSnapshot(aperture, message.snapshot) ??
    aperture.assetHandleKey(scene.environmentMap);
  const environmentAssets = aperture.prepareWebGpuAppEnvironmentAssets({
    app,
    assets: scene.environmentAssetInputs,
    activeEnvironmentMapResourceKey: activeEnvironmentKey,
  });
  const activeEnvironment =
    environmentAssets.active ?? environmentAssets.assets[0] ?? null;
  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "materials-showcase-app",
    ...(activeEnvironment === null
      ? {}
      : {
          standardMaterialIblResources:
            activeEnvironment.standardMaterialIblResources,
        }),
    readbackSamples: [
      {
        id: "standard-cube",
        x: Math.floor(scene.canvas.width / 2),
        y: Math.floor(scene.canvas.height / 2),
      },
    ],
  });

  publishFrameStatus(
    aperture,
    app,
    scene,
    environmentAssets,
    activeEnvironment,
    loop,
    message,
    report,
    typedSnapshot,
  );
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

function publishFrameStatus(
  aperture,
  app,
  scene,
  environmentAssets,
  activeEnvironment,
  loop,
  message,
  report,
  typedSnapshot,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  publishStatus({
    example: "materials-showcase",
    ok: report.ok,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    workerModel: "ecs-extraction-worker-postmessage-snapshot",
    materialModel: "app-facade-built-ins",
    materialModels: materialNames,
    frame: message.frame ?? 0,
    animation: {
      elapsedSeconds: message.animation?.elapsedSeconds ?? 0,
      spinningCubes: scene.cubes.length,
    },
    worker: {
      ready: loop.workerReady,
      receivedSnapshots: loop.receivedSnapshots,
      scene: loop.workerScene,
      step: message.workerStep ?? null,
    },
    transport: typedSnapshot,
    extraction: {
      views: report.snapshot.views.length,
      meshDraws: report.snapshot.meshDraws.length,
      lights: report.snapshot.lights.length,
      environments: report.snapshot.environments.length,
      diagnostics: report.snapshot.diagnostics.length,
    },
    environment: {
      authored: scene.environmentAssetInputs.length,
      extracted: report.snapshot.environments.length,
      activeKey: environmentAssets.activeEnvironmentMapResourceKey,
      activeVersion: activeEnvironment?.version ?? null,
      activeReady: activeEnvironment?.ready ?? false,
      workerActiveIndex: message.environment?.activeIndex ?? null,
      prepared:
        aperture.webGpuPreparedEnvironmentAssetSetToJsonValue(
          environmentAssets,
        ),
    },
    resources: {
      materials: scene.cubes.length,
      pipelineKeys: report.snapshot.meshDraws.map(
        (draw) => draw.batchKey.pipelineKey,
      ),
      standardTextureFeatures: [
        "baseColorTexture",
        "metallicRoughnessTexture",
        "occlusionTexture",
        "emissiveTexture",
        "iblDiffuse",
        "iblSpecularProof",
      ],
      bindGroups:
        report.resources?.resources === null ||
        report.resources?.resources === undefined
          ? 0
          : report.resources.resources.bindGroups.length,
      reuse: report.resourceReuse,
    },
    draw: {
      cubes: scene.cubes.length,
      indexedDrawCalls: report.boundary?.execution?.indexedDrawCalls ?? 0,
      indexCount: 36,
    },
    report: reportJson,
    canvas: {
      width: scene.canvas.width,
      height: scene.canvas.height,
    },
  });
}

function activeEnvironmentMapKeyFromSnapshot(aperture, snapshot) {
  const environment = snapshot.environments[0];

  return environment?.handle === undefined || environment.handle === null
    ? null
    : aperture.assetHandleKey(environment.handle);
}

function createShowcaseEnvironmentAssetInputs(scene) {
  return [
    {
      handle: scene.environmentMaps.warm,
      label: "materials-showcase-warm-studio",
      version: "warm-v1",
      diffuseResourceKey: "texture:materials-showcase-warm-studio:diffuse",
      specularResourceKey: "texture:materials-showcase-warm-studio:specular",
      diffuseSource: {
        faceSize: 4,
        faces: cubeFaces(4, [
          [238, 132, 74, 255],
          [224, 92, 72, 255],
          [255, 220, 142, 255],
          [96, 54, 42, 255],
          [238, 156, 110, 255],
          [168, 78, 64, 255],
        ]),
        format: "rgba8unorm",
      },
      specularPmremSource: {
        faceSize: 4,
        faces: cubeFaces(4, [
          [255, 164, 86, 255],
          [232, 96, 82, 255],
          [255, 232, 154, 255],
          [116, 62, 46, 255],
          [248, 176, 118, 255],
          [186, 90, 70, 255],
        ]),
        format: "rgba8unorm",
        mipLevelCount: 3,
      },
      standardMaterialCount: 1,
    },
    {
      handle: scene.environmentMaps.cool,
      label: "materials-showcase-cool-studio",
      version: "cool-v1",
      diffuseResourceKey: "texture:materials-showcase-cool-studio:diffuse",
      specularResourceKey: "texture:materials-showcase-cool-studio:specular",
      diffuseSource: {
        faceSize: 4,
        faces: cubeFaces(4, [
          [62, 152, 246, 255],
          [54, 96, 220, 255],
          [166, 236, 255, 255],
          [26, 52, 96, 255],
          [104, 204, 238, 255],
          [42, 72, 156, 255],
        ]),
        format: "rgba8unorm",
      },
      specularPmremSource: {
        faceSize: 4,
        faces: cubeFaces(4, [
          [74, 176, 255, 255],
          [64, 112, 238, 255],
          [182, 242, 255, 255],
          [34, 62, 112, 255],
          [116, 216, 248, 255],
          [50, 84, 172, 255],
        ]),
        format: "rgba8unorm",
        mipLevelCount: 3,
      },
      standardMaterialCount: 1,
    },
  ];
}

function cubeFaces(faceSize, colors) {
  return colors.map((color, face) => {
    const data = new Uint8Array(faceSize * faceSize * 4);

    for (let index = 0; index < data.length; index += 4) {
      const shade = 1 - face * 0.035;

      data[index] = Math.round(color[0] * shade);
      data[index + 1] = Math.round(color[1] * shade);
      data[index + 2] = Math.round(color[2] * shade);
      data[index + 3] = color[3];
    }

    return data;
  });
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

function failure(reason, message, extra = {}) {
  return {
    example: "materials-showcase",
    ok: false,
    phase: "initialize",
    reason,
    message,
    ...extra,
  };
}
