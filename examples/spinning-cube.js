const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = [0.015, 0.025, 0.035, 1];
const spinAxis = [0.35, 1, 0.2];
const spinRadiansPerSecond = 3;

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
    const created = await aperture.createWebGpuApp({
      canvas,
      worldOptions: { entityCapacity: 16 },
    });

    if (!created.ok) {
      publishStatus({
        ...failure("initialize-webgpu", created.reason, created.message),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
    } else {
      const scene = createLitSpinningCubeScene(aperture, created.app, {
        width: canvas.width,
        height: canvas.height,
      });

      startAnimation(aperture, created.app, scene);
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

function createLitSpinningCubeScene(aperture, app, canvasSize) {
  const assets = aperture.createRenderAssetCollections({
    registry: app.assets,
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
    emissiveFactor: [0.015, 0.01, 0.005],
  });
  const material = assets.materials.standard.add(materialAsset, {
    id: "spinning-cube-standard",
  });
  const glossyMaterialAsset = aperture.createStandardMaterialAsset({
    label: "SpinningCubeGlossyProbe",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.92,
    roughnessFactor: 0,
    emissiveFactor: [0, 0, 0],
  });
  const roughMaterialAsset = aperture.createStandardMaterialAsset({
    label: "SpinningCubeRoughProbe",
    baseColorFactor: new Float32Array([1, 0.55, 0.25, 1]),
    metallicFactor: 0.92,
    roughnessFactor: 1,
    emissiveFactor: [0, 0, 0],
  });
  const glossyMaterial = assets.materials.standard.add(glossyMaterialAsset, {
    id: "spinning-cube-glossy-probe",
  });
  const roughMaterial = assets.materials.standard.add(roughMaterialAsset, {
    id: "spinning-cube-rough-probe",
  });
  const environmentMap = aperture.createEnvironmentMapHandle(
    "spinning-cube-studio",
  );

  app.assets.register(environmentMap, { label: "Spinning cube studio IBL" });
  app.assets.markReady(environmentMap, {
    label: "Spinning cube studio IBL",
    diffuseResourceKey: "spinning-cube-studio/diffuse",
    specularResourceKey: "spinning-cube-studio/specular-proof",
  });

  app.registerSystem(aperture.SpinSystem);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 3.1] }),
    aperture.withCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor,
      layerMask: 1,
    }),
  );

  const cube = app.spawn(
    aperture.withTransform(),
    aperture.withMesh(mesh),
    aperture.withMaterial(material),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
    aperture.withSpin({
      radiansPerSecond: spinRadiansPerSecond,
      axis: spinAxis,
    }),
  );

  app.spawn(
    aperture.withTransform({
      translation: [-1.15, -0.95, 0],
      scale: [0.42, 0.42, 0.42],
    }),
    aperture.withMesh(mesh),
    aperture.withMaterial(glossyMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withTransform({
      translation: [1.15, -0.95, 0],
      scale: [0.42, 0.42, 0.42],
    }),
    aperture.withMesh(mesh),
    aperture.withMaterial(roughMaterial),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

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
    aperture.withLight({
      kind: aperture.LightKind.Environment,
      color: [1, 1, 1, 1],
      intensity: 1,
      layerMask: 1,
      environmentMap,
    }),
  );

  const iblResources = createSpinningCubeIblResources(aperture, app);

  return {
    cube,
    mesh,
    material,
    materialAsset,
    glossyMaterialAsset,
    roughMaterialAsset,
    environmentMap,
    iblResources,
    authoredLights: 3,
    authoredEnvironments: 1,
  };
}

function startAnimation(aperture, app, scene) {
  let firstTimestamp = null;
  let previousTimestamp = null;
  let frame = 0;

  const renderNextFrame = async (timestamp) => {
    if (firstTimestamp === null) {
      firstTimestamp = timestamp;
      previousTimestamp = timestamp;
    }

    frame += 1;

    const elapsedSeconds = (timestamp - firstTimestamp) / 1000;
    const deltaSeconds =
      previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / 1000;

    previousTimestamp = timestamp;

    const step = app.step(deltaSeconds, elapsedSeconds);
    const report = await app.render({
      frame,
      clearColor,
      label: "ecs-spinning-cube-lit",
      standardMaterialIblResources: scene.iblResources,
    });
    const status = createFrameStatus(
      aperture,
      app,
      scene,
      step,
      report,
      frame,
      elapsedSeconds,
    );

    publishStatus(status);

    if (!status.ok) {
      return;
    }

    requestAnimationFrame((nextTimestamp) => {
      void renderNextFrame(nextTimestamp).catch((error) => {
        publishStatus(animationFailure(error));
      });
    });
  };

  requestAnimationFrame((timestamp) => {
    void renderNextFrame(timestamp).catch((error) => {
      publishStatus(animationFailure(error));
    });
  });
}

function createFrameStatus(
  aperture,
  app,
  scene,
  step,
  report,
  frame,
  elapsedSeconds,
) {
  const snapshot = report.snapshot;
  const firstDraw = snapshot.meshDraws[0];
  const resources = report.resources?.resources ?? null;
  const standardResources = firstFamilyResource(resources, "standard");
  const boundary = report.boundary;
  const diagnostics = [
    ...step.transform.diagnostics,
    ...report.diagnostics,
  ].map(diagnosticToJson);
  const reason = firstFailureReason(report, firstDraw, resources);

  return {
    ...baseStatus,
    ok: report.ok,
    phase: report.ok ? "animate" : "render",
    ...(reason === null ? {} : reason),
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: app.initialization.format,
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
      frames: frame,
      elapsedSeconds: Number(elapsedSeconds.toFixed(4)),
      rotationRadians: Number(
        (elapsedSeconds * spinRadiansPerSecond).toFixed(4),
      ),
      radiansPerSecond: spinRadiansPerSecond,
      spinAxis,
      transformDiagnostics: step.transform.diagnostics.length,
    },
    diagnosticCounts: {
      extraction: snapshot.diagnostics.length,
      transform: step.transform.diagnostics.length,
      render: report.diagnostics.length,
      total: diagnostics.length,
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

function createSpinningCubeIblResources(aperture, app) {
  const cache = aperture.getOrCreateWebGpuAppEnvironmentResourceCache(app);
  const device = app.initialization.device;
  const diffuseResourceKey = "texture:spinning-cube-studio:diffuse:texture";
  const specularResourceKey =
    "texture:spinning-cube-studio:specular-proof:texture";
  const samplerResourceKey = "texture:spinning-cube-studio:diffuse:sampler";
  let diffuseTexture = cache.diffuseTextures.get(diffuseResourceKey);
  let specularTexture = cache.specularTextures.get(specularResourceKey);
  let iblSampler = cache.samplers.get(samplerResourceKey);

  if (diffuseTexture === undefined) {
    diffuseTexture = createFaceColoredDiffuseCubeTexture(
      device,
      diffuseResourceKey,
    );
    cache.diffuseTextures.set(diffuseResourceKey, diffuseTexture);
  }

  if (specularTexture === undefined) {
    specularTexture = createFaceColoredSpecularCubeTexture(
      aperture,
      device,
      specularResourceKey,
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
        resourceKey: "bind-group:standard/ibl/group-4/spinning-cube-studio",
        layoutKey: "standard/ibl/group-4",
        bindGroup: { label: "standard/ibl/group-4/spinning-cube-studio" },
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

function createFaceColoredSpecularCubeTexture(aperture, device, resourceKey) {
  const baseSize = 8;
  const mipLevelCount = 4;
  const usage = resolveTextureUsage(aperture);
  const bufferUsage = resolveBufferUsage();
  const pipeline = aperture.createPmremComputePipeline({
    device,
    storageFormat: "rgba8unorm",
    label: "spinning-cube-studio:pmrem",
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return createFaceColoredSpecularFallbackCubeTexture(
      device,
      resourceKey,
      usage,
    );
  }

  const source = device.createTexture({
    label: "spinning-cube-studio:specular-ibl-source",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: usage.TEXTURE_BINDING | usage.COPY_DST,
  });
  const texture = device.createTexture({
    label: "spinning-cube-studio:specular-ibl-pmrem-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage:
      usage.TEXTURE_BINDING | usage.STORAGE_BINDING | usage.RENDER_ATTACHMENT,
    mipLevelCount,
  });
  const faceColors = specularSourceFaceColors();

  faceColors.forEach((color, face) => {
    const data = new Uint8Array(256 * baseSize);

    for (let row = 0; row < baseSize; row += 1) {
      for (let column = 0; column < baseSize; column += 1) {
        data.set(color, row * 256 + column * 4);
      }
    }

    device.queue.writeTexture(
      { texture: source, origin: [0, 0, face] },
      data,
      { bytesPerRow: 256, rowsPerImage: baseSize },
      [baseSize, baseSize, 1],
    );
  });

  const sampler = device.createSampler({
    label: "spinning-cube-studio:pmrem-source-sampler",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
    addressModeW: "clamp-to-edge",
    magFilter: "nearest",
    minFilter: "nearest",
  });
  const sourceView = source.createView({
    label: "spinning-cube-studio:pmrem-source-view",
    dimension: "cube",
  });
  const encoder = device.createCommandEncoder({
    label: "spinning-cube-studio:pmrem-dispatch",
  });
  const pass = encoder.beginComputePass({
    label: "spinning-cube-studio:pmrem-mip-chain",
  });

  pass.setPipeline(pipeline.resource.pipeline);

  for (let mipLevel = 0; mipLevel < mipLevelCount; mipLevel += 1) {
    const mipSize = Math.max(1, baseSize >> mipLevel);
    const params = device.createBuffer({
      label: `spinning-cube-studio:pmrem-mip-${mipLevel}-params`,
      size: 16,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      params,
      0,
      new Uint32Array([mipSize, mipSize, 6, mipLevel]),
    );

    const bindGroup = device.createBindGroup({
      label: `spinning-cube-studio:pmrem-mip-${mipLevel}`,
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
      label: "spinning-cube-studio:specular-ibl-pmrem-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "spinning-cube-studio:specular-ibl-pmrem-mip-chain",
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

function createFaceColoredSpecularFallbackCubeTexture(
  device,
  resourceKey,
  usage,
) {
  const baseSize = 8;
  const mipLevelCount = 4;
  const texture = device.createTexture({
    label: "spinning-cube-studio:specular-ibl-minimal-mip-chain",
    size: [baseSize, baseSize, 6],
    format: "rgba8unorm",
    usage: usage.TEXTURE_BINDING | usage.COPY_DST,
    mipLevelCount,
  });
  const mipFaceColors = [
    specularSourceFaceColors(),
    [
      [218, 202, 176, 255],
      [92, 116, 148, 255],
      [218, 210, 170, 255],
      [50, 66, 74, 255],
      [214, 184, 220, 255],
      [64, 70, 92, 255],
    ],
    [
      [116, 112, 104, 255],
      [84, 92, 106, 255],
      [116, 114, 104, 255],
      [62, 70, 76, 255],
      [112, 102, 118, 255],
      [68, 72, 84, 255],
    ],
    [
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
      [42, 46, 52, 255],
    ],
  ];

  mipFaceColors.forEach((faceColors, mipLevel) => {
    const mipSize = Math.max(1, baseSize >> mipLevel);

    faceColors.forEach((color, face) => {
      const data = new Uint8Array(256 * mipSize);

      for (let row = 0; row < mipSize; row += 1) {
        for (let column = 0; column < mipSize; column += 1) {
          data.set(color, row * 256 + column * 4);
        }
      }

      device.queue.writeTexture(
        { texture, mipLevel, origin: [0, 0, face] },
        data,
        { bytesPerRow: 256, rowsPerImage: mipSize },
        [mipSize, mipSize, 1],
      );
    });
  });

  return {
    resourceKey,
    texture,
    view: texture.createView({
      label: "spinning-cube-studio:specular-ibl-minimal-mip-chain-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "spinning-cube-studio:specular-ibl-minimal-mip-chain",
      size: [baseSize, baseSize, 6],
      format: "rgba8unorm",
      usage: usage.TEXTURE_BINDING | usage.COPY_DST,
      mipLevelCount,
    },
    viewDescriptor: { dimension: "cube" },
    prefiltered: false,
  };
}

function specularSourceFaceColors() {
  return [
    [255, 245, 210, 255],
    [70, 105, 155, 255],
    [245, 240, 190, 255],
    [26, 42, 54, 255],
    [245, 210, 255, 255],
    [42, 48, 72, 255],
  ];
}

function resolveTextureUsage(aperture) {
  return globalThis.GPUTextureUsage ?? aperture.WEBGPU_TEXTURE_USAGE_FLAGS;
}

function resolveBufferUsage() {
  return globalThis.GPUBufferUsage ?? { UNIFORM: 0x40, COPY_DST: 0x08 };
}

function createFaceColoredDiffuseCubeTexture(device, resourceKey) {
  const texture = device.createTexture({
    label: "spinning-cube-studio:diffuse-ibl",
    size: [1, 1, 6],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    mipLevelCount: 1,
  });
  const faceColors = [
    [230, 104, 48, 255],
    [48, 132, 230, 255],
    [230, 220, 120, 255],
    [42, 94, 78, 255],
    [190, 88, 210, 255],
    [70, 78, 120, 255],
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
      label: "spinning-cube-studio:diffuse-ibl-view",
      dimension: "cube",
    }),
    descriptor: {
      label: "spinning-cube-studio:diffuse-ibl",
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
    label: "spinning-cube-studio:diffuse-ibl-sampler",
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

function animationFailure(error) {
  return failure(
    "animate",
    "animation-frame-failed",
    error instanceof Error
      ? error.message
      : "The lit spinning cube animation frame failed.",
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
