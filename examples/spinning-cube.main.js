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

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
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
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
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
  const environmentSource = await loadRgbeCubeEnvironment(environmentAsset);
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
    specularResourceKey: "spinning-cube-pisa-studio/specular-proof",
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
    "/worker-modules/examples/spinning-cube.worker.js",
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
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
    tonemap: {
      operator: app.tonemap,
      requested: requestedTonemap,
      pipelineKey: `tonemap:${app.tonemap}`,
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
        asset: scene.environmentSource.assetPath,
        label: scene.environmentSource.label,
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
    "texture:spinning-cube-pisa-studio:specular-proof:texture";
  const samplerResourceKey =
    "texture:spinning-cube-pisa-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let specularTexture = cache.specularTextures.get(specularResourceKey);
  let iblSampler = cache.samplers.get(samplerResourceKey);

  if (diffuseTexture === undefined) {
    diffuseTexture = createRealEnvironmentDiffuseCubeTexture(
      device,
      diffuseResourceKey,
      environmentSource,
    );
    cache.diffuseTextures.set(diffuseResourceKey, diffuseTexture);
  }

  if (specularTexture === undefined) {
    specularTexture = createRealEnvironmentSpecularCubeTexture(
      aperture,
      device,
      specularResourceKey,
      environmentSource,
    );
    cache.specularTextures.set(specularResourceKey, specularTexture);
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
    specularTextureResource: {
      ready: true,
      status: "available",
      textureSlotCount: 1,
      specularSlotCount: 1,
      createdTextureCount: 1,
      reusedTextureCount: 0,
      sections: {
        texturePreparation: true,
        specularTextureResource: true,
        gpuAllocation: true,
        proofUpload: !specularTexture.prefiltered,
        prefiltering: specularTexture.prefiltered,
        bindGroupResource: false,
        shaderSampling: true,
      },
      resources: [
        {
          valid: true,
          resource: specularTexture,
          diagnostics: [],
        },
      ],
      diagnostics: specularTexture.prefiltered
        ? []
        : [
            {
              code: "iblTextureResource.specularPrefilteringDeferred",
              severity: "warning",
              message:
                "Specular IBL texture resource fell back to a deterministic minimal mip chain; full PMREM/GGX prefiltering remains deferred.",
            },
          ],
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

function createRealEnvironmentSpecularCubeTexture(
  aperture,
  device,
  resourceKey,
  environmentSource,
) {
  const baseSize = environmentSource.faceSize;
  const mipLevelCount = 4;
  const usage = resolveTextureUsage(aperture);
  const bufferUsage = resolveBufferUsage();
  const pipeline = aperture.createPmremComputePipeline({
    device,
    storageFormat: "rgba8unorm",
    label: "spinning-cube-pisa-studio:pmrem",
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return createRealEnvironmentSpecularFallbackCubeTexture(
      device,
      resourceKey,
      usage,
      environmentSource,
    );
  }

  const source = device.createTexture({
    label: "spinning-cube-pisa-studio:specular-ibl-source",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: usage.TEXTURE_BINDING | usage.COPY_DST,
  });
  const texture = device.createTexture({
    label: "spinning-cube-pisa-studio:specular-ibl-pmrem-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage:
      usage.TEXTURE_BINDING | usage.STORAGE_BINDING | usage.RENDER_ATTACHMENT,
    mipLevelCount,
  });
  const faceUploads = environmentSource.faces.map((face) =>
    createPaddedFaceUpload(face.rgba, baseSize),
  );

  faceUploads.forEach((upload, face) => {
    device.queue.writeTexture(
      { texture: source, origin: [0, 0, face] },
      upload.data,
      { bytesPerRow: upload.bytesPerRow, rowsPerImage: baseSize },
      [baseSize, baseSize, 1],
    );
  });

  const sampler = device.createSampler({
    label: "spinning-cube-pisa-studio:pmrem-source-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
  });
  const sourceView = source.createView({
    label: "spinning-cube-pisa-studio:pmrem-source-view",
    dimension: "cube",
  });
  const encoder = device.createCommandEncoder({
    label: "spinning-cube-pisa-studio:pmrem-dispatch",
  });
  const pass = encoder.beginComputePass({
    label: "spinning-cube-pisa-studio:pmrem-mip-chain",
  });

  pass.setPipeline(pipeline.resource.pipeline);

  for (let mipLevel = 0; mipLevel < mipLevelCount; mipLevel += 1) {
    const mipSize = Math.max(1, baseSize >> mipLevel);
    const params = device.createBuffer({
      label: `spinning-cube-pisa-studio:pmrem-mip-${mipLevel}-params`,
      size: 16,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      params,
      0,
      new Uint32Array([mipSize, mipSize, 6, mipLevel]),
    );

    const bindGroup = device.createBindGroup({
      label: `spinning-cube-pisa-studio:pmrem-mip-${mipLevel}`,
      layout: pipeline.resource.bindGroupLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: sourceView },
        {
          binding: 2,
          resource: texture.createView({
            dimension: "2d-array",
            baseMipLevel: mipLevel,
            mipLevelCount: 1,
          }),
        },
        { binding: 3, resource: { buffer: params } },
      ],
    });
    const dispatch = aperture.createPmremComputeDispatchSize({
      width: mipSize,
      height: mipSize,
      layers: 6,
    });

    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatch.x, dispatch.y, dispatch.z);
  }

  pass.end();
  device.queue.submit([encoder.finish()]);

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "spinning-cube-pisa-studio:specular-ibl-pmrem-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "spinning-cube-pisa-studio:specular-ibl-pmrem-mip-chain",
      size: [baseSize, baseSize, 6],
      format: "rgba8unorm",
      usage:
        usage.TEXTURE_BINDING | usage.STORAGE_BINDING | usage.RENDER_ATTACHMENT,
      mipLevelCount,
    },
    viewDescriptor: { dimension: "cube" },
    prefiltered: true,
  };
}

function createRealEnvironmentSpecularFallbackCubeTexture(
  device,
  resourceKey,
  usage,
  environmentSource,
) {
  const baseSize = environmentSource.faceSize;
  const mipLevelCount = 4;
  const texture = device.createTexture({
    label: "spinning-cube-pisa-studio:specular-ibl-minimal-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: usage.TEXTURE_BINDING | usage.COPY_DST,
    mipLevelCount,
  });
  for (let mipLevel = 0; mipLevel < mipLevelCount; mipLevel += 1) {
    const mipSize = Math.max(1, baseSize >> mipLevel);

    environmentSource.faces.forEach((sourceFace, face) => {
      const upload = createFallbackMipUpload(
        sourceFace.rgba,
        environmentSource.faceAverages[face],
        baseSize,
        mipSize,
      );

      device.queue.writeTexture(
        { texture, mipLevel, origin: [0, 0, face] },
        upload.data,
        { bytesPerRow: upload.bytesPerRow, rowsPerImage: mipSize },
        [mipSize, mipSize, 1],
      );
    });
  }

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "spinning-cube-pisa-studio:specular-ibl-minimal-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "spinning-cube-pisa-studio:specular-ibl-minimal-mip-chain",
      size: [baseSize, baseSize, 6],
      format: "rgba8unorm",
      usage: usage.TEXTURE_BINDING | usage.COPY_DST,
      mipLevelCount,
    },
    viewDescriptor: { dimension: "cube" },
    prefiltered: false,
  };
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}

function resolveBufferUsage() {
  return globalThis.GPUBufferUsage ?? { UNIFORM: 0x40, COPY_DST: 0x08 };
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

async function loadRgbeCubeEnvironment(asset) {
  const response = await fetch(asset.url);

  if (!response.ok) {
    throw new Error(
      `Could not load ${asset.path}: ${response.status} ${response.statusText}`,
    );
  }

  return decodeRgbeCubeAtlas(await response.arrayBuffer(), asset);
}

function decodeRgbeCubeAtlas(arrayBuffer, asset) {
  const bytes = new Uint8Array(arrayBuffer);
  const header = decodeAsciiHeader(bytes);
  const match = /(?:^|\n)([-+]Y)\s+(\d+)\s+([-+]X)\s+(\d+)\n/.exec(header.text);

  if (match === null) {
    throw new Error(`Radiance HDR asset ${asset.path} has no size line.`);
  }

  const height = Number(match[2]);
  const width = Number(match[4]);
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

  const pixelBytes = bytes.subarray(header.endOffset);

  if (pixelBytes.length < width * height * 4) {
    throw new Error(
      `Radiance HDR asset ${asset.path} ended before pixel data.`,
    );
  }

  const faces = asset.faceOrder.map((name, faceIndex) => {
    const rgba = new Uint8Array(faceSize * faceSize * 4);

    for (let y = 0; y < faceSize; y += 1) {
      for (let x = 0; x < faceSize; x += 1) {
        const src = (y * width + faceIndex * faceSize + x) * 4;
        const dst = (y * faceSize + x) * 4;

        rgba.set(
          rgbeToDisplayRgba(
            pixelBytes[src],
            pixelBytes[src + 1],
            pixelBytes[src + 2],
            pixelBytes[src + 3],
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
    assetPath: asset.path,
    label: asset.label,
    width,
    height,
    faceSize,
    faceOrder: [...asset.faceOrder],
    faces,
    faceAverages,
  };
}

function decodeAsciiHeader(bytes) {
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0x0a && bytes[index + 1] === 0x2d) {
      const nextNewline = bytes.indexOf(0x0a, index + 1);

      if (nextNewline !== -1) {
        return {
          text: new TextDecoder("ascii").decode(
            bytes.subarray(0, nextNewline + 1),
          ),
          endOffset: nextNewline + 1,
        };
      }
    }
  }

  throw new Error("Radiance HDR header does not contain a resolution line.");
}

function rgbeToDisplayRgba(r, g, b, e) {
  if (e === 0) {
    return [0, 0, 0, 255];
  }

  const scale = Math.pow(2, e - 128) / 256;

  return [
    linearToDisplayByte((r + 0.5) * scale),
    linearToDisplayByte((g + 0.5) * scale),
    linearToDisplayByte((b + 0.5) * scale),
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

function createPaddedFaceUpload(rgba, size) {
  const bytesPerRow = alignTo(size * 4, 256);
  const data = new Uint8Array(bytesPerRow * size);

  for (let row = 0; row < size; row += 1) {
    data.set(
      rgba.subarray(row * size * 4, (row + 1) * size * 4),
      row * bytesPerRow,
    );
  }

  return { data, bytesPerRow };
}

function createFallbackMipUpload(sourceRgba, faceAverage, baseSize, mipSize) {
  const bytesPerRow = alignTo(mipSize * 4, 256);
  const data = new Uint8Array(bytesPerRow * mipSize);
  const sourceStep = baseSize / mipSize;

  for (let y = 0; y < mipSize; y += 1) {
    for (let x = 0; x < mipSize; x += 1) {
      const sourceX = Math.min(baseSize - 1, Math.floor(x * sourceStep));
      const sourceY = Math.min(baseSize - 1, Math.floor(y * sourceStep));
      const source = (sourceY * baseSize + sourceX) * 4;
      const target = y * bytesPerRow + x * 4;

      data[target] = Math.round((sourceRgba[source] + faceAverage[0]) * 0.5);
      data[target + 1] = Math.round(
        (sourceRgba[source + 1] + faceAverage[1]) * 0.5,
      );
      data[target + 2] = Math.round(
        (sourceRgba[source + 2] + faceAverage[2]) * 0.5,
      );
      data[target + 3] = 255;
    }
  }

  return { data, bytesPerRow };
}

function alignTo(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
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
