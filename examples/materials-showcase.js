const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const clearColor = [0.015, 0.02, 0.027, 1];
const materialNames = ["unlit", "standard-pbr-diffuse-ibl", "matcap"];
const spinAxis = [0.35, 1, 0.2];

try {
  const [core, webgpu] = await Promise.all([
    import("@aperture-engine/core"),
    import("@aperture-engine/webgpu"),
  ]);
  const aperture = { ...core, ...webgpu };

  if (canvas === null) {
    publishStatus(failure("canvas-unavailable", "Canvas missing."));
  } else {
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 16 },
    });

    if (!created.ok) {
      publishStatus(
        failure(created.reason, created.message, {
          renderingBackend: "webgpu-explicit",
        }),
      );
    } else {
      const scene = createScene(aperture, created.app, canvas);

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

function createScene(aperture, app, targetCanvas) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
  });
  const mesh = assets.meshes.add(
    aperture.createBoxMeshAsset({ label: "ShowcaseCube" }),
    { id: "showcase-cube" },
  );
  const unlit = assets.materials.unlit.add(
    aperture.createUnlitMaterialAsset({
      label: "ShowcaseUnlit",
      baseColorFactor: new Float32Array([1, 0.42, 0.18, 1]),
    }),
    { id: "showcase-unlit" },
  );
  const standardBaseColorTexture = aperture.createTextureHandle(
    "showcase-standard-base-color",
  );
  const standardBaseColorSampler = aperture.createSamplerHandle(
    "showcase-standard-base-color-linear",
  );
  const standardMetallicRoughnessTexture = aperture.createTextureHandle(
    "showcase-standard-metallic-roughness",
  );
  const standardMetallicRoughnessSampler = aperture.createSamplerHandle(
    "showcase-standard-metallic-roughness-linear",
  );
  const standardOcclusionTexture = aperture.createTextureHandle(
    "showcase-standard-occlusion",
  );
  const standardOcclusionSampler = aperture.createSamplerHandle(
    "showcase-standard-occlusion-linear",
  );
  const standardEmissiveTexture = aperture.createTextureHandle(
    "showcase-standard-emissive",
  );
  const standardEmissiveSampler = aperture.createSamplerHandle(
    "showcase-standard-emissive-linear",
  );

  app.assets.register(standardBaseColorTexture);
  app.assets.markReady(
    standardBaseColorTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardBaseColorTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "base-color",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          92, 255, 148, 255, 30, 204, 220, 255, 190, 255, 116, 255, 42, 124,
          255, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(standardBaseColorSampler);
  app.assets.markReady(
    standardBaseColorSampler,
    aperture.createSamplerAsset({ label: "ShowcaseStandardBaseColorSampler" }),
  );
  app.assets.register(standardMetallicRoughnessTexture);
  app.assets.markReady(
    standardMetallicRoughnessTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardMetallicRoughnessTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "metallic-roughness",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          0, 48, 230, 255, 0, 196, 72, 255, 0, 96, 180, 255, 0, 224, 96, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(standardMetallicRoughnessSampler);
  app.assets.markReady(
    standardMetallicRoughnessSampler,
    aperture.createSamplerAsset({
      label: "ShowcaseStandardMetallicRoughnessSampler",
    }),
  );
  app.assets.register(standardOcclusionTexture);
  app.assets.markReady(
    standardOcclusionTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardOcclusionTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "data",
      semantic: "occlusion",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 0, 0, 255, 128, 0, 0, 255, 192, 0, 0, 255, 96, 0, 0, 255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(standardOcclusionSampler);
  app.assets.markReady(
    standardOcclusionSampler,
    aperture.createSamplerAsset({
      label: "ShowcaseStandardOcclusionSampler",
    }),
  );
  app.assets.register(standardEmissiveTexture);
  app.assets.markReady(
    standardEmissiveTexture,
    aperture.createTextureAsset({
      label: "ShowcaseStandardEmissiveTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm-srgb",
      colorSpace: "srgb",
      semantic: "emissive",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          40, 255, 110, 255, 20, 160, 255, 255, 190, 255, 90, 255, 80, 120, 255,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(standardEmissiveSampler);
  app.assets.markReady(
    standardEmissiveSampler,
    aperture.createSamplerAsset({
      label: "ShowcaseStandardEmissiveSampler",
    }),
  );

  const standard = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "ShowcaseStandard",
      baseColorFactor: new Float32Array([0.85, 1, 0.9, 1]),
      baseColorTexture: {
        texture: standardBaseColorTexture,
        sampler: standardBaseColorSampler,
      },
      metallicRoughnessTexture: {
        texture: standardMetallicRoughnessTexture,
        sampler: standardMetallicRoughnessSampler,
      },
      occlusionTexture: {
        texture: standardOcclusionTexture,
        sampler: standardOcclusionSampler,
      },
      emissiveTexture: {
        texture: standardEmissiveTexture,
        sampler: standardEmissiveSampler,
      },
      metallicFactor: 0.18,
      roughnessFactor: 0.36,
      occlusionStrength: 0.72,
      emissiveFactor: [0.12, 0.2, 0.16],
    }),
    { id: "showcase-standard" },
  );
  const matcapTexture = aperture.createTextureHandle("showcase-matcap");
  const matcapSampler = aperture.createSamplerHandle("showcase-matcap-linear");

  app.assets.register(matcapTexture);
  app.assets.markReady(
    matcapTexture,
    aperture.createTextureAsset({
      label: "ShowcaseMatcapTexture",
      dimension: "2d",
      width: 2,
      height: 2,
      format: "rgba8unorm",
      colorSpace: "linear",
      semantic: "data",
      usage: ["sampled", "copy-dst"],
      sourceData: {
        bytes: new Uint8Array([
          255, 220, 245, 255, 190, 230, 255, 255, 96, 128, 184, 255, 32, 48, 72,
          255,
        ]),
        bytesPerRow: 8,
        rowsPerImage: 2,
      },
    }),
  );
  app.assets.register(matcapSampler);
  app.assets.markReady(
    matcapSampler,
    aperture.createSamplerAsset({ label: "ShowcaseMatcapSampler" }),
  );

  const matcap = assets.materials.matcap.add(
    aperture.createMatcapMaterialAsset({
      label: "ShowcaseMatcap",
      baseColorFactor: new Float32Array([1, 0.54, 0.95, 1]),
      matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
    }),
    { id: "showcase-matcap" },
  );
  const environmentMap = aperture.createEnvironmentMapHandle(
    "materials-showcase-studio",
  );

  app.assets.register(environmentMap, { label: "Materials showcase IBL" });
  app.assets.markReady(environmentMap, {
    label: "Materials showcase IBL",
    diffuseResourceKey: "materials-showcase-studio/diffuse",
  });

  app.registerSystem(aperture.SpinSystem);
  app.spawn(
    aperture.withTransform({ translation: [0, 0.16, 4.9] }),
    aperture.withCamera({
      aspect: targetCanvas.width / targetCanvas.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  const cubes = [
    spawnCube(aperture, app, mesh, unlit, [-1.45, 0, 0], 0.74),
    spawnCube(aperture, app, mesh, standard, [0, 0, 0], 0.92),
    spawnCube(aperture, app, mesh, matcap, [1.45, 0, 0], 0.82),
  ];

  app.spawn(
    aperture.withLight({
      kind: aperture.LightKind.Ambient,
      color: [0.5, 0.56, 0.68, 1],
      intensity: 0.42,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withTransform(),
    aperture.withLight({
      kind: aperture.LightKind.Directional,
      color: [1, 0.94, 0.82, 1],
      intensity: 2.8,
      layerMask: 1,
    }),
  );
  app.spawn(
    aperture.withEnvironmentMap(environmentMap, {
      color: [1, 1, 1, 1],
      intensity: 1,
      layerMask: 1,
    }),
  );

  const iblResources = createShowcaseDiffuseIblResources(aperture, app);

  return {
    canvas: targetCanvas,
    cubes,
    mesh,
    materials: { unlit, standard, matcap },
    standardBaseColorTexture,
    standardBaseColorSampler,
    standardMetallicRoughnessTexture,
    standardMetallicRoughnessSampler,
    standardOcclusionTexture,
    standardOcclusionSampler,
    standardEmissiveTexture,
    standardEmissiveSampler,
    matcapTexture,
    matcapSampler,
    environmentMap,
    iblResources,
  };
}

function spawnCube(aperture, app, mesh, material, translation, speed) {
  return app.spawn(
    aperture.withTransform({ translation }),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withSpin({
      radiansPerSecond: speed,
      axis: spinAxis,
    }),
  );
}

function startAnimation(aperture, app, scene) {
  let firstTimestamp = null;
  let previousTimestamp = null;
  let frame = 0;

  const render = async (timestamp) => {
    if (firstTimestamp === null) {
      firstTimestamp = timestamp;
      previousTimestamp = timestamp;
    }

    const elapsedSeconds = (timestamp - firstTimestamp) / 1000;
    const deltaSeconds =
      previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / 1000;

    previousTimestamp = timestamp;
    frame += 1;
    app.step(deltaSeconds, elapsedSeconds);

    const report = await app.render({
      frame,
      clearColor,
      label: "materials-showcase-app",
      standardMaterialIblResources: scene.iblResources,
    });

    publishFrameStatus(aperture, app, scene, report, frame, elapsedSeconds);
    requestAnimationFrame(render);
  };

  requestAnimationFrame(render);
}

function publishFrameStatus(
  aperture,
  app,
  scene,
  report,
  frame,
  elapsedSeconds,
) {
  const reportJson = aperture.webGpuAppRenderReportToJsonValue(report);

  publishStatus({
    example: "materials-showcase",
    ok: report.ok,
    phase: "animate",
    renderingBackend: "webgpu-explicit",
    materialModel: "app-facade-built-ins",
    materialModels: materialNames,
    frame,
    animation: {
      elapsedSeconds,
      spinningCubes: scene.cubes.length,
    },
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
