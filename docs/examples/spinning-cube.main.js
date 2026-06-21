import { configureApertureExampleControl } from "./example-control.js";
import { createNoopSimulationWorker } from "./noop-simulation-worker.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const spinAxis = [0.35, 1, 0.2];
const spinRadiansPerSecond = 3;
const searchParams = new URLSearchParams(window.location.search);
const requestedTonemap = searchParams.get("tonemap");
const tonemapReadbackSample = { id: "tonemap-probe", x: 0.54, y: 0.5 };
const environmentAsset = {
  path: "./assets/pisa-studio-rgbe-cube.hdr",
  url: new URL("./assets/pisa-studio-rgbe-cube.hdr", import.meta.url),
  label: "Pisa HDR studio cube atlas",
  faceOrder: ["px", "nx", "py", "ny", "pz", "nz"],
};

const baseStatus = {
  example: "ecs-spinning-cube",
  materialModel: "standard-direct-lit-diffuse-specular-ibl",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};
const frameControl = {
  paused: false,
  pendingSteps: 0,
  scheduled: false,
  active: null,
  waiters: [],
};

globalThis.__APERTURE_SPINNING_CUBE_STOP__ = disposeFrameControl;

configureApertureExampleControl({
  capabilities: {
    pause: true,
    resume: true,
    step: true,
    readback: requestedTonemap !== null,
  },
  pause() {
    frameControl.paused = true;
    return createFrameControlSnapshot("paused");
  },
  resume() {
    frameControl.paused = false;
    scheduleActiveWorkerFrame();
    return createFrameControlSnapshot("resumed");
  },
  async step(frames = 1) {
    const count = finitePositiveInteger(frames, 1);
    const active = frameControl.active;

    frameControl.paused = true;
    frameControl.pendingSteps += count;

    if (active === null) {
      return createFrameControlSnapshot("step-pending");
    }

    const targetFrame = active.loop.receivedSnapshots + count;
    const result = new Promise((resolve) => {
      frameControl.waiters.push({ targetFrame, resolve });
    });

    scheduleActiveWorkerFrame();
    return result;
  },
  getFrameState() {
    return createFrameControlSnapshot("frame-state");
  },
});

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
    const tonemap = aperture.resolveTonemapOperator(requestedTonemap);
    const readbackUsage = aperture.createReadbackCanvasTextureUsage();
    const enableTonemapReadback = requestedTonemap !== null && readbackUsage.ok;
    const sourceAssets = new aperture.AssetRegistry();
    const created = await aperture.createWebGpuApp({
      canvas,
      simulationWorker: createNoopSimulationWorker(),
      sourceAssets,
      tonemap,
      ...(enableTonemapReadback ? { textureUsage: readbackUsage.usage } : {}),
    });

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
    } else {
      let scene;

      try {
        scene = await createLitSpinningCubePresentationScene(
          aperture,
          created.app,
          sourceAssets,
        );
        startWorkerSnapshotLoop(
          aperture,
          created.app,
          scene,
          enableTonemapReadback,
          readbackUsage,
        );
      } catch (error) {
        publishStatus(environmentFailure(error));
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

async function createLitSpinningCubePresentationScene(
  aperture,
  app,
  sourceAssets,
) {
  const environmentSource = await loadRgbeCubeEnvironment(
    aperture,
    environmentAsset,
  );
  const assets = aperture.createRenderAssetCollections({
    registry: sourceAssets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({
      label: "SpinningCube",
      width: 1.45,
      height: 1.45,
      depth: 1.45,
    }),
    { id: "spinning-cube" },
  );
  const materialAsset = aperture.createStandardMaterialAsset({
    label: "SpinningCubeStandard",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.82,
    roughnessFactor: 0.18,
    emissiveFactor: [0.12, 0.06, 0.025],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "spinning-cube-standard",
  });
  const glossyMaterialAsset = aperture.createStandardMaterialAsset({
    label: "SpinningCubeGlossyProbe",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.92,
    roughnessFactor: 0,
    emissiveFactor: [0.04, 0.035, 0.03],
  });
  const roughMaterialAsset = aperture.createStandardMaterialAsset({
    label: "SpinningCubeRoughProbe",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.92,
    roughnessFactor: 1,
    emissiveFactor: [0.04, 0.035, 0.03],
  });
  assets.materials.standard.add(glossyMaterialAsset, {
    id: "spinning-cube-glossy-probe",
  });
  assets.materials.standard.add(roughMaterialAsset, {
    id: "spinning-cube-rough-probe",
  });
  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-pisa-studio",
  );

  sourceAssets.register(environmentMap, {
    label: "Spinning cube Pisa HDR studio IBL",
  });
  sourceAssets.markReady(environmentMap, {
    label: "Spinning cube Pisa HDR studio IBL",
    diffuseResourceKey: "spinning-cube-pisa-studio/diffuse",
    specularResourceKey: "spinning-cube-pisa-studio/specular-prefilter",
  });

  const iblResources = createSpinningCubeIblResources(
    aperture,
    app,
    environmentSource,
  );

  return {
    mesh,
    material,
    materialAsset,
    glossyMaterialAsset,
    roughMaterialAsset,
    environmentMap,
    environmentSource,
    iblResources,
    authoredLights: 3,
    authoredEnvironments: 1,
  };
}

function startWorkerSnapshotLoop(
  aperture,
  app,
  scene,
  enableTonemapReadback,
  readbackUsage,
) {
  const worker = new Worker(
    "/aperture/worker-modules/examples/spinning-cube.worker.js",
    {
      name: "aperture-spinning-cube-simulation",
      type: "module",
    },
  );
  const loop = {
    frame: 0,
    receivedSnapshots: 0,
    workerReady: false,
    workerScene: null,
  };

  frameControl.active = { app, worker, loop };
  worker.addEventListener("message", (event) => {
    void handleWorkerMessage(
      aperture,
      app,
      scene,
      worker,
      loop,
      event.data,
      enableTonemapReadback,
      readbackUsage,
    );
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
  enableTonemapReadback,
  readbackUsage,
) {
  if (message?.type === "ready") {
    loop.workerReady = true;
    loop.workerScene = message.scene ?? null;
    scheduleWorkerFrame(worker, loop);
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

  const report = await app.renderSnapshot(message.snapshot, {
    frame: message.frame,
    clearColor,
    label: "ecs-spinning-cube-lit",
    standardMaterialIblResources: scene.iblResources,
    ...(enableTonemapReadback
      ? { readbackSamples: [tonemapReadbackSample] }
      : {}),
  });
  const status = createFrameStatus(
    aperture,
    app,
    scene,
    report,
    loop,
    message,
    enableTonemapReadback,
    readbackUsage,
  );

  publishStatus(status);
  resolveFrameControlWaiters(loop);

  if (status.ok) {
    scheduleWorkerFrame(worker, loop);
  } else {
    worker.terminate();
  }
}

function scheduleWorkerFrame(worker, loop) {
  if (frameControl.scheduled) {
    return;
  }

  if (frameControl.paused && frameControl.pendingSteps <= 0) {
    return;
  }

  frameControl.scheduled = true;
  const scheduleFrame = () =>
    requestAnimationFrame((timestamp) => {
      frameControl.scheduled = false;

      if (!loop.workerReady) {
        return;
      }

      if (frameControl.paused) {
        if (frameControl.pendingSteps <= 0) {
          return;
        }

        frameControl.pendingSteps -= 1;
      }

      loop.frame += 1;
      worker.postMessage({
        type: "frame",
        frame: loop.frame,
        timestamp,
      });
    });

  if (frameControl.paused && frameControl.pendingSteps > 0) {
    setTimeout(scheduleFrame, 32);
  } else {
    scheduleFrame();
  }
}

function scheduleActiveWorkerFrame() {
  const active = frameControl.active;

  if (active !== null) {
    scheduleWorkerFrame(active.worker, active.loop);
  }
}

function disposeFrameControl() {
  frameControl.paused = true;
  frameControl.pendingSteps = 0;
  frameControl.scheduled = false;
  frameControl.active = null;

  for (const waiter of frameControl.waiters) {
    waiter.resolve(createFrameControlSnapshot("stopped"));
  }

  frameControl.waiters = [];

  return createFrameControlSnapshot("stopped");
}

function resolveFrameControlWaiters(loop) {
  if (frameControl.waiters.length === 0) {
    return;
  }

  const pending = [];

  for (const waiter of frameControl.waiters) {
    if (loop.receivedSnapshots >= waiter.targetFrame) {
      waiter.resolve(createFrameControlSnapshot("stepped"));
    } else {
      pending.push(waiter);
    }
  }

  frameControl.waiters = pending;
}

function createFrameControlSnapshot(phase) {
  const status = globalThis.__APERTURE_EXAMPLE_STATUS__ ?? null;

  return {
    ok: true,
    phase,
    paused: frameControl.paused,
    pendingSteps: frameControl.pendingSteps,
    scheduled: frameControl.scheduled,
    frame: status?.animation?.frames ?? null,
    snapshotsReceived: status?.worker?.snapshotsReceived ?? null,
    status,
  };
}

function createFrameStatus(
  aperture,
  app,
  scene,
  report,
  loop,
  message,
  enableTonemapReadback,
  readbackUsage,
) {
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const standardResources = firstFamilyResource(resources, "standard");
  const boundary = report.boundary;
  const transformDiagnostics = message.workerStep?.transformDiagnostics ?? 0;
  const diagnostics = report.diagnostics.map(diagnosticToJson);
  const reason = firstFailureReason(report, firstDraw, resources);

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason === null ? {} : reason),
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: app.initialization.format,
    tonemap: {
      operator: app.tonemap,
      requested: requestedTonemap,
      pipelineKey: `tonemap:${app.tonemap}`,
      outputColorSpace: app.outputColorSpace,
      outputPipelineKey: `output-color:${app.outputColorSpace}`,
    },
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
      metallicFactor: scene.materialAsset.metallicFactor,
      roughnessFactor: scene.materialAsset.roughnessFactor,
      roughnessProof: {
        glossy: scene.glossyMaterialAsset.roughnessFactor,
        rough: scene.roughMaterialAsset.roughnessFactor,
      },
    },
    lighting: {
      authored: scene.authoredLights,
      extracted: snapshot.lights.length,
      kinds: snapshot.lights.map((light) => light.kind),
      gpuLights: standardResources?.lightGpuBuffers?.lightBuffer.count ?? 0,
    },
    environment: {
      authored: scene.authoredEnvironments,
      extracted: snapshot.environments.length,
      handleKey: aperture.assetHandleKey(scene.environmentMap),
      source: {
        kind: scene.environmentSource.kind,
        loader: scene.environmentSource.loader,
        asset: scene.environmentSource.assetPath,
        label: scene.environmentSource.label,
        format: scene.environmentSource.sourceFormat,
        colorSpace: scene.environmentSource.sourceColorSpace,
        width: scene.environmentSource.width,
        height: scene.environmentSource.height,
        faceSize: scene.environmentSource.faceSize,
        faceCount: scene.environmentSource.faces.length,
        faceOrder: scene.environmentSource.faceOrder,
        faceAverages: scene.environmentSource.faceAverages,
      },
      specularPrefiltering:
        scene.iblResources.specularTextureResource.sections.prefiltering,
      diffuseResourceKey:
        scene.iblResources.diffuseTextureResource.resources[0]?.resource
          ?.resourceKey,
      specularResourceKey:
        scene.iblResources.specularTextureResource.resources[0]?.resource
          ?.resourceKey,
      specularDiagnosticCodes:
        scene.iblResources.specularTextureResource.diagnostics.map(
          (diagnostic) => diagnostic.code,
        ),
      samplerKey:
        scene.iblResources.samplerResource.resources[0]?.resource?.resourceKey,
    },
    pipeline: {
      key: firstDraw?.batchKey.pipelineKey ?? null,
      cacheKey: report.pipeline?.resource?.cacheKey ?? null,
    },
    ...(requestedTonemap === null
      ? {}
      : {
          readback:
            report.readback ??
            (enableTonemapReadback
              ? {
                  ok: false,
                  reason: "readback-unavailable",
                  message:
                    "The spinning cube frame did not produce a tonemap readback sample.",
                }
              : readbackUsage),
        }),
    resources: {
      materials: familyResourceCount(resources, "standard", 1),
      bindGroups: resources?.bindGroups.length ?? 0,
      lightBindGroup: standardResources?.lightBindGroup === undefined ? 0 : 1,
      diffuseIblTexture:
        standardResources?.standardMaterialIblBindGroup === undefined ? 0 : 1,
      specularIblTexture:
        scene.iblResources.specularTextureResource.resources[0]?.resource ===
        undefined
          ? 0
          : 1,
      reuse: report.resourceReuse,
    },
    renderWorld: {
      active: app.renderWorld.size,
    },
    worker: {
      running: loop.workerReady,
      snapshotsReceived: loop.receivedSnapshots,
      scene: loop.workerScene,
    },
    transport: {
      mode: "transferable-postMessage",
      typedArraysPreserved: inspectStructuredCloneSnapshot(snapshot),
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
    animation: {
      frames: message.animation?.frames ?? message.frame,
      elapsedSeconds: message.animation?.elapsedSeconds ?? 0,
      rotationRadians: message.animation?.rotationRadians ?? 0,
      radiansPerSecond: spinRadiansPerSecond,
      spinAxis,
      transformDiagnostics,
    },
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      transform: transformDiagnostics,
      render: report.diagnostics.length,
      total: transformDiagnostics + diagnostics.length,
    },
    diagnostics,
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

function firstFailureReason(report, firstDraw, resources) {
  if (report.ok) {
    return null;
  }

  if (firstDraw === undefined) {
    return {
      reason: "empty-snapshot",
      message: "The lit spinning cube scene did not extract a drawable mesh.",
    };
  }

  if (resources === null) {
    return {
      reason: "standard-resources-unavailable",
      message:
        "The lit spinning cube standard material resources were not ready.",
    };
  }

  return {
    reason: "render-unavailable",
    message: "The lit spinning cube frame could not be rendered.",
  };
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    lights: snapshot.lights.length,
    environments: snapshot.environments.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
  };
}

function createSpinningCubeIblResources(aperture, app, environmentSource) {
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const device = app.initialization.device;
  const diffuseResourceKey =
    "texture:spinning-cube-pisa-studio:diffuse:texture";
  const specularResourceKey =
    "texture:spinning-cube-pisa-studio:specular-prefilter:texture";
  const samplerResourceKey =
    "texture:spinning-cube-pisa-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let iblSampler = cache.samplers.get(samplerResourceKey);

  if (diffuseTexture === undefined) {
    diffuseTexture = createRealEnvironmentDiffuseCubeTexture(
      device,
      diffuseResourceKey,
      environmentSource,
    );
    cache.diffuseTextures.set(diffuseResourceKey, diffuseTexture);
  }

  const specularTextureResource =
    aperture.createSpecularIblTextureResourceReport({
      device,
      textures: createSpinningCubeIblTexturePreparation(aperture),
      cache: cache.specularTextures,
      pmremSources: [
        {
          resourceKey: specularResourceKey,
          label: "spinning-cube-pisa-studio",
          faceSize: environmentSource.faceSize,
          faces: environmentSource.faces.map((face) => face.rgba),
          format: "rgba8unorm",
          mipLevelCount: 4,
        },
      ],
    });

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
        resourceKey:
          "bind-group:standard/ibl/group-4/spinning-cube-pisa-studio",
        layoutKey: "standard/ibl/group-4",
        bindGroup: {
          label: "standard/ibl/group-4/spinning-cube-pisa-studio",
        },
        entryResourceKeys: [
          diffuseResourceKey,
          specularResourceKey,
          samplerResourceKey,
        ],
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
      resources: [
        {
          valid: true,
          resource: diffuseTexture,
          diagnostics: [],
        },
      ],
      diagnostics: [],
    },
    specularTextureResource,
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
      resources: [
        {
          valid: true,
          resource: iblSampler,
          diagnostics: [],
        },
      ],
      diagnostics: [],
    },
  };
}

function createSpinningCubeIblTexturePreparation(aperture) {
  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-pisa-studio",
  );
  const descriptors = aperture.createIblResourceDescriptorReport({
    snapshot: [
      {
        environmentId: 1,
        handle: environmentMap,
        color: [1, 1, 1, 1],
        intensity: 1,
        layerMask: 1,
      },
    ],
    descriptors: [
      {
        environmentMapResourceKey: "environment-map:spinning-cube-pisa-studio",
        diffuseResourceKey: "texture:spinning-cube-pisa-studio:diffuse",
        specularResourceKey:
          "texture:spinning-cube-pisa-studio:specular-prefilter",
      },
    ],
  });

  return aperture.createIblTexturePreparationReport({
    descriptors,
    preparation: "ready",
  });
}

function createRealEnvironmentDiffuseCubeTexture(
  device,
  resourceKey,
  environmentSource,
) {
  const texture = device.createTexture({
    label: "spinning-cube-pisa-studio:diffuse-ibl",
    size: [1, 1, 6],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount: 1,
  });
  environmentSource.faceAverages.forEach((color, face) => {
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
      label: "spinning-cube-pisa-studio:diffuse-ibl-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "spinning-cube-pisa-studio:diffuse-ibl",
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
    label: "spinning-cube-pisa-studio:diffuse-ibl-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    lodMinClamp: 0,
    lodMaxClamp: 3,
    maxAnisotropy: 1,
  };

  return {
    resourceKey,
    sampler: device.createSampler(descriptor),
    descriptor,
  };
}

async function loadRgbeCubeEnvironment(aperture, asset) {
  const loaded = await aperture.loadHdrFromUri(asset.url.href);

  if (!loaded.ok || loaded.image === null) {
    const firstDiagnostic = loaded.diagnostics[0];

    throw new Error(
      firstDiagnostic?.message ??
        `Could not load Radiance HDR environment ${asset.path}.`,
    );
  }

  return decodeRgbeCubeAtlas(loaded.image, asset);
}

function decodeRgbeCubeAtlas(image, asset) {
  const height = image.height;
  const width = image.width;
  const faceCount = asset.faceOrder.length;

  if (height <= 0 || width <= 0 || width % faceCount !== 0) {
    throw new Error(
      `Radiance HDR asset ${asset.path} must be a horizontal cube atlas.`,
    );
  }

  const faceSize = width / faceCount;

  if (faceSize !== height) {
    throw new Error(
      `Radiance HDR asset ${asset.path} must contain square cube faces.`,
    );
  }

  const faces = asset.faceOrder.map((name, faceIndex) => {
    const rgba = new Uint8Array(faceSize * faceSize * 4);

    for (let y = 0; y < faceSize; y += 1) {
      for (let x = 0; x < faceSize; x += 1) {
        const src = (y * width + faceIndex * faceSize + x) * 4;
        const dst = (y * faceSize + x) * 4;

        rgba.set(
          linearRgbToDisplayRgba(
            image.data[src],
            image.data[src + 1],
            image.data[src + 2],
          ),
          dst,
        );
      }
    }

    return {
      name,
      rgba,
    };
  });
  const faceAverages = faces.map((face) => averageRgba(face.rgba));

  return {
    kind: "radiance-rgbe-cube-atlas",
    loader: "loadHdrFromUri",
    assetPath: asset.path,
    label: asset.label,
    sourceFormat: image.format,
    sourceColorSpace: image.colorSpace,
    width,
    height,
    faceSize,
    faceOrder: [...asset.faceOrder],
    faces,
    faceAverages,
  };
}

function linearRgbToDisplayRgba(r, g, b) {
  return [
    linearToDisplayByte(r),
    linearToDisplayByte(g),
    linearToDisplayByte(b),
    255,
  ];
}

function linearToDisplayByte(value) {
  const mapped = 1 - Math.exp(-Math.max(0, value) * 1.15);
  return Math.max(0, Math.min(255, Math.round(mapped ** (1 / 2.2) * 255)));
}

function averageRgba(rgba) {
  let r = 0;
  let g = 0;
  let b = 0;
  const pixelCount = rgba.length / 4;

  for (let offset = 0; offset < rgba.length; offset += 4) {
    r += rgba[offset];
    g += rgba[offset + 1];
    b += rgba[offset + 2];
  }

  return [
    Math.round(r / pixelCount),
    Math.round(g / pixelCount),
    Math.round(b / pixelCount),
    255,
  ];
}

function diagnosticToJson(diagnostic) {
  if (diagnostic === null || typeof diagnostic !== "object") {
    return {
      code: "unknown",
      message: String(diagnostic),
    };
  }

  return {
    code: typeof diagnostic.code === "string" ? diagnostic.code : "unknown",
    message:
      typeof diagnostic.message === "string"
        ? diagnostic.message
        : JSON.stringify(diagnostic),
    ...(typeof diagnostic.severity === "string"
      ? { severity: diagnostic.severity }
      : {}),
  };
}

function environmentFailure(error) {
  return failure(
    "environment-load",
    "environment-asset-failed",
    error instanceof Error
      ? error.message
      : "The real HDR environment map asset could not be loaded.",
  );
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
}

function finitePositiveInteger(value, fallback) {
  const integer = Number.isFinite(value) ? Math.trunc(value) : fallback;

  return Math.max(1, integer);
}

function publishStatus(status) {
  window.__APERTURE_EXAMPLE_STATUS__ = status;

  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "animating" : "failed";
    stateElement.dataset.state = status.ok ? "ready" : "failed";
  }

  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
