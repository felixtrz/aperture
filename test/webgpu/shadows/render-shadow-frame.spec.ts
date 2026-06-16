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
      result.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(20);
    expect(result.matrixComputation.matrices[0]?.center).not.toEqual([0, 0, 0]);
  });

  it("uses matrix options as fallback without suppressing primary camera frustum fit", () => {
    const calls = createDeviceCalls();
    const result = createRenderShadowFrame({
      device: device(calls),
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
    expect(result.matrixComputation.matrices[0]?.center).not.toEqual([
      0, 0, -2,
    ]);
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
      matrixBindGroupsCreated: 1,
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
      matrixBindGroupsReused: 1,
    });
    expect(second.report.commandBufferSubmission.status).toBe("submitted");
    expect(second.report.commandBufferSubmission.sections.shaderSampling).toBe(
      true,
    );
    expect(second.report.diagnostics).toEqual([]);
    expect(calls.textures).toHaveLength(1);
    expect(calls.samplers).toHaveLength(1);
    expect(calls.pipelines).toHaveLength(1);
    expect(calls.submissions).toHaveLength(2);
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
    bounds: [],
    transforms: identityTransform(),
    viewMatrices: options.view?.viewMatrices ?? new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 1,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function primaryCameraView(): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  const viewMatrix = translationView(4, 2, 10);
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

interface DeviceCalls {
  readonly textures: unknown[];
  readonly textureViews: unknown[];
  readonly samplers: unknown[];
  readonly buffers: unknown[];
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
      calls.buffers.push(descriptor);
      return { descriptor };
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
