import {
  copyCurrentTextureReadbackSamples,
  createCurrentTextureColorTargetWithTexture,
  initializeWebGpuWithOptionalReadbackUsage,
  mapCurrentTextureReadbackSamples,
  markReadbackClearOk,
} from "./webgpu-readback.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = { r: 0.01, g: 0.018, b: 0.028, a: 1 };
const waterBaseColor = [0.02, 0.46, 0.9, 1];
const recentSamples = [];
const brokenMode =
  new URLSearchParams(window.location.search).get("broken") === "wgsl";

const baseStatus = {
  example: "custom-material",
  scenario: "water-material",
  mode: brokenMode ? "broken-wgsl" : "animated-water",
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
    const initialization = await initializeWebGpuWithOptionalReadbackUsage({
      aperture,
      canvas,
    });
    const { initialized, readbackUsage } = initialization;

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
      const scene = await createCustomWaterScene(aperture, initialized, {
        width: canvas.width,
        height: canvas.height,
      });

      if (!scene.ok) {
        publishStatus(scene.status);
      } else {
        startAnimation(aperture, initialized, scene, readbackUsage);
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

async function createCustomWaterScene(aperture, initialized, canvasSize) {
  const { world, assets, mesh, materialHandle } = createWaterWorld(
    aperture,
    canvasSize,
  );
  const extractedSnapshot = aperture.extractRenderSnapshot(world, assets, {
    frame: 1,
  });
  const firstDraw = extractedSnapshot.meshDraws[0];
  const firstView = extractedSnapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return sceneFailure({
      ...failure(
        "extract",
        "empty-snapshot",
        "The custom material scene did not extract a drawable view and mesh.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: extractedSnapshot.diagnostics,
    });
  }

  const customSource = createWaterMaterialSource(aperture, {
    brokenWgsl: brokenMode,
  });
  const sourceDiagnostics = aperture.validateCustomMaterialSource(
    customSource,
    {
      assetKey: aperture.assetHandleKey(materialHandle),
      expectedFamily: "custom-water",
    },
  );

  if (sourceDiagnostics.length > 0) {
    return sceneFailure({
      ...failure(
        "validate-custom-material",
        "custom-material-source-invalid",
        "The WaterMaterial source failed package validation.",
      ),
      customMaterialValidation: {
        diagnostics: sourceDiagnostics.length,
        codes: sourceDiagnostics.map((diagnostic) => diagnostic.code),
      },
      diagnostics: sourceDiagnostics,
    });
  }

  assets.markReady(materialHandle, customSource);

  const customStore = new aperture.PreparedRenderAssetStore();
  const customPreparation = aperture.prepareRenderAsset({
    registry: assets,
    adapter: aperture.createCustomWgslMaterialRenderAssetAdapter(
      customSource.family,
    ),
    store: customStore,
    handle: materialHandle,
  });
  const preparedMaterial = customPreparation.entry?.prepared ?? null;

  if (customPreparation.outcome !== "prepared" || preparedMaterial === null) {
    return sceneFailure({
      ...failure(
        "prepare-custom-material",
        "custom-material-prepare-failed",
        "The WaterMaterial WGSL source could not be prepared.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: customPreparation.diagnostics,
    });
  }

  const uniform = createWaterUniformResource({
    aperture,
    device: initialized.device,
    material: preparedMaterial,
    time: 0,
  });

  if (!uniform.ok) {
    return sceneFailure({
      ...failure("water-uniform", uniform.reason, uniform.message),
      extraction: snapshotCounts(extractedSnapshot),
    });
  }

  const customResources =
    await aperture.createCustomWgslMaterialRenderResources({
      device: initialized.device,
      material: preparedMaterial,
      colorFormat: initialized.format,
      resources: [uniform.resource],
    });

  if (!customResources.valid || customResources.resources === null) {
    return sceneFailure({
      ...failure(
        "custom-resources",
        "custom-material-resources-unavailable",
        "The WaterMaterial WebGPU resources could not be created.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: customResources.diagnostics,
    });
  }

  const snapshot = rewriteSnapshotForCustomMaterial(
    aperture,
    extractedSnapshot,
    preparedMaterial,
  );
  const packedViews = aperture.packSnapshotViewUniforms(snapshot);
  const packedTransforms = aperture.packSnapshotTransforms(snapshot);
  const frameResources = createCustomWaterFrameResources({
    aperture,
    device: initialized.device,
    mesh,
    pipeline: customResources.resources.pipeline.pipeline,
    packedViews,
    packedTransforms,
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return sceneFailure({
      ...failure(
        "resources",
        "custom-frame-resources-unavailable",
        "The WaterMaterial frame resources could not be uploaded.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: frameResources.diagnostics,
    });
  }

  const renderWorld = new aperture.RenderWorld();
  const apply = renderWorld.applySnapshot(snapshot);
  const bindingPlan = aperture.planInjectedRenderFrameSnapshotResourceBindings({
    snapshot,
    resolveMeshResourceKey: (draw) =>
      draw.mesh.id === "custom-water-plane"
        ? frameResources.resources.mesh.resourceKey
        : null,
    resolveMaterialResourceKey: (draw) =>
      draw.material.id === "custom-water-material"
        ? preparedMaterial.materialKey
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
    key: preparedMaterial.pipeline.pipelineKey,
    pipeline: customResources.resources.pipeline.pipeline,
    diagnostics: [],
  };
  const bindGroups = [
    ...frameResources.resources.bindGroups,
    customResources.resources.bindGroup,
  ];
  const drawList = aperture.planRenderPassDrawList({
    drawCommands: drawCommands.descriptors,
    pipelines: [pipelineResult],
    bindGroups,
  });
  const resources = aperture.resolveRenderPassResources({
    drawList: drawList.draws,
    pipelines: [pipelineResult],
    bindGroups,
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
    return sceneFailure({
      ...failure(
        "draw-plan",
        "custom-draw-plan-unavailable",
        "The WaterMaterial draw plan did not produce a drawable command stream.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: [
        ...packages.diagnostics,
        ...drawCommands.diagnostics,
        ...drawList.diagnostics,
        ...resources.diagnostics,
        ...commandPlan.diagnostics,
      ],
    });
  }

  return {
    ok: true,
    snapshot,
    canvasSize,
    uniform,
    preparedMaterial,
    customResources: customResources.resources,
    counts: {
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
    },
    sourceDiagnostics,
    diagnostics:
      customPreparation.diagnostics.length + customResources.diagnostics.length,
    commandPlan,
  };
}

function startAnimation(aperture, initialized, scene, readbackUsage) {
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
    const shaderTime = frame * 0.18;

    previousTimestamp = timestamp;
    frame += 1;

    const uniformWrite = scene.uniform.write(shaderTime);

    if (!uniformWrite.ok) {
      publishStatus(
        failure("uniform-update", uniformWrite.reason, uniformWrite.message),
      );
      return;
    }

    try {
      const submitted = await submitCustomMaterialFrame(
        aperture,
        initialized,
        scene.commandPlan,
        scene.canvasSize,
        readbackUsage,
      );

      if (!submitted.ok) {
        publishStatus({
          ...failure("submit", submitted.reason, submitted.message),
          diagnostics: submitted.diagnostics,
        });
        return;
      }

      publishAnimatedStatus({
        aperture,
        initialized,
        scene,
        submitted,
        frame,
        elapsedSeconds,
        deltaSeconds,
        shaderTime,
      });
      requestAnimationFrame(render);
    } catch (error) {
      publishStatus(
        failure(
          "animate",
          "custom-material-animation-failed",
          error instanceof Error ? error.message : "Custom material failed.",
        ),
      );
    }
  };

  requestAnimationFrame(render);
}

async function submitCustomMaterialFrame(
  aperture,
  initialized,
  commandPlan,
  canvasSize,
  readbackUsage,
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
    label: "custom-water-material",
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
  const readbackPlan = readbackUsage.ok
    ? copyCurrentTextureReadbackSamples({
        device: initialized.device,
        encoder: encoderResource.resource.encoder,
        texture: colorTarget.texture,
        format: initialized.format,
        width: canvasSize.width,
        height: canvasSize.height,
        samples: [{ id: "center", x: 0.5, y: 0.5 }],
      })
    : readbackUsage;
  const finished = aperture.finishCommandEncoder({
    encoder: encoderResource.resource.encoder,
    label: "custom-water-material",
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
  const readback = readbackPlan.ok
    ? await mapCurrentTextureReadbackSamples(readbackPlan)
    : markReadbackClearOk(readbackPlan, true);

  return {
    ok: true,
    summary: {
      commandBuffers: submitted.submitted,
      commands: commandPlan.commands.length,
      drawCalls: execution.drawCalls,
      indexedDrawCalls: execution.indexedDrawCalls,
    },
    readback,
  };
}

function publishAnimatedStatus({
  aperture,
  initialized,
  scene,
  submitted,
  frame,
  elapsedSeconds,
  deltaSeconds,
  shaderTime,
}) {
  const centerSample = submitted.readback.ok
    ? submitted.readback.samples.find((sample) => sample.id === "center")
    : undefined;

  if (centerSample !== undefined) {
    recentSamples.push({
      frame,
      shaderTime,
      pixel: centerSample.pixel,
    });

    if (recentSamples.length > 6) {
      recentSamples.shift();
    }
  }

  publishStatus({
    ...baseStatus,
    ok: true,
    phase: "animate",
    apertureVersion: aperture.APERTURE_VERSION,
    renderingBackend: aperture.APERTURE_IDENTITY.renderingBackend,
    format: initialized.format,
    clearColor,
    customMaterial: {
      family: scene.preparedMaterial.materialFamily,
      sourceMaterialKey: scene.preparedMaterial.sourceMaterialKey,
      materialResourceKey: scene.preparedMaterial.materialKey,
      pipelineKey: scene.preparedMaterial.pipeline.pipelineKey,
      bindGroupResourceKey: scene.customResources.bindGroup.resourceKey,
      uniformColor: waterBaseColor,
      validationDiagnostics: scene.sourceDiagnostics.length,
      diagnostics: scene.diagnostics,
    },
    animation: {
      frame,
      elapsedSeconds,
      deltaSeconds,
      shaderTime,
      samples: [...recentSamples],
    },
    extraction: scene.counts.extraction,
    binding: scene.counts.binding,
    renderWorld: scene.counts.renderWorld,
    draw: scene.counts.draw,
    command: scene.counts.command,
    submission: submitted.summary,
    readback: submitted.readback,
  });
}

function createWaterWorld(aperture, canvasSize) {
  const world = aperture.createWorld({ entityCapacity: 8 });
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("custom-water-plane");
  const materialHandle = aperture.createMaterialHandle("custom-water-material");
  const mesh = createWaterPlaneMesh();
  const material = aperture.createUnlitMaterialAsset({
    label: "WaterMaterialExtractionPlaceholder",
    baseColorFactor: new Float32Array([0.02, 0.46, 0.9, 1]),
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
    translation: [0, 0, 2.45],
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

  const plane = world.createEntity();
  const planeTransform = aperture.createRootTransform();

  plane.addComponent(aperture.WorldTransform, planeTransform.world);
  plane.addComponent(aperture.Mesh, {
    meshId: aperture.assetHandleKey(meshHandle),
  });
  plane.addComponent(aperture.Material, {
    materialId: aperture.assetHandleKey(materialHandle),
  });
  plane.addComponent(aperture.RenderLayer, { mask: 1 });
  plane.addComponent(aperture.Visibility);

  return { world, assets, mesh, materialHandle };
}

function createWaterPlaneMesh() {
  return {
    kind: "mesh",
    label: "CustomWaterPlane",
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: 4,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: new Float32Array([
          -1.35, -0.75, 0, 0, 0, 1, 0, 1, 1.35, -0.75, 0, 0, 0, 1, 1, 1, 1.35,
          0.75, 0, 0, 0, 1, 1, 0, -1.35, 0.75, 0, 0, 0, 1, 0, 0,
        ]),
      },
    ],
    indexBuffer: {
      format: "uint16",
      data: new Uint16Array([0, 1, 2, 0, 2, 3]),
    },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: 4,
        indexStart: 0,
        indexCount: 6,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [-1.35, -0.75, 0], max: [1.35, 0.75, 0] },
    localSphere: { center: [0, 0, 0], radius: 1.55 },
  };
}

function createWaterMaterialSource(aperture, options = {}) {
  return {
    family: "custom-water",
    label: "Custom WaterMaterial",
    renderState: aperture.createDefaultRenderState({
      cullMode: "none",
    }),
    shader: {
      code: `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct WaterMaterialUniform {
  color: vec4f,
  params: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: WaterMaterialUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn ${options.brokenWgsl ? "broken_fs_main" : "fs_main"}(input: VertexOutput) -> @location(0) vec4f {
  let phase = material.params.x;
  let flow = material.params.yz;
  let scale = material.params.w;
  let waveA = sin((input.uv.x + phase * flow.x) * scale * 6.2831853);
  let waveB = cos((input.uv.y + phase * flow.y) * scale * 5.1);
  let ripple = sin((input.uv.x + input.uv.y) * scale * 3.7 + phase * 5.8);
  let height = waveA * 0.12 + waveB * 0.10 + ripple * 0.08;
  let foam = smoothstep(0.12, 0.24, height + 0.18);
  let deep = vec3f(0.0, 0.18, 0.34);
  let shallow = material.color.rgb;
  let water = mix(deep, shallow, clamp(0.52 + height, 0.0, 1.0));
  return vec4f(water + foam * vec3f(0.18, 0.28, 0.34), material.color.a);
}
      `.trim(),
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
    },
    bindings: [
      {
        binding: 0,
        kind: "uniform-buffer",
        visibility: ["fragment"],
        label: "waterMaterialUniform",
      },
    ],
  };
}

function createWaterUniformResource({ aperture, device, material, time }) {
  const binding = material.bindGroup.entries[0];

  if (binding === undefined) {
    return {
      ok: false,
      reason: "custom-material-binding-missing",
      message: "The WaterMaterial did not declare binding 0.",
    };
  }

  const bufferUsage = globalThis.GPUBufferUsage ?? {
    UNIFORM: 0x40,
    COPY_DST: 0x08,
  };
  const initialData = encodeWaterUniform(time);
  const buffer = aperture.createWebGpuBuffer({
    device,
    descriptor: {
      label: `${material.label}/uniform`,
      size: initialData.byteLength,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
      initialData,
    },
  });

  if (!buffer.ok) {
    return {
      ok: false,
      reason: buffer.reason,
      message: buffer.message,
    };
  }

  return {
    ok: true,
    resource: {
      resourceKey: binding.resourceKey,
      resource: { buffer: buffer.buffer },
    },
    write(timeSeconds) {
      if (typeof device.queue?.writeBuffer !== "function") {
        return {
          ok: false,
          reason: "queue-write-buffer-unavailable",
          message: "WaterMaterial animation requires queue.writeBuffer.",
        };
      }

      const data = encodeWaterUniform(timeSeconds);

      device.queue.writeBuffer(
        buffer.buffer,
        0,
        data.buffer,
        data.byteOffset,
        data.byteLength,
      );

      return { ok: true };
    },
  };
}

function encodeWaterUniform(timeSeconds) {
  return new Float32Array([
    waterBaseColor[0],
    waterBaseColor[1],
    waterBaseColor[2],
    waterBaseColor[3],
    timeSeconds,
    0.9,
    -0.55,
    1.9,
  ]);
}

function rewriteSnapshotForCustomMaterial(aperture, snapshot, material) {
  return {
    ...snapshot,
    meshDraws: snapshot.meshDraws.map((draw) => {
      if (
        aperture.assetHandleKey(draw.material) !== material.sourceMaterialKey
      ) {
        return draw;
      }

      const sortKey = {
        ...draw.sortKey,
        pipelineKey: material.pipeline.pipelineKey,
        materialKey: material.materialKey,
      };
      const batchKey = {
        ...draw.batchKey,
        pipelineKey: material.pipeline.pipelineKey,
        materialKey: material.materialKey,
      };

      return { ...draw, sortKey, batchKey };
    }),
  };
}

function createCustomWaterFrameResources({
  aperture,
  device,
  mesh,
  pipeline,
  packedViews,
  packedTransforms,
}) {
  const diagnostics = [];
  const meshUpload = aperture.createMeshGpuUploadPlan(mesh);

  diagnostics.push(...meshUpload.diagnostics);

  const meshDescriptors = aperture.createMeshUploadBufferDescriptors(
    meshUpload.plan,
  );

  diagnostics.push(...meshDescriptors.diagnostics);

  const meshResource = aperture.createMeshGpuBuffers({
    device,
    plan: meshDescriptors.plan,
  });

  diagnostics.push(...meshResource.diagnostics);

  const viewDescriptor =
    aperture.createViewUniformBufferDescriptor(packedViews);

  diagnostics.push(...viewDescriptor.diagnostics);

  const viewUniform = aperture.createViewUniformGpuBuffer({
    device,
    plan: viewDescriptor.plan,
  });

  diagnostics.push(...viewUniform.diagnostics);

  const transformDescriptor =
    aperture.createWorldTransformBufferDescriptor(packedTransforms);

  diagnostics.push(...transformDescriptor.diagnostics);

  const worldTransforms = aperture.createWorldTransformGpuBuffer({
    device,
    plan: transformDescriptor.plan,
  });

  diagnostics.push(...worldTransforms.diagnostics);

  if (
    meshResource.resource === null ||
    viewUniform.resource === null ||
    worldTransforms.resource === null
  ) {
    return { valid: false, resources: null, diagnostics };
  }

  const sharedPlan = {
    valid: true,
    diagnostics: [],
    entries: [
      {
        group: 0,
        binding: 0,
        resourceKey: viewUniform.resource.resourceKey,
        resourceKind: "buffer",
      },
      {
        group: 1,
        binding: 0,
        resourceKey: worldTransforms.resource.resourceKey,
        resourceKind: "buffer",
      },
    ],
  };
  const bindGroups = aperture.createUnlitBindGroupsFromGpuResources({
    device,
    plan: sharedPlan,
    layouts: [0, 1].map((group) => ({
      group,
      layoutKey: `custom-water/pipeline-layout-${group}`,
      layout: pipeline.getBindGroupLayout(group),
    })),
    buffers: [
      {
        resourceKey: viewUniform.resource.resourceKey,
        buffer: viewUniform.resource.buffer,
      },
      {
        resourceKey: worldTransforms.resource.resourceKey,
        buffer: worldTransforms.resource.buffer,
      },
    ],
    requiredGroups: [0, 1],
  });

  diagnostics.push(...bindGroups.diagnostics);

  if (!bindGroups.valid) {
    return { valid: false, resources: null, diagnostics };
  }

  return {
    valid: true,
    resources: {
      mesh: meshResource.resource,
      viewUniform: viewUniform.resource,
      worldTransforms: worldTransforms.resource,
      bindGroups: bindGroups.resources,
    },
    diagnostics,
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

function sceneFailure(status) {
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
    stateElement.textContent = status.ok ? "ready" : "failed";
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
