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
    import("@aperture-engine/core"),
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
  const iblResources = createShowcaseDiffuseIblResources(aperture, app);

  return {
    ...scene,
    canvas: targetCanvas,
    cubes: cubeSpecs,
    iblResources,
  };
}

function startAnimation(aperture, app, scene) {
  const worker = new Worker(
    "/worker-modules/examples/materials-showcase.worker.js",
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

  const typedSnapshot = inspectStructuredCloneSnapshot(message.snapshot);
  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame ?? loop.frame,
    clearColor,
    label: "materials-showcase-app",
    standardMaterialIblResources: scene.iblResources,
  });

  publishFrameStatus(
    aperture,
    app,
    scene,
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
      authored: 1,
      extracted: report.snapshot.environments.length,
      handleKey: aperture.assetHandleKey(scene.environmentMap),
      resourceKey:
        scene.iblResources.diffuseTextureResource.resources[0]?.resource
          ?.resourceKey,
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

function createShowcaseDiffuseIblResources(aperture, app) {
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const device = app.initialization.device;
  const diffuseResourceKey =
    "texture:materials-showcase-studio:diffuse:texture";
  const samplerResourceKey =
    "texture:materials-showcase-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let iblSampler = cache.samplers.get(samplerResourceKey);

  if (diffuseTexture === undefined) {
    diffuseTexture = createFaceColoredDiffuseCubeTexture(
      device,
      diffuseResourceKey,
    );
    cache.diffuseTextures.set(diffuseResourceKey, diffuseTexture);
  }

  if (iblSampler === undefined) {
    iblSampler = createDiffuseIblSampler(device, samplerResourceKey);
    cache.samplers.set(samplerResourceKey, iblSampler);
  }

  return {
    bindGroupResource: {
      ready: true,
      status: "available",
      standardMaterialCount: 1,
      group: 4,
      createdBindGroupCount: 0,
      reusedBindGroupCount: 1,
      sections: {
        descriptorPlan: true,
        layoutResource: true,
        textureResources: true,
        samplerResource: true,
        bindGroupResource: true,
        shaderSampling: true,
      },
      resource: {
        group: 4,
        resourceKey: "bind-group:standard/ibl/group-4/materials-showcase",
        layoutKey: "standard/ibl/group-4",
        bindGroup: { label: "standard/ibl/group-4/materials-showcase" },
        entryResourceKeys: [diffuseResourceKey, samplerResourceKey],
      },
      diagnostics: [],
    },
    diffuseTextureResource: {
      ready: true,
      status: "available",
      textureSlotCount: 1,
      diffuseSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        diffuseTextureResource: true,
        gpuAllocation: true,
        specularPrefiltering: false,
        shaderSampling: true,
      },
      resources: [{ valid: true, resource: diffuseTexture, diagnostics: [] }],
      diagnostics: [],
    },
    samplerResource: {
      ready: true,
      status: "available",
      samplerDescriptorCount: 1,
      createdSamplerCount: 1,
      reusedSamplerCount: 0,
      sections: {
        samplerDescriptors: true,
        gpuAllocation: true,
        bindGroupLayout: true,
        shaderSampling: true,
      },
      resources: [{ valid: true, resource: iblSampler, diagnostics: [] }],
      diagnostics: [],
    },
  };
}

function createFaceColoredDiffuseCubeTexture(device, resourceKey) {
  const texture = device.createTexture({
    label: "materials-showcase-studio:diffuse-ibl",
    size: [1, 1, 6],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount: 1,
  });
  const faceColors = [
    [220, 108, 52, 255],
    [48, 136, 220, 255],
    [228, 220, 126, 255],
    [40, 92, 78, 255],
    [186, 86, 214, 255],
    [72, 80, 124, 255],
  ];

  faceColors.forEach((color, face) => {
    const data = new Uint8Array(256);

    data.set(color, 0);
    device.queue.writeTexture(
      { texture, origin: [0, 0, face] },
      data,
      { bytesPerRow: 256, rowsPerImage: 1 },
      [1, 1, 1],
    );
  });

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "materials-showcase-studio:diffuse-ibl-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "materials-showcase-studio:diffuse-ibl",
      size: [1, 1, 6],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      mipLevelCount: 1,
    },
    viewDescriptor: { dimension: "cube" },
  };
}

function createDiffuseIblSampler(device, resourceKey) {
  const descriptor = {
    label: "materials-showcase-studio:diffuse-ibl-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "nearest",
    lodMinClamp: 0,
    lodMaxClamp: 0,
    maxAnisotropy: 1,
  };

  return {
    resourceKey,
    sampler: device.createSampler(descriptor),
    descriptor,
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
