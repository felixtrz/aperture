import { createCurrentTextureColorTargetWithTexture } from "./webgpu-readback.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const depthFormat = "depth24plus";
const spinAxis = [0.35, 1, 0.2];
const spinRadiansPerSecond = 3;

const baseStatus = {
  example: "ecs-spinning-cube",
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
    const initialized = await aperture.initializeWebGpu({ canvas });

    if (!initialized.ok) {
      publishStatus({
        ...failure(
          "initialize-webgpu",
          initialized.reason,
          initialized.message,
        ),
        apertureVersion: aperture.APERTURE_VERSION,
        renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      });
    } else {
      const canvasSize = { width: canvas.width, height: canvas.height };
      const scene = createSpinningCubeWorld(aperture, canvasSize);
      const setup = await createSpinningCubeRenderSetup(
        aperture,
        initialized,
        scene,
      );

      if (!setup.ok) {
        publishStatus(setup.status);
      } else {
        startAnimation(aperture, initialized, scene, setup, canvasSize);
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

async function createSpinningCubeRenderSetup(aperture, initialized, scene) {
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame: 0,
  });
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return setupFailure({
      ...failure(
        "extract",
        "empty-snapshot",
        "The ECS spinning cube scene did not extract a drawable view and mesh.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: snapshot.diagnostics,
    });
  }

  const pipelineResource = await aperture.createUnlitRenderPipelineResource({
    device: initialized.device,
    colorFormat: initialized.format,
    depthFormat,
    batchKey: firstDraw.batchKey,
  });

  if (!pipelineResource.valid || pipelineResource.resource === null) {
    return setupFailure({
      ...failure(
        "pipeline",
        "pipeline-unavailable",
        "The textured unlit render pipeline could not be created.",
      ),
      diagnostics: pipelineResource.diagnostics,
      extraction: snapshotCounts(snapshot),
    });
  }

  const pipeline = pipelineResource.resource.pipeline;

  if (typeof pipeline.getBindGroupLayout !== "function") {
    return setupFailure(
      failure(
        "pipeline-layouts",
        "pipeline-layouts-unavailable",
        "The unlit pipeline does not expose bind group layouts.",
      ),
    );
  }

  const textureResources = createSpinningCubeTextureResources(
    aperture,
    initialized.device,
    scene,
  );

  if (!textureResources.valid) {
    return setupFailure({
      ...failure(
        "resources",
        "texture-resources-unavailable",
        "The spinning cube texture or sampler resources could not be uploaded.",
      ),
      diagnostics: textureResources.diagnostics,
      extraction: snapshotCounts(snapshot),
    });
  }

  const packedViews = aperture.packSnapshotViewUniforms(snapshot);
  const packedTransforms = aperture.packSnapshotTransforms(snapshot);
  const frameResources = aperture.createUnlitFrameGpuResources({
    device: initialized.device,
    mesh: scene.mesh,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    material: scene.material,
    layouts: [0, 1, 2].map((group) => ({
      group,
      layoutKey: `unlit/pipeline-layout-${group}`,
      layout: pipeline.getBindGroupLayout(group),
    })),
    textures: textureResources.textures,
    samplers: textureResources.samplers,
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return setupFailure({
      ...failure(
        "resources",
        "frame-resources-unavailable",
        "The spinning cube frame resources could not be uploaded.",
      ),
      diagnostics: frameResources.diagnostics,
      extraction: snapshotCounts(snapshot),
    });
  }

  const renderWorld = new aperture.RenderWorld();
  const pipelineResult = {
    ok: true,
    status: "miss",
    key: firstDraw.batchKey.pipelineKey,
    pipeline,
    diagnostics: [],
  };
  const framePlan = aperture.planRenderFrameFromSnapshot({
    snapshot,
    renderWorld,
    transforms: packedTransforms,
    resolveMeshResourceKey: (draw) =>
      aperture.assetHandleKey(draw.mesh) === scene.meshKey
        ? frameResources.resources.mesh.resourceKey
        : null,
    resolveMaterialResourceKey: (draw) =>
      aperture.assetHandleKey(draw.material) === scene.materialKey
        ? frameResources.resources.material.resourceKey
        : null,
    meshResources: [frameResources.resources.mesh],
    pipelines: [pipelineResult],
    bindGroups: frameResources.resources.bindGroups,
  });

  if (
    !framePlan.summary.ready ||
    framePlan.commandPlan.drawCount !== 1 ||
    framePlan.commandPlan.indexedDrawCount !== 1
  ) {
    return setupFailure({
      ...failure(
        "draw-plan",
        "draw-plan-unavailable",
        "The spinning cube draw plan did not produce one indexed draw.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: framePlan.summary.diagnostics,
    });
  }

  return {
    ok: true,
    snapshot,
    textureResources,
    packedTransforms,
    frameResources: frameResources.resources,
    framePlan,
  };
}

function startAnimation(aperture, initialized, scene, setup, canvasSize) {
  let firstTimestamp = null;
  let frame = 0;

  const renderNextFrame = async (timestamp) => {
    if (firstTimestamp === null) {
      firstTimestamp = timestamp;
    }

    frame += 1;

    const elapsedSeconds = (timestamp - firstTimestamp) / 1000;
    const rotationRadians = elapsedSeconds * spinRadiansPerSecond;
    const transformUpdate = updateCubeTransform(
      aperture,
      initialized.device,
      scene,
      setup.frameResources,
      rotationRadians,
      frame,
    );

    if (!transformUpdate.ok) {
      publishStatus(transformUpdate.status);
      return;
    }

    const submitted = await submitSpinningCubeFrame(
      aperture,
      initialized,
      setup.framePlan.commandPlan,
      canvasSize,
    );

    if (!submitted.ok) {
      publishStatus({
        ...failure("submit", submitted.reason, submitted.message),
        extraction: snapshotCounts(transformUpdate.snapshot),
        diagnostics: submitted.diagnostics,
      });
      return;
    }

    publishStatus({
      ...baseStatus,
      ok: true,
      phase: "animate",
      apertureVersion: aperture.APERTURE_VERSION,
      renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
      format: initialized.format,
      clearColor,
      depth: { format: depthFormat },
      extraction: snapshotCounts(transformUpdate.snapshot),
      resources: {
        materials: 1,
        textures: setup.textureResources.textures.length,
        samplers: setup.textureResources.samplers.length,
        bindGroups: setup.frameResources.bindGroups.length,
      },
      binding: {
        planned: setup.framePlan.bindingPlan.bindings.length,
        applied: setup.framePlan.bindingResults.filter((result) => result.ok)
          .length,
        diagnostics: setup.framePlan.bindingPlan.diagnostics.length,
      },
      renderWorld: {
        active: setup.framePlan.apply.active,
        ready: setup.framePlan.readiness.ready.length,
        blocked: setup.framePlan.readiness.blocked.length,
      },
      draw: {
        packages: setup.framePlan.packages.packages.length,
        descriptors: setup.framePlan.drawCommands.descriptors.length,
        drawList: setup.framePlan.drawList.draws.length,
        resolved: setup.framePlan.resources.draws.length,
      },
      command: {
        commands: setup.framePlan.commandPlan.commands.length,
        drawCount: setup.framePlan.commandPlan.drawCount,
        indexedDrawCount: setup.framePlan.commandPlan.indexedDrawCount,
      },
      submission: submitted.summary,
      animation: {
        frames: frame,
        elapsedSeconds: Number(elapsedSeconds.toFixed(4)),
        rotationRadians: Number(rotationRadians.toFixed(4)),
        radiansPerSecond: spinRadiansPerSecond,
        spinAxis,
        transformDiagnostics:
          transformUpdate.transformReport.diagnostics.length,
      },
      diagnosticCounts: {
        extraction: transformUpdate.snapshot.diagnostics.length,
        transform: transformUpdate.transformReport.diagnostics.length,
        submission: submitted.diagnosticCount,
      },
    });

    requestAnimationFrame((nextTimestamp) => {
      void renderNextFrame(nextTimestamp).catch((error) => {
        publishStatus(
          failure(
            "animate",
            "animation-frame-failed",
            error instanceof Error
              ? error.message
              : "The spinning cube animation frame failed.",
          ),
        );
      });
    });
  };

  requestAnimationFrame((timestamp) => {
    void renderNextFrame(timestamp).catch((error) => {
      publishStatus(
        failure(
          "animate",
          "animation-frame-failed",
          error instanceof Error
            ? error.message
            : "The spinning cube animation frame failed.",
        ),
      );
    });
  });
}

function updateCubeTransform(
  aperture,
  device,
  scene,
  frameResources,
  rotationRadians,
  frame,
) {
  const rotation = aperture.quatFromAxisAngle(spinAxis, rotationRadians);

  scene.cubeEntity
    .getVectorView(aperture.LocalTransform, "rotation")
    .set(rotation);

  const transformReport = aperture.resolveWorldTransforms(scene.world);
  const snapshot = aperture.extractRenderSnapshot(scene.world, scene.assets, {
    frame,
  });
  const packedTransforms = aperture.packSnapshotTransforms(snapshot);

  if (
    transformReport.diagnostics.length > 0 ||
    snapshot.diagnostics.length > 0 ||
    packedTransforms.diagnostics.length > 0
  ) {
    return {
      ok: false,
      status: {
        ...failure(
          "transform",
          "transform-update-failed",
          "The spinning cube transform update produced diagnostics.",
        ),
        extraction: snapshotCounts(snapshot),
        diagnostics: [
          ...transformReport.diagnostics,
          ...snapshot.diagnostics,
          ...packedTransforms.diagnostics,
        ],
      },
    };
  }

  device.queue.writeBuffer(
    frameResources.worldTransforms.buffer,
    0,
    packedTransforms.data,
  );

  return { ok: true, snapshot, packedTransforms, transformReport };
}

async function submitSpinningCubeFrame(
  aperture,
  initialized,
  commandPlan,
  canvasSize,
) {
  const colorTarget = createCurrentTextureColorTargetWithTexture({
    context: initialized.context,
    clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
  });

  if (!colorTarget.valid || colorTarget.target === null) {
    return stepFailure(
      "current-texture-unavailable",
      "The WebGPU context did not provide a current texture view.",
      colorTarget.diagnostics,
    );
  }

  const depthTarget = createDepthTarget(
    initialized.device,
    canvasSize,
    depthFormat,
  );
  const attachments = aperture.createRenderPassAttachmentPlan({
    colorTargets: [colorTarget.target],
    ...(depthTarget === null
      ? {}
      : { depthTarget: { view: depthTarget.view, depthClearValue: 1 } }),
  });

  if (!attachments.valid || attachments.plan === null) {
    return stepFailure(
      "attachments-unavailable",
      "The render pass attachments could not be planned.",
      attachments.diagnostics,
    );
  }

  const encoderResource = aperture.createCommandEncoderResource({
    device: initialized.device,
    label: "ecs-spinning-cube",
  });

  if (!encoderResource.valid || encoderResource.resource === null) {
    return stepFailure(
      "encoder-unavailable",
      "The WebGPU command encoder could not be created.",
      encoderResource.diagnostics,
    );
  }

  const begin = aperture.beginPlannedRenderPass({
    encoder: encoderResource.resource.encoder,
    plan: attachments.plan,
  });

  if (!begin.valid || begin.pass === null) {
    return stepFailure(
      "render-pass-unavailable",
      "The render pass could not begin.",
      begin.diagnostics,
    );
  }

  const execution = aperture.executeRenderPassCommands({
    pass: begin.pass,
    commands: commandPlan.commands,
  });
  const end = aperture.endPlannedRenderPass(begin.pass);
  const finished = aperture.finishCommandEncoder({
    encoder: encoderResource.resource.encoder,
    label: "ecs-spinning-cube",
  });

  if (!execution.valid || !end.valid || !finished.valid) {
    return stepFailure(
      "commands-unavailable",
      "The render pass commands could not be submitted.",
      [...execution.diagnostics, ...end.diagnostics, ...finished.diagnostics],
    );
  }

  const submitted = aperture.submitCommandBuffers({
    queue: initialized.device.queue,
    commandBuffers: [finished.resource],
  });

  if (!submitted.valid) {
    return stepFailure(
      "queue-submit-unavailable",
      "The command buffer could not be submitted.",
      submitted.diagnostics,
    );
  }

  await waitForSubmittedWork(initialized.device);

  return {
    ok: true,
    summary: {
      commandBuffers: submitted.submitted,
      commands: commandPlan.commands.length,
      drawCalls: execution.drawCalls,
      indexedDrawCalls: execution.indexedDrawCalls,
    },
    diagnosticCount:
      attachments.diagnostics.length +
      encoderResource.diagnostics.length +
      begin.diagnostics.length +
      execution.diagnostics.length +
      end.diagnostics.length +
      finished.diagnostics.length +
      submitted.diagnostics.length,
  };
}

function createSpinningCubeWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("spinning-cube");
  const materialHandle = aperture.createMaterialHandle("spinning-cube-unlit");
  const textureHandle = aperture.createTextureHandle("spinning-cube-checker");
  const samplerHandle = aperture.createSamplerHandle("spinning-cube-nearest");
  const textureKey = aperture.assetHandleKey(textureHandle);
  const samplerKey = aperture.assetHandleKey(samplerHandle);
  const mesh = aperture.createBoxMeshAsset({
    label: "SpinningCube",
    width: 1.45,
    height: 1.45,
    depth: 1.45,
  });
  const textureAsset = aperture.createTextureAsset({
    label: "Spinning Cube Checker",
    dimension: "2d",
    width: 4,
    height: 4,
    format: "rgba8unorm",
    colorSpace: "srgb",
    semantic: "base-color",
  });
  const samplerAsset = aperture.createSamplerAsset({
    label: "Spinning Cube Nearest",
    addressModeU: "repeat",
    addressModeV: "repeat",
    magFilter: "nearest",
    minFilter: "nearest",
    mipmapFilter: "nearest",
  });
  const material = aperture.createUnlitMaterialAsset({
    label: "SpinningCubeTexturedUnlit",
    baseColorFactor: new Float32Array([1, 1, 1, 1]),
    baseColorTexture: {
      texture: textureHandle,
      sampler: samplerHandle,
    },
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle, {
    dependencies: [textureHandle, samplerHandle],
  });
  assets.register(textureHandle);
  assets.register(samplerHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);
  assets.markReady(textureHandle, textureAsset);
  assets.markReady(samplerHandle, samplerAsset);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 3.1],
  });

  camera.addComponent(aperture.WorldTransform, cameraTransform.world);
  camera.addComponent(
    aperture.Camera,
    aperture.createCamera({
      aspect: canvasSize.width / canvasSize.height,
      near: 0.1,
      far: 100,
      clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
      layerMask: 1,
    }),
  );

  const cubeEntity = world.createEntity();
  const cubeTransform = aperture.createRootTransform();

  cubeEntity.addComponent(aperture.LocalTransform, cubeTransform.local);
  cubeEntity.addComponent(aperture.Parent, cubeTransform.parent);
  cubeEntity.addComponent(aperture.WorldTransform, cubeTransform.world);
  cubeEntity.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(meshHandle),
  });
  cubeEntity.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(materialHandle),
  });
  cubeEntity.addComponent(aperture.RenderLayer, { mask: 1 });
  cubeEntity.addComponent(aperture.Visibility);

  return {
    world,
    assets,
    mesh,
    material,
    textureAsset,
    samplerAsset,
    cubeEntity,
    meshKey: aperture.assetHandleKey(meshHandle),
    materialKey: aperture.assetHandleKey(materialHandle),
    textureKey,
    samplerKey,
  };
}

function createSpinningCubeTextureResources(aperture, device, scene) {
  const textureResult = aperture.createTextureGpuResource({
    device,
    resourceKey: scene.textureKey,
    descriptor: {
      label: "SpinningCubeChecker",
      size: [4, 4, 1],
      format: "rgba8unorm",
      usage:
        (globalThis.GPUTextureUsage?.TEXTURE_BINDING ?? 0x04) |
        (globalThis.GPUTextureUsage?.COPY_DST ?? 0x02),
    },
    upload: {
      data: createCheckerTextureBytes(),
      bytesPerRow: 16,
      rowsPerImage: 4,
    },
  });
  const samplerResult = aperture.createSamplerGpuResource({
    device,
    resourceKey: scene.samplerKey,
    sampler: scene.samplerAsset,
  });
  const diagnostics = [
    ...textureResult.diagnostics,
    ...samplerResult.diagnostics,
  ];

  return {
    valid:
      diagnostics.length === 0 &&
      textureResult.resource !== null &&
      samplerResult.resource !== null,
    textures: textureResult.resource === null ? [] : [textureResult.resource],
    samplers: samplerResult.resource === null ? [] : [samplerResult.resource],
    diagnostics,
  };
}

function createCheckerTextureBytes() {
  return new Uint8Array([
    244, 80, 64, 255, 244, 80, 64, 255, 40, 190, 120, 255, 40, 190, 120, 255,
    244, 80, 64, 255, 255, 228, 92, 255, 255, 228, 92, 255, 40, 190, 120, 255,
    72, 135, 255, 255, 255, 228, 92, 255, 255, 228, 92, 255, 245, 245, 245, 255,
    72, 135, 255, 255, 72, 135, 255, 255, 245, 245, 245, 255, 245, 245, 245,
    255,
  ]);
}

function createDepthTarget(device, canvasSize, format) {
  if (typeof device.createTexture !== "function") {
    return null;
  }

  const usage = globalThis.GPUTextureUsage?.RENDER_ATTACHMENT ?? 0x10;
  const texture = device.createTexture({
    size: [canvasSize.width, canvasSize.height, 1],
    format,
    usage,
  });

  return { texture, view: texture.createView() };
}

function snapshotCounts(snapshot) {
  return {
    frame: snapshot.frame,
    views: snapshot.views.length,
    meshDraws: snapshot.meshDraws.length,
    transforms: snapshot.transforms.length / 16,
    viewMatrices: snapshot.viewMatrices.length / 16,
    diagnostics: snapshot.diagnostics.length,
  };
}

function setupFailure(status) {
  return { ok: false, status };
}

function stepFailure(reason, message, diagnostics) {
  return { ok: false, reason, message, diagnostics };
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

async function waitForSubmittedWork(device) {
  if (typeof device.queue?.onSubmittedWorkDone === "function") {
    await device.queue.onSubmittedWorkDone();
  }
}
