const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };

const baseStatus = {
  example: "ecs-triangle",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

try {
  const aperture = await import("/dist/index.js");

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
      publishStatus(
        await renderTriangleScene(aperture, initialized, {
          width: canvas.width,
          height: canvas.height,
        }),
      );
    }
  }
} catch (error) {
  publishStatus(
    failure(
      "dist-import",
      "dist-import-failed",
      error instanceof Error
        ? error.message
        : "The built Aperture package could not be imported from /dist.",
    ),
  );
}

async function renderTriangleScene(aperture, initialized, canvasSize) {
  const { world, assets, mesh, material } = createTriangleWorld(
    aperture,
    canvasSize,
  );
  const snapshot = aperture.extractRenderSnapshot(world, assets, { frame: 1 });
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return {
      ...failure(
        "extract",
        "empty-snapshot",
        "The ECS triangle scene did not extract a drawable view and mesh.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: snapshot.diagnostics,
    };
  }

  const pipelineResource = await aperture.createUnlitRenderPipelineResource({
    device: initialized.device,
    colorFormat: initialized.format,
    batchKey: firstDraw.batchKey,
  });

  if (!pipelineResource.valid || pipelineResource.resource === null) {
    return {
      ...failure(
        "pipeline",
        "pipeline-unavailable",
        "The unlit render pipeline could not be created.",
      ),
      diagnostics: pipelineResource.diagnostics,
      extraction: snapshotCounts(snapshot),
    };
  }

  const pipeline = pipelineResource.resource.pipeline;

  if (typeof pipeline.getBindGroupLayout !== "function") {
    return failure(
      "pipeline-layouts",
      "pipeline-layouts-unavailable",
      "The unlit pipeline does not expose bind group layouts.",
    );
  }

  const packedViews = aperture.packSnapshotViewUniforms(snapshot);
  const packedTransforms = aperture.packSnapshotTransforms(snapshot);
  const frameResources = aperture.createUnlitFrameGpuResources({
    device: initialized.device,
    mesh,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    material,
    layouts: [0, 1, 2].map((group) => ({
      group,
      layoutKey: `unlit/pipeline-layout-${group}`,
      layout: pipeline.getBindGroupLayout(group),
    })),
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return {
      ...failure(
        "resources",
        "frame-resources-unavailable",
        "The ECS triangle frame resources could not be uploaded.",
      ),
      diagnostics: frameResources.diagnostics,
      extraction: snapshotCounts(snapshot),
    };
  }

  const renderWorld = new aperture.RenderWorld();
  const apply = renderWorld.applySnapshot(snapshot);
  const bindingPlan = aperture.planInjectedRenderFrameSnapshotResourceBindings({
    snapshot,
    resolveMeshResourceKey: (draw) =>
      draw.mesh.id === "triangle"
        ? frameResources.resources.mesh.resourceKey
        : null,
    resolveMaterialResourceKey: (draw) =>
      draw.material.id === "triangle"
        ? frameResources.resources.material.resourceKey
        : null,
  });
  const bindingResults = bindingPlan.bindings.map((binding) =>
    renderWorld.updateResourceBindings(binding.renderId, binding.update),
  );
  const readiness = renderWorld.createDrawReadinessReport();
  const packages = aperture.planRenderWorldDrawPackages(
    readiness,
    packedTransforms,
  );
  const drawCommands = aperture.createDrawCommandDescriptors(
    packages.packages,
    [frameResources.resources.mesh],
  );
  const pipelineResult = {
    ok: true,
    status: "miss",
    key: firstDraw.batchKey.pipelineKey,
    pipeline,
    diagnostics: [],
  };
  const drawList = aperture.planRenderPassDrawList({
    drawCommands: drawCommands.descriptors,
    pipelines: [pipelineResult],
    bindGroups: frameResources.resources.bindGroups,
  });
  const resources = aperture.resolveRenderPassResources({
    drawList: drawList.draws,
    pipelines: [pipelineResult],
    bindGroups: frameResources.resources.bindGroups,
    meshResources: [frameResources.resources.mesh],
  });
  const commandPlan = aperture.planRenderPassCommands({
    draws: resources.draws,
  });

  if (
    !drawList.valid ||
    !resources.valid ||
    !commandPlan.valid ||
    commandPlan.drawCount === 0
  ) {
    return {
      ...failure(
        "draw-plan",
        "draw-plan-unavailable",
        "The ECS triangle draw plan did not produce a drawable command stream.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: [
        ...packages.diagnostics,
        ...drawCommands.diagnostics,
        ...drawList.diagnostics,
        ...resources.diagnostics,
        ...commandPlan.diagnostics,
      ],
    };
  }

  const submitted = submitTriangleFrame(aperture, initialized, commandPlan);

  if (!submitted.ok) {
    return {
      ...failure("submit", submitted.reason, submitted.message),
      extraction: snapshotCounts(snapshot),
      diagnostics: submitted.diagnostics,
    };
  }

  return {
    ...baseStatus,
    ok: true,
    phase: "submit",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: initialized.format,
    clearColor,
    extraction: snapshotCounts(snapshot),
    binding: {
      planned: bindingPlan.bindings.length,
      applied: bindingResults.filter((result) => result.ok).length,
      diagnostics: bindingPlan.diagnostics.length,
    },
    renderWorld: {
      active: apply.active,
      ready: readiness.ready.length,
      blocked: readiness.blocked.length,
    },
    draw: {
      packages: packages.packages.length,
      descriptors: drawCommands.descriptors.length,
      drawList: drawList.draws.length,
      resolved: resources.draws.length,
    },
    command: {
      commands: commandPlan.commands.length,
      drawCount: commandPlan.drawCount,
      indexedDrawCount: commandPlan.indexedDrawCount,
      nonIndexedDrawCount: commandPlan.nonIndexedDrawCount,
    },
    submission: submitted.summary,
  };
}

function submitTriangleFrame(aperture, initialized, commandPlan) {
  const colorTarget = aperture.createCurrentTextureColorTarget({
    context: initialized.context,
    clearColor: [clearColor.r, clearColor.g, clearColor.b, clearColor.a],
    loadOp: "clear",
    storeOp: "store",
  });

  if (!colorTarget.valid || colorTarget.target === null) {
    return stepFailure(
      "current-texture-unavailable",
      "The WebGPU context did not provide a current texture view.",
      colorTarget.diagnostics,
    );
  }

  const attachments = aperture.createRenderPassAttachmentPlan({
    colorTargets: [colorTarget.target],
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
    label: "ecs-triangle",
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
    label: "ecs-triangle",
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

  return {
    ok: true,
    summary: {
      commandBuffers: submitted.submitted,
      commands: commandPlan.commands.length,
      drawCalls: execution.drawCalls,
      indexedDrawCalls: execution.indexedDrawCalls,
    },
  };
}

function createTriangleWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("triangle");
  const materialHandle = aperture.createMaterialHandle("triangle");
  const mesh = createTriangleMesh(aperture, materialHandle);
  const material = aperture.createUnlitMaterialAsset({
    label: "TriangleMaterial",
    baseColorFactor: new Float32Array([1, 0.18, 0.09, 1]),
  });

  aperture.registerTransformComponents(world);
  aperture.registerMetadataComponents(world);
  aperture.registerRenderAuthoringComponents(world);
  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  const camera = world.createEntity();
  const cameraTransform = aperture.createRootTransform({
    translation: [0, 0, 2.5],
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

  const triangle = world.createEntity();
  const triangleTransform = aperture.createRootTransform();

  triangle.addComponent(aperture.WorldTransform, triangleTransform.world);
  triangle.addComponent(aperture.MeshRenderer, {
    meshId: aperture.assetHandleKey(meshHandle),
    material0Id: aperture.assetHandleKey(materialHandle),
  });
  triangle.addComponent(aperture.RenderLayer, { mask: 1 });
  triangle.addComponent(aperture.Visibility);

  return { world, assets, mesh, material };
}

function createTriangleMesh(aperture, materialHandle) {
  return {
    kind: "mesh",
    label: "Triangle",
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: 3,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: new Float32Array([
          0, 0.72, 0, 0, 0, 1, 0.5, 0, -0.72, -0.55, 0, 0, 0, 1, 0, 1, 0.72,
          -0.55, 0, 0, 0, 1, 1, 1,
        ]),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2]),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 3,
        indexStart: 0,
        indexCount: 3,
      },
    ],
    materialSlots: [{ index: 0, label: "default", material: materialHandle }],
    localAabb: { min: [-0.72, -0.55, 0], max: [0.72, 0.72, 0] },
    localSphere: { center: [0, 0, 0], radius: 0.9 },
  };
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

function stepFailure(reason, message, diagnostics) {
  return { ok: false, reason, message, diagnostics };
}

function failure(phase, reason, message) {
  return { ...baseStatus, ok: false, phase, reason, message };
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
