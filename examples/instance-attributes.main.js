import {
  copyCurrentTextureReadbackSamples,
  createCurrentTextureColorTargetWithTexture,
  initializeWebGpuWithOptionalReadbackUsage,
  mapCurrentTextureReadbackSamples,
  markReadbackClearOk,
} from "./webgpu-readback.js";
import { inspectStructuredCloneSnapshot } from "./snapshot-transport-status.js";

const canvas = document.querySelector("#aperture-canvas");
const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");
const clearColor = { r: 0.012, g: 0.018, b: 0.03, a: 1 };
const materialFamily = "custom-wind";
const sampleHistory = [];

const baseStatus = {
  example: "instance-attributes",
  scenario: "custom-wind-sway",
  mode: "worker-snapshot-custom-wgsl-instance-attributes",
  canvas: {
    width: canvas?.width ?? 0,
    height: canvas?.height ?? 0,
  },
};

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
        apertureVersion: "0.0.0",
        renderingBackend: "webgpu-explicit",
      });
    } else {
      const scene = await createInstanceAttributeScene(aperture, initialized, {
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

async function createInstanceAttributeScene(aperture, initialized, canvasSize) {
  const workerSnapshot = await requestInstanceAttributeSnapshot(
    aperture,
    canvasSize,
  );

  if (!workerSnapshot.ok) {
    return sceneFailure({
      ...failure("worker", workerSnapshot.reason, workerSnapshot.message),
      ...(workerSnapshot.diagnostics === undefined
        ? {}
        : { diagnostics: workerSnapshot.diagnostics }),
    });
  }

  const { assets, mesh, materialHandle } =
    createInstanceAttributePresentationAssets(aperture);
  const extractedSnapshot = workerSnapshot.snapshot;
  const firstDraw = extractedSnapshot.meshDraws[0];
  const firstView = extractedSnapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return sceneFailure({
      ...failure(
        "extract",
        "empty-snapshot",
        "The instance-attributes scene did not extract a drawable view and mesh.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: extractedSnapshot.diagnostics,
    });
  }

  const customSource = createWindMaterialSource(aperture);
  const sourceDiagnostics = aperture.validateCustomMaterialSource(
    customSource,
    {
      assetKey: aperture.assetHandleKey(materialHandle),
      expectedFamily: materialFamily,
    },
  );

  if (sourceDiagnostics.length > 0) {
    return sceneFailure({
      ...failure(
        "validate-custom-material",
        "custom-material-source-invalid",
        "The custom wind material source failed package validation.",
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
        "The custom wind WGSL source could not be prepared.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: customPreparation.diagnostics,
    });
  }

  if (preparedMaterial.pipeline.instanceAttributes === null) {
    return sceneFailure({
      ...failure(
        "prepare-custom-material",
        "custom-material-instance-layout-missing",
        "The custom wind material did not prepare an instance attribute layout.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
    });
  }

  const uniform = createWindUniformResource({
    aperture,
    device: initialized.device,
    material: preparedMaterial,
    time: 0,
  });

  if (!uniform.ok) {
    return sceneFailure({
      ...failure("wind-uniform", uniform.reason, uniform.message),
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
        "The custom wind material WebGPU resources could not be created.",
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
  const packedInstanceAttributes =
    aperture.packSnapshotInstanceAttributesForVertexBuffer(
      snapshot,
      packedTransforms,
      preparedMaterial.pipeline.instanceAttributes,
      { materialKind: materialFamily },
    );
  const frameResources = createCustomWindFrameResources({
    aperture,
    device: initialized.device,
    mesh,
    pipeline: customResources.resources.pipeline.pipeline,
    packedViews,
    packedTransforms,
    packedInstanceAttributes,
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return sceneFailure({
      ...failure(
        "resources",
        "custom-frame-resources-unavailable",
        "The custom wind frame resources could not be uploaded.",
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
      draw.mesh.id === "instance-attributes-blade"
        ? frameResources.resources.mesh.resourceKey
        : null,
    resolveMaterialResourceKey: (draw) =>
      draw.material.id === "instance-attributes-wind-material"
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
    {
      instanceAttributeResources: [frameResources.resources.instanceAttributes],
    },
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
    instanceAttributeResources: [frameResources.resources.instanceAttributes],
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
        "The custom wind draw plan did not produce a drawable command stream.",
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
    worker: workerSnapshot.worker,
    transport: workerSnapshot.transport,
    samples: workerSnapshot.scene?.samples ?? [],
    counts: {
      extraction: {
        ...snapshotCounts(snapshot),
        instanceAttributePackets:
          snapshot.instanceAttributePackets?.length ?? 0,
        instanceAttributeFloats: snapshot.instanceAttributes?.length ?? 0,
      },
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
      instanceAttributes: {
        layoutKey: preparedMaterial.pipeline.instanceAttributes.layoutKey,
        attributes: preparedMaterial.pipeline.instanceAttributes.attributes.map(
          (attribute) => ({
            name: attribute.name,
            format: attribute.format,
            shaderLocation: attribute.shaderLocation,
            floatOffset: attribute.floatOffset,
          }),
        ),
        strideFloats: preparedMaterial.pipeline.instanceAttributes.strideFloats,
        packedFloats: packedInstanceAttributes.floatCount,
        offsets: packedInstanceAttributes.offsets.length,
        diagnostics: packedInstanceAttributes.diagnostics.length,
        vertexCount: frameResources.resources.instanceAttributes.vertexCount,
      },
    },
    sourceDiagnostics,
    diagnostics:
      customPreparation.diagnostics.length +
      customResources.diagnostics.length +
      frameResources.diagnostics.length,
    commandPlan,
  };
}

function requestInstanceAttributeSnapshot(aperture, canvasSize) {
  return new Promise((resolve) => {
    const worker = new Worker(
      "/worker-modules/examples/instance-attributes.worker.js",
      {
        name: "aperture-instance-attributes-simulation",
        type: "module",
      },
    );

    worker.addEventListener(
      "message",
      (event) => {
        const message = event.data;

        if (message?.type === "error") {
          worker.terminate();
          resolve({
            ok: false,
            reason: message.reason ?? "worker-error",
            message:
              message.message ?? "The instance-attributes worker failed.",
          });
          return;
        }

        if (message?.type !== "snapshot") {
          return;
        }

        worker.terminate();
        resolve({
          ok: true,
          snapshot: message.snapshot,
          scene: message.scene ?? null,
          worker: {
            running: false,
            scene: message.scene ?? null,
            frame: message.frame,
          },
          transport: {
            mode: "structured-clone-postMessage",
            jsonRoundTrip: false,
            snapshotsReceived: 1,
            typedArraysPreserved: inspectStructuredCloneSnapshot(
              message.snapshot,
            ),
          },
        });
      },
      { once: false },
    );
    worker.addEventListener(
      "error",
      (event) => {
        worker.terminate();
        resolve({
          ok: false,
          reason: "worker-error",
          message:
            event.message ||
            "The instance-attributes simulation worker reported an error.",
        });
      },
      { once: true },
    );
    worker.postMessage({
      type: "snapshot",
      frame: 1,
      canvas: canvasSize,
    });
  });
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
    const shaderTime = frame * 0.21;

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
      const submitted = await submitCustomWindFrame(
        aperture,
        initialized,
        scene.commandPlan,
        scene.canvasSize,
        scene.samples,
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
          "instance-attributes-animation-failed",
          error instanceof Error
            ? error.message
            : "Instance attributes animation failed.",
        ),
      );
    }
  };

  requestAnimationFrame(render);
}

async function submitCustomWindFrame(
  aperture,
  initialized,
  commandPlan,
  canvasSize,
  samples,
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
    label: "instance-attributes-wind",
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
        samples,
      })
    : readbackUsage;
  const finished = aperture.finishCommandEncoder({
    encoder: encoderResource.resource.encoder,
    label: "instance-attributes-wind",
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
  initialized,
  scene,
  submitted,
  frame,
  elapsedSeconds,
  deltaSeconds,
  shaderTime,
}) {
  if (submitted.readback.ok) {
    sampleHistory.push({
      frame,
      shaderTime,
      samples: submitted.readback.samples.map((sample) => ({
        id: sample.id,
        pixel: sample.pixel,
      })),
    });

    if (sampleHistory.length > 8) {
      sampleHistory.shift();
    }
  }

  publishStatus({
    ...baseStatus,
    ok: true,
    phase: "animate",
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: initialized.format,
    clearColor,
    customMaterial: {
      family: scene.preparedMaterial.materialFamily,
      sourceMaterialKey: scene.preparedMaterial.sourceMaterialKey,
      materialResourceKey: scene.preparedMaterial.materialKey,
      pipelineKey: scene.preparedMaterial.pipeline.pipelineKey,
      bindGroupResourceKey: scene.customResources.bindGroup.resourceKey,
      validationDiagnostics: scene.sourceDiagnostics.length,
      diagnostics: scene.diagnostics,
    },
    worker: scene.worker,
    transport: scene.transport,
    samples: scene.samples,
    animation: {
      frame,
      elapsedSeconds,
      deltaSeconds,
      shaderTime,
      sampleHistory: [...sampleHistory],
    },
    extraction: scene.counts.extraction,
    binding: scene.counts.binding,
    renderWorld: scene.counts.renderWorld,
    draw: scene.counts.draw,
    command: scene.counts.command,
    instanceAttributes: scene.counts.instanceAttributes,
    submission: submitted.summary,
    readback: submitted.readback,
  });
}

function createInstanceAttributePresentationAssets(aperture) {
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("instance-attributes-blade");
  const materialHandle = aperture.createMaterialHandle(
    "instance-attributes-wind-material",
  );
  const mesh = createBladeMesh();
  const material = aperture.createUnlitMaterialAsset({
    label: "InstanceAttributesExtractionPlaceholder",
    baseColorFactor: new Float32Array([0.2, 0.78, 0.95, 1]),
    renderState: { cullMode: "none" },
  });

  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  return { assets, mesh, materialHandle };
}

function createBladeMesh() {
  return {
    kind: "mesh",
    label: "InstanceAttributeBlade",
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
          -0.5, -0.5, 0, 0, 0, 1, 0, 1, 0.5, -0.5, 0, 0, 0, 1, 1, 1, 0.5, 0.5,
          0, 0, 0, 1, 1, 0, -0.5, 0.5, 0, 0, 0, 1, 0, 0,
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
    localAabb: { min: [-0.82, -0.5, -0.02], max: [0.82, 0.5, 0.02] },
    localSphere: { center: [0, 0, 0], radius: 0.96 },
  };
}

function createWindMaterialSource(aperture) {
  return {
    family: materialFamily,
    label: "Custom Wind Instance Attribute Material",
    renderState: aperture.createDefaultRenderState({
      cullMode: "none",
    }),
    shader: {
      code: `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct WindMaterialUniform {
  params: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(6) phase: f32,
  @location(7) swayAmount: f32,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) phase: f32,
  @location(2) swayAmount: f32,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> material: WindMaterialUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  let wind = sin(material.params.x * 2.4 + input.phase + input.position.y * 2.2);
  let local = vec3f(
    input.position.x + wind * input.swayAmount,
    input.position.y,
    input.position.z
  );
  output.position = view.viewProjection * world * vec4f(local, 1.0);
  output.uv = input.uv;
  output.phase = input.phase;
  output.swayAmount = input.swayAmount;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let pulse = 0.5 + 0.5 * sin(material.params.x * 3.1 + input.phase);
  let rim = smoothstep(0.05, 0.22, input.uv.x) *
    smoothstep(0.05, 0.22, input.uv.y) *
    smoothstep(0.05, 0.22, 1.0 - input.uv.x) *
    smoothstep(0.05, 0.22, 1.0 - input.uv.y);
  let cool = vec3f(0.04, 0.42 + input.swayAmount * 0.65, 0.95);
  let warm = vec3f(0.86, 0.96, 0.18 + input.swayAmount * 0.55);
  let color = mix(cool, warm, pulse);
  return vec4f(color * (0.42 + rim * 0.58), 1.0);
}
      `.trim(),
      vertexEntryPoint: "vs_main",
      fragmentEntryPoint: "fs_main",
    },
    instanceAttributes: aperture.defineInstanceAttributes([
      { name: "phase", format: "float32" },
      { name: "swayAmount", format: "float32" },
    ]),
    bindings: [
      {
        binding: 0,
        kind: "uniform-buffer",
        visibility: ["vertex", "fragment"],
        label: "windMaterialUniform",
      },
    ],
  };
}

function createWindUniformResource({ aperture, device, material, time }) {
  const binding = material.bindGroup.entries[0];

  if (binding === undefined) {
    return {
      ok: false,
      reason: "custom-material-binding-missing",
      message: "The custom wind material did not declare binding 0.",
    };
  }

  const bufferUsage = globalThis.GPUBufferUsage ?? {
    UNIFORM: 0x40,
    COPY_DST: 0x08,
  };
  const initialData = encodeWindUniform(time);
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
          message: "Custom wind animation requires queue.writeBuffer.",
        };
      }

      const data = encodeWindUniform(timeSeconds);

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

function encodeWindUniform(timeSeconds) {
  return new Float32Array([timeSeconds, 0, 0, 0]);
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
        instanced: true,
      };

      return { ...draw, sortKey, batchKey };
    }),
  };
}

function createCustomWindFrameResources({
  aperture,
  device,
  mesh,
  pipeline,
  packedViews,
  packedTransforms,
  packedInstanceAttributes,
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

  const instanceAttributeDescriptor =
    aperture.createInstanceAttributeBufferDescriptor(packedInstanceAttributes, {
      label: "InstanceAttributes/Wind/vertex",
    });

  diagnostics.push(...instanceAttributeDescriptor.diagnostics);

  const instanceAttributes = aperture.createInstanceAttributeGpuBuffer({
    device,
    plan: instanceAttributeDescriptor.plan,
  });

  diagnostics.push(...instanceAttributes.diagnostics);

  if (
    meshResource.resource === null ||
    viewUniform.resource === null ||
    worldTransforms.resource === null ||
    instanceAttributes.resource === null
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
      layoutKey: `instance-attributes/pipeline-layout-${group}`,
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
      instanceAttributes: instanceAttributes.resource,
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

async function waitForSubmittedWork(device) {
  if (typeof device.queue?.onSubmittedWorkDone === "function") {
    await device.queue.onSubmittedWorkDone();
  }
}
