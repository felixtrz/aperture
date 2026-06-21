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
const clearColor = { r: 0.015, g: 0.025, b: 0.035, a: 1 };
const scenario =
  new URLSearchParams(window.location.search).get("material") === "custom-wgsl"
    ? "custom-wgsl"
    : "unlit";
const customMaterialUniformColor = [0.02, 0.74, 0.95, 1];

const baseStatus = {
  example: scenario === "custom-wgsl" ? "custom-wgsl-material" : "ecs-triangle",
  scenario,
  availableScenarios: ["unlit", "custom-wgsl"],
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
      publishStatus(
        await renderTriangleScene(
          aperture,
          initialized,
          {
            width: canvas.width,
            height: canvas.height,
          },
          readbackUsage,
        ),
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
        : "The built Aperture workspace packages could not be imported.",
    ),
  );
}

async function renderTriangleScene(
  aperture,
  initialized,
  canvasSize,
  readbackUsage,
) {
  const workerSnapshot = await requestTriangleSnapshot(aperture, canvasSize);

  if (!workerSnapshot.ok) {
    return {
      ...failure("worker", workerSnapshot.reason, workerSnapshot.message),
      ...(workerSnapshot.diagnostics === undefined
        ? {}
        : { diagnostics: workerSnapshot.diagnostics }),
    };
  }

  if (scenario === "custom-wgsl") {
    return renderCustomWgslTriangleScene(
      aperture,
      initialized,
      canvasSize,
      readbackUsage,
      workerSnapshot,
    );
  }

  const { mesh, material } = createTrianglePresentationAssets(aperture);
  const snapshot = workerSnapshot.snapshot;
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

  const submitted = await submitTriangleFrame(
    aperture,
    initialized,
    commandPlan,
    canvasSize,
    readbackUsage,
  );

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
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: initialized.format,
    clearColor,
    worker: workerSnapshot.worker,
    transport: workerSnapshot.transport,
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
    readback: submitted.readback,
  };
}

function requestTriangleSnapshot(aperture, canvasSize) {
  return new Promise((resolve) => {
    const worker = new Worker("/aperture/worker-modules/examples/triangle.worker.js", {
      name: "aperture-triangle-simulation",
      type: "module",
    });

    worker.addEventListener(
      "message",
      (event) => {
        const message = event.data;

        if (message?.type === "error") {
          worker.terminate();
          resolve({
            ok: false,
            reason: message.reason ?? "worker-error",
            message: message.message ?? "The triangle worker failed.",
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
            "The triangle simulation worker reported an error.",
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

async function renderCustomWgslTriangleScene(
  aperture,
  initialized,
  canvasSize,
  readbackUsage,
  workerSnapshot,
) {
  const { assets, mesh, materialHandle } =
    createTrianglePresentationAssets(aperture);
  const extractedSnapshot = workerSnapshot.snapshot;
  const firstDraw = extractedSnapshot.meshDraws[0];
  const firstView = extractedSnapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return {
      ...failure(
        "extract",
        "empty-snapshot",
        "The custom WGSL triangle scene did not extract a drawable view and mesh.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: extractedSnapshot.diagnostics,
    };
  }

  const customSource = createCustomWgslTriangleMaterial(aperture);

  assets.markReady(materialHandle, customSource);

  const customStore = new aperture.PreparedRenderAssetStore();
  const customPreparation = aperture.prepareRenderAsset({
    registry: assets,
    adapter: aperture.createCustomWgslMaterialRenderAssetAdapter(
      customSource.familyKey,
    ),
    store: customStore,
    handle: materialHandle,
  });
  const preparedMaterial = customPreparation.entry?.prepared ?? null;

  if (customPreparation.outcome !== "prepared" || preparedMaterial === null) {
    return {
      ...failure(
        "prepare-custom-material",
        "custom-material-prepare-failed",
        "The custom WGSL material could not be prepared from its source asset.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: customPreparation.diagnostics,
    };
  }

  const uniformResource = createCustomMaterialUniformResource({
    aperture,
    device: initialized.device,
    material: preparedMaterial,
  });

  if (!uniformResource.ok) {
    return {
      ...failure(
        "custom-uniform",
        uniformResource.reason,
        uniformResource.message,
      ),
      extraction: snapshotCounts(extractedSnapshot),
    };
  }

  const customResources =
    await aperture.createCustomWgslMaterialRenderResources({
      device: initialized.device,
      material: preparedMaterial,
      colorFormat: initialized.format,
      resources: [uniformResource.resource],
    });

  if (!customResources.valid || customResources.resources === null) {
    return {
      ...failure(
        "custom-resources",
        "custom-material-resources-unavailable",
        "The custom WGSL pipeline or material bind group could not be created.",
      ),
      extraction: snapshotCounts(extractedSnapshot),
      diagnostics: customResources.diagnostics,
    };
  }

  const snapshot = rewriteSnapshotForCustomMaterial(
    aperture,
    extractedSnapshot,
    preparedMaterial,
  );
  const packedViews = aperture.packSnapshotViewUniforms(snapshot);
  const packedTransforms = aperture.packSnapshotTransforms(snapshot);
  const frameResources = createCustomWgslFrameResources({
    aperture,
    device: initialized.device,
    mesh,
    pipeline: customResources.resources.pipeline.pipeline,
    packedViews,
    packedTransforms,
  });

  if (!frameResources.valid || frameResources.resources === null) {
    return {
      ...failure(
        "resources",
        "custom-frame-resources-unavailable",
        "The custom WGSL frame resources could not be uploaded.",
      ),
      extraction: snapshotCounts(snapshot),
      diagnostics: frameResources.diagnostics,
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
      draw.material.id === "triangle" ? preparedMaterial.materialKey : null,
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
    return {
      ...failure(
        "draw-plan",
        "custom-draw-plan-unavailable",
        "The custom WGSL draw plan did not produce a drawable command stream.",
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

  const submitted = await submitTriangleFrame(
    aperture,
    initialized,
    commandPlan,
    canvasSize,
    readbackUsage,
  );

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
    apertureVersion: "0.0.0",
    renderingBackend: "webgpu-explicit",
    format: initialized.format,
    clearColor,
    worker: workerSnapshot.worker,
    transport: workerSnapshot.transport,
    customMaterial: {
      family: preparedMaterial.materialFamily,
      sourceMaterialKey: preparedMaterial.sourceMaterialKey,
      materialResourceKey: preparedMaterial.materialKey,
      pipelineKey: preparedMaterial.pipeline.pipelineKey,
      bindGroupResourceKey: customResources.resources.bindGroup.resourceKey,
      uniformColor: customMaterialUniformColor,
      diagnostics:
        customPreparation.diagnostics.length +
        customResources.diagnostics.length,
    },
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
    readback: submitted.readback,
  };
}

async function submitTriangleFrame(
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

function createTrianglePresentationAssets(aperture) {
  const assets = new aperture.AssetRegistry();
  const meshHandle = aperture.createMeshHandle("triangle");
  const materialHandle = aperture.createMaterialHandle("triangle");
  const mesh = createTriangleMesh();
  const material = aperture.createUnlitMaterialAsset({
    label: "TriangleMaterial",
    baseColorFactor: new Float32Array([1, 0.18, 0.09, 1]),
  });

  assets.register(meshHandle);
  assets.register(materialHandle);
  assets.markReady(meshHandle, mesh);
  assets.markReady(materialHandle, material);

  return { assets, mesh, meshHandle, material, materialHandle };
}

function createTriangleMesh() {
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
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min: [-0.72, -0.55, 0], max: [0.72, 0.72, 0] },
    localSphere: { center: [0, 0, 0], radius: 0.9 },
  };
}

function createCustomWgslTriangleMaterial(aperture) {
  return {
    sourceDiscriminator: "custom-material-source",
    shaderLanguage: "wgsl",
    familyKey: "example/triangle-water",
    label: "Custom WGSL Water Triangle",
    renderState: aperture.createDefaultRenderState({
      cullMode: "none",
    }),
    pipelineKey: {
      features: [],
      specialization: {},
    },
    shader: {
      kind: "inline-wgsl",
      virtualPath: "triangle-water.wgsl",
      code: `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct CustomMaterialUniform {
  color: vec4f,
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
@group(2) @binding(0) var<uniform> material: CustomMaterialUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let customColor = vec3f(
    material.color.r + input.uv.x * 0.2,
    material.color.g + input.uv.y * 0.2,
    material.color.b
  );
  return vec4f(customColor, material.color.a);
}
      `.trim(),
    },
    entryPoints: {
      vertex: "vs_main",
      fragment: "fs_main",
    },
    bindings: [
      {
        name: "material",
        binding: 0,
        kind: "uniform-buffer",
        visibility: ["fragment"],
        label: "customMaterialUniform",
        fields: {
          color: { type: "vec4", default: customMaterialUniformColor },
        },
        values: {
          color: customMaterialUniformColor,
        },
      },
    ],
    dependencies: [],
  };
}

function createCustomMaterialUniformResource({ aperture, device, material }) {
  const binding = material.bindGroup.entries[0];

  if (binding === undefined) {
    return {
      ok: false,
      reason: "custom-material-binding-missing",
      message: "The custom WGSL material did not declare binding 0.",
    };
  }

  const bufferUsage = globalThis.GPUBufferUsage ?? {
    UNIFORM: 0x40,
    COPY_DST: 0x08,
  };
  const buffer = aperture.createWebGpuBuffer({
    device,
    descriptor: {
      label: `${material.label}/uniform`,
      size: customMaterialUniformColor.length * Float32Array.BYTES_PER_ELEMENT,
      usage: bufferUsage.UNIFORM | bufferUsage.COPY_DST,
      initialData: new Float32Array(customMaterialUniformColor),
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
  };
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

function createCustomWgslFrameResources({
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
      layoutKey: `custom-wgsl/pipeline-layout-${group}`,
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
