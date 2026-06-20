import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  createRenderShadowFrame,
  createWebGpuEnvironmentResourceCache,
  makePerspective,
  multiplyMat4,
  type RenderShadowFrameDeviceLike,
  type RenderSnapshot,
  type ShadowCasterExecutableMeshResourceView,
  type ShadowCasterPreparedMeshResourceView,
} from "@aperture-engine/webgpu/test-support";

describe("render shadow frame", () => {
  it("submits a directional CSM caster pass and returns receiver resources", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 3, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });

    expect(result.report.status).toBe("submitted");
    expect(result.report.commandBufferSubmission.status).toBe("submitted");
    expect(result.report.commandBufferSubmission.sections.shaderSampling).toBe(
      true,
    );
    expect(result.report.passCount).toBeGreaterThan(0);
    expect(result.report.drawCalls).toBeGreaterThan(0);
    expect(result.report.diagnostics).toEqual([]);
    expect(result.receiverResources).toMatchObject({
      shadowKind: "directional-cascaded",
    });
    expect(result.receiverResources?.matrixBufferResource.resource).not.toBe(
      null,
    );
    expect(
      result.receiverResources?.depthTextureResources.resources.some(
        (resource) => resource.allocation.resource !== null,
      ),
    ).toBe(true);
    expect(calls.submissions).toHaveLength(1);
    expect(JSON.stringify(result.report)).not.toMatch(
      /deferred|not implemented yet/i,
    );
  });

  it("frustum-fits automatic directional shadows from the primary snapshot camera", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot({ view: primaryCameraView() }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });

    expect(result.report.status).toBe("submitted");
    expect(result.report.diagnostics).toEqual([]);
    expect(result.viewProjection.plans[0]?.cascadeNearDistance).toBeCloseTo(
      0.1,
      4,
    );
    expect(result.viewProjection.plans[0]?.cascadeFarDistance).toBeCloseTo(
      60,
      2,
    );
    expect(
      result.report.viewProjection.plans[0]?.cascadeFarDistance,
    ).toBeCloseTo(60, 2);
    expect(
      result.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(20);
    expect(
      result.report.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(20);
    expect(result.report.casterDrawList.includedDrawCount).toBe(
      result.casterDrawList.includedDrawCount,
    );
    expect(result.matrixComputation.matrices[0]?.center).not.toEqual([0, 0, 0]);
  });

  it("uses matrix options as fallback without suppressing primary camera frustum fit", () => {
    const baseResult = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({ view: primaryCameraView() }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });
    const result = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({ view: primaryCameraView() }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
      matrix: {
        center: [0, 0, -2],
        orthographicSize: 4,
        near: 0.5,
        far: 8,
        lightDistance: 4,
      },
    });

    expect(result.report.status).toBe("submitted");
    expect(
      result.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(20);
    expect(result.matrixComputation.matrices[0]).toEqual(
      baseResult.matrixComputation.matrices[0],
    );
    expect(result.matrixComputation.matrices[0]?.center).not.toEqual([
      0, 0, -2,
    ]);
  });

  it("tightens single-cascade frustum fit to receiver bounds", () => {
    const wideCamera = primaryCameraView();
    const loose = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: wideCamera,
        shadowRequest: { cascadeCount: 1 },
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });
    const tight = createRenderShadowFrame({
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: wideCamera,
        shadowRequest: { cascadeCount: 1 },
        bounds: [
          boundsPacket(0, {
            min: [-2, 0, -2],
            max: [2, 2, 2],
          }),
        ],
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      shadowMap: { cascadeCount: 1, mapSize: 1024 },
    });

    const looseSize =
      loose.matrixComputation.matrices[0]?.orthographicSize ?? 0;
    const tightSize =
      tight.matrixComputation.matrices[0]?.orthographicSize ?? 0;

    expect(looseSize).toBeGreaterThan(100);
    expect(tightSize).toBeGreaterThan(0);
    expect(tightSize).toBeLessThan(10);
    expect(tightSize).toBeLessThan(looseSize * 0.1);
    expect(tight.report.matrixComputation.matrices[0]?.orthographicSize).toBe(
      tightSize,
    );
  });

  it("reuses cached shadow resources across identical frames", () => {
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const input = {
      device: device(calls),
      snapshot: snapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      shadowMap: { cascadeCount: 3, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;

    const first = createRenderShadowFrame(input);
    const second = createRenderShadowFrame(input);

    expect(first.report.resourceReuse).toMatchObject({
      depthTexturesCreated: 1,
      depthTexturesReused: 0,
      samplersCreated: 1,
      samplersReused: 0,
      pipelinesCreated: 1,
      pipelinesReused: 0,
      matrixBindGroupsCreated: 3,
      matrixBindGroupsReused: 0,
    });
    expect(second.report.resourceReuse).toMatchObject({
      depthTexturesCreated: 0,
      depthTexturesReused: 1,
      samplersCreated: 0,
      samplersReused: 1,
      pipelinesCreated: 0,
      pipelinesReused: 1,
      matrixBindGroupsCreated: 0,
      matrixBindGroupsReused: 3,
    });
    expect(second.report.commandBufferSubmission.status).toBe("submitted");
    expect(second.report.commandBufferSubmission.sections.shaderSampling).toBe(
      true,
    );
    expect(second.report.diagnostics).toEqual([]);
    expect(calls.textures).toHaveLength(1);
    expect(calls.samplers).toHaveLength(1);
    expect(calls.pipelines).toHaveLength(1);
    expect(calls.buffers).toHaveLength(5);
    expect(calls.bindGroups).toHaveLength(3);
    expect(calls.submissions).toHaveLength(2);
    expect(calls.destroyedBuffers).toHaveLength(0);
    expect(
      calls.bufferWrites.filter((write) =>
        writeTargetsBufferLabel(write, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(1);
  });

  it("updates cached caster world transforms in place when caster transforms change", () => {
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const base = {
      device: device(calls),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      shadowMap: { cascadeCount: 3, mapSize: 512 },
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;

    const first = createRenderShadowFrame({
      ...base,
      snapshot: snapshot(),
    });
    const second = createRenderShadowFrame({
      ...base,
      snapshot: snapshot({ transforms: translatedTransform([1, 0, 0]) }),
    });

    expect(first.report.status).toBe("submitted");
    expect(second.report.status).toBe("submitted");
    expect(
      calls.buffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(1);
    expect(
      calls.destroyedBuffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(0);
    expect(
      calls.bufferWrites.filter((write) =>
        writeTargetsBufferLabel(write, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(2);
  });

  it("recreates caster world-transform resources when the caster count changes", () => {
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const base = {
      device: device(calls),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;

    const first = createRenderShadowFrame({
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 1 } }),
      shadowMap: { cascadeCount: 1, mapSize: 512 },
    });
    const second = createRenderShadowFrame({
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 3 } }),
      shadowMap: { cascadeCount: 3, mapSize: 512 },
    });

    expect(first.report.status).toBe("submitted");
    expect(second.report.status).toBe("submitted");
    expect(
      calls.buffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(2);
    expect(
      calls.destroyedBuffers.filter((buffer) =>
        bufferHasLabel(buffer, "ShadowCasterWorldTransforms/storage"),
      ),
    ).toHaveLength(1);
    expect(
      calls.destroyedBuffers.filter((buffer) =>
        bufferHasLabel(buffer, "DirectionalShadowMatrices/storage"),
      ),
    ).toHaveLength(1);
    expect(calls.bindGroups).toHaveLength(4);
  });

  it("drops cached caster command topology when the world-transform buffer is recreated", () => {
    // Regression: demolishing a shadow caster changes the caster count, which
    // resizes (destroys + recreates) the shared ShadowCasterWorldTransforms
    // buffer. Revisiting an earlier caster configuration must not replay a
    // cached command topology whose bind groups still point at the destroyed
    // buffer — doing so submits a destroyed buffer every frame and blacks out
    // the whole device (a permanent black screen after delete).
    const calls = createDeviceCalls();
    const cache = createWebGpuEnvironmentResourceCache();
    const base = {
      device: device(calls),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache,
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    } as const;
    const single = {
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 1 } }),
      shadowMap: { cascadeCount: 1, mapSize: 512 },
    } as const;
    const triple = {
      ...base,
      snapshot: snapshot({ shadowRequest: { cascadeCount: 3 } }),
      shadowMap: { cascadeCount: 3, mapSize: 512 },
    } as const;

    // 1 cascade (caches a topology) -> 3 cascades (recreates the buffer, so the
    // first topology now references a destroyed buffer) -> back to 1 cascade,
    // whose topology key matches the very first frame.
    createRenderShadowFrame(single);
    createRenderShadowFrame(triple);
    const revisit = createRenderShadowFrame(single);

    expect(revisit.report.status).toBe("submitted");

    const destroyed = new Set(calls.destroyedBuffers);
    const referencedBuffers = bindGroupBufferReferences(revisit.commandRecords);
    expect(referencedBuffers.length).toBeGreaterThan(0);
    expect(referencedBuffers.filter((buffer) => destroyed.has(buffer))).toEqual(
      [],
    );
  });

  it("honors authored shadow request bias, filter radius, and map size", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot({
        shadowRequest: {
          mapSize: 2048,
          depthBias: 0.0004,
          normalBias: 0.02,
          filterRadius: 4,
        },
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });

    expect(result.descriptor.descriptors[0]).toMatchObject({
      mapSize: 2048,
      textureWidth: 2048,
      textureHeight: 2048,
      depthBias: 0.0004,
      normalBias: 0.02,
      filterRadiusTexels: 4,
    });
  });

  it("lets authored fixed shadow-camera settings override auto matrix options", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot({
        view: primaryCameraView(),
        shadowRequest: {
          cascadeCount: 1,
          center: [1, 2, 3],
          orthographicSize: 16,
          near: 0.5,
          far: 60,
          lightDistance: 20,
        },
      }),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      matrix: {
        center: [0, 0, -2],
        orthographicSize: 8,
        near: 1,
        far: 12,
        lightDistance: 5,
      },
    });

    expect(result.matrixComputation.matrices[0]).toMatchObject({
      center: [1, 2, 3],
      orthographicSize: 16,
      near: 0.5,
      far: 60,
      lightPosition: [1, 2, 23],
    });
  });

  it("keeps authored fixed shadow-camera matrices independent of primary camera movement", () => {
    const fixedShadow = {
      cascadeCount: 1,
      center: [1, 2, 3] as const,
      orthographicSize: 16,
      near: 0.5,
      far: 60,
      lightDistance: 20,
    };
    const base = {
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
    } as const;
    const first = createRenderShadowFrame({
      ...base,
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: primaryCameraView(),
        shadowRequest: fixedShadow,
      }),
    });
    const second = createRenderShadowFrame({
      ...base,
      device: device(createDeviceCalls()),
      snapshot: snapshot({
        view: cameraView(-8, 6, 24),
        shadowRequest: fixedShadow,
      }),
    });

    expect(second.matrixComputation.matrices[0]).toEqual(
      first.matrixComputation.matrices[0],
    );
  });

  it("specializes caster pipeline vertex layout from the caster draw list", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
      snapshot: snapshot(),
      preparedMeshes: preparedMeshes(),
      executableMeshes: executableMeshes(),
      cache: createWebGpuEnvironmentResourceCache(),
      matrix: { center: [0, 0, -2], orthographicSize: 16 },
    });

    expect(result.pipelineDescriptor.descriptor?.vertex.meshLayoutKey).toBe(
      "POSITION",
    );
    expect(result.pipelineDescriptor.descriptor?.pipelineKey).toContain(
      "mesh-layout:POSITION",
    );
    expect(calls.pipelines).toHaveLength(1);

    const pipelineDescriptor = calls.pipelines[0] as {
      readonly vertex?: {
        readonly buffers?: readonly {
          readonly arrayStride?: number;
          readonly stepMode?: string;
          readonly attributes?: readonly {
            readonly shaderLocation?: number;
            readonly offset?: number;
            readonly format?: string;
          }[];
        }[];
      };
    };

    expect(pipelineDescriptor.vertex?.buffers?.[0]).toMatchObject({
      arrayStride: 12,
      stepMode: "vertex",
      attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
    });
  });
});

function snapshot(
  options: {
    readonly shadowRequest?: Partial<RenderSnapshot["shadowRequests"][number]>;
    readonly view?: Pick<RenderSnapshot, "views" | "viewMatrices">;
    readonly bounds?: RenderSnapshot["bounds"];
    readonly transforms?: Float32Array;
  } = {},
): RenderSnapshot {
  return {
    frame: 1,
    views: options.view?.views ?? [],
    meshDraws: [
      {
        renderId: 101,
        entity: { index: 2, generation: 0 },
        mesh: createMeshHandle("caster"),
        material: createMaterialHandle("caster"),
        submesh: 0,
        materialSlot: 0,
        worldTransformOffset: 0,
        boundsIndex: 0,
        layerMask: 1,
        castsShadow: true,
        receivesShadow: true,
        sortKey: {
          queue: "opaque",
          viewId: 0,
          layer: 0,
          order: 0,
          pipelineKey: "standard|cascadedShadowMap",
          materialKey: "material:caster",
          meshKey: "mesh:caster",
          depth: 0,
          stableId: 101,
        },
        batchKey: {
          pipelineKey: "standard|cascadedShadowMap",
          materialKey: "material:caster",
          meshLayoutKey: "POSITION",
          topology: "triangle-list",
          instanced: false,
          skinned: false,
          morphed: false,
        },
      },
    ],
    lights: [
      {
        lightId: 11,
        entity: { index: 1, generation: 0 },
        kind: "directional",
        color: [1, 1, 1, 1],
        intensity: 1,
        range: 0,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    environments: [],
    shadowRequests: [
      {
        shadowId: 7,
        lightId: 11,
        lightKind: "directional",
        cascadeCount: 3,
        casterLayerMask: 1,
        receiverLayerMask: 1,
        ...options.shadowRequest,
      },
    ],
    bounds: options.bounds ?? [],
    transforms: options.transforms ?? identityTransform(),
    viewMatrices: options.view?.viewMatrices ?? new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 1,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      bounds: options.bounds?.length ?? 0,
      diagnostics: 0,
    },
  };
}

function boundsPacket(
  boundsId: number,
  worldAabb: RenderSnapshot["bounds"][number]["worldAabb"],
): RenderSnapshot["bounds"][number] {
  const center: readonly [number, number, number] = [
    (worldAabb.min[0] + worldAabb.max[0]) * 0.5,
    (worldAabb.min[1] + worldAabb.max[1]) * 0.5,
    (worldAabb.min[2] + worldAabb.max[2]) * 0.5,
  ];
  const radius = Math.hypot(
    worldAabb.max[0] - center[0],
    worldAabb.max[1] - center[1],
    worldAabb.max[2] - center[2],
  );

  return {
    boundsId,
    entity: { index: boundsId, generation: 0 },
    localAabb: worldAabb,
    worldAabb,
    localSphere: { center, radius },
    worldSphere: { center, radius },
  };
}

function primaryCameraView(): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  return cameraView(4, 2, 10);
}

function cameraView(
  x: number,
  y: number,
  z: number,
): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  const viewMatrix = translationView(x, y, z);
  const projectionMatrix = makePerspective(1.0, 1.5, 0.1, 60);
  const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);
  const viewMatrices = new Float32Array(48);

  viewMatrices.set(viewMatrix, 0);
  viewMatrices.set(projectionMatrix, 16);
  viewMatrices.set(viewProjectionMatrix, 32);

  return {
    views: [
      {
        viewId: 0,
        camera: { index: 99, generation: 0 },
        priority: 0,
        layerMask: 1,
        viewMatrixOffset: 0,
        projectionMatrixOffset: 16,
        viewProjectionMatrixOffset: 32,
        viewport: [0, 0, 1, 1],
        scissor: [0, 0, 1, 1],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
        clearStencil: 0,
        renderTarget: null,
      },
    ],
    viewMatrices,
  };
}

function translationView(x: number, y: number, z: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
}

function preparedMeshes(): readonly ShadowCasterPreparedMeshResourceView[] {
  return [
    {
      meshKey: "mesh:caster",
      meshResourceKey: "mesh-buffer:caster",
      vertexBufferResourceKeys: ["mesh-vertex-buffer:caster/position"],
      indexBufferResourceKey: "mesh-index-buffer:caster",
    },
  ];
}

function executableMeshes(): readonly ShadowCasterExecutableMeshResourceView[] {
  return [
    {
      meshKey: "mesh:caster",
      meshResourceKey: "mesh-buffer:caster",
      vertexBuffers: [
        {
          resourceKey: "mesh-vertex-buffer:caster/position",
          buffer: { kind: "vertex-buffer" },
          vertexCount: 3,
        },
      ],
      indexBuffer: {
        resourceKey: "mesh-index-buffer:caster",
        buffer: { kind: "index-buffer" },
        format: "uint32",
        indexCount: 3,
      },
    },
  ];
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function translatedTransform(
  translation: readonly [number, number, number],
): Float32Array {
  const transform = identityTransform();

  transform[12] = translation[0];
  transform[13] = translation[1];
  transform[14] = translation[2];

  return transform;
}

interface DeviceCalls {
  readonly textures: unknown[];
  readonly textureViews: unknown[];
  readonly samplers: unknown[];
  readonly buffers: unknown[];
  readonly destroyedBuffers: unknown[];
  readonly bufferWrites: unknown[];
  readonly shaderModules: unknown[];
  readonly bindGroupLayouts: unknown[];
  readonly pipelineLayouts: unknown[];
  readonly pipelines: unknown[];
  readonly bindGroups: unknown[];
  readonly renderPasses: unknown[];
  readonly submissions: unknown[];
}

function createDeviceCalls(): DeviceCalls {
  return {
    textures: [],
    textureViews: [],
    samplers: [],
    buffers: [],
    destroyedBuffers: [],
    bufferWrites: [],
    shaderModules: [],
    bindGroupLayouts: [],
    pipelineLayouts: [],
    pipelines: [],
    bindGroups: [],
    renderPasses: [],
    submissions: [],
  };
}

function device(calls: DeviceCalls): RenderShadowFrameDeviceLike {
  return {
    createTexture(descriptor) {
      calls.textures.push(descriptor);
      return {
        createView(viewDescriptor) {
          calls.textureViews.push(viewDescriptor ?? {});
          return { viewDescriptor: viewDescriptor ?? {} };
        },
      };
    },
    createSampler(descriptor) {
      calls.samplers.push(descriptor);
      return { descriptor };
    },
    createBuffer(descriptor) {
      const buffer = {
        descriptor,
        destroy: () => {
          calls.destroyedBuffers.push(buffer);
        },
      };
      calls.buffers.push(buffer);
      return buffer;
    },
    createShaderModule(descriptor) {
      calls.shaderModules.push(descriptor);
      return { compilationInfo: async () => ({ messages: [] }) };
    },
    createBindGroupLayout(descriptor) {
      calls.bindGroupLayouts.push(descriptor);
      return { descriptor };
    },
    createPipelineLayout(descriptor) {
      calls.pipelineLayouts.push(descriptor);
      return { descriptor };
    },
    createRenderPipeline(descriptor) {
      calls.pipelines.push(descriptor);
      return { descriptor };
    },
    createBindGroup(descriptor) {
      calls.bindGroups.push(descriptor);
      return { descriptor };
    },
    createCommandEncoder() {
      return {
        beginRenderPass(descriptor: unknown) {
          calls.renderPasses.push(descriptor);
          return renderPassEncoder();
        },
        finish() {
          return { kind: "command-buffer" };
        },
      };
    },
    queue: {
      writeBuffer(...args) {
        calls.bufferWrites.push(args);
      },
      submit(commandBuffers) {
        calls.submissions.push(commandBuffers);
      },
    },
  };
}

function bindGroupBufferReferences(report: {
  readonly commandRecords: readonly {
    readonly commands: readonly {
      readonly kind: string;
      readonly bindGroup?: unknown;
    }[];
  }[];
}): unknown[] {
  const buffers: unknown[] = [];
  for (const record of report.commandRecords) {
    for (const command of record.commands) {
      if (command.kind !== "setBindGroup") continue;
      const entries =
        (
          command.bindGroup as {
            readonly descriptor?: {
              readonly entries?: readonly {
                readonly resource?: { readonly buffer?: unknown };
              }[];
            };
          }
        ).descriptor?.entries ?? [];
      for (const entry of entries) {
        if (entry.resource?.buffer !== undefined) {
          buffers.push(entry.resource.buffer);
        }
      }
    }
  }
  return buffers;
}

function bufferHasLabel(buffer: unknown, label: string): boolean {
  return (
    typeof buffer === "object" &&
    buffer !== null &&
    (buffer as { readonly descriptor?: { readonly label?: string } }).descriptor
      ?.label === label
  );
}

function writeTargetsBufferLabel(write: unknown, label: string): boolean {
  return Array.isArray(write) && bufferHasLabel(write[0], label);
}

function renderPassEncoder() {
  return {
    setPipeline: () => undefined,
    setBindGroup: () => undefined,
    setVertexBuffer: () => undefined,
    setIndexBuffer: () => undefined,
    drawIndexed: () => undefined,
    end: () => undefined,
  };
}
