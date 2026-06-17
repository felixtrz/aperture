import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  createWebGpuAppResourceCache,
  makePerspective,
  multiplyMat4,
  type MeshAsset,
  type RenderSnapshot,
  type RenderShadowFrameDeviceLike,
  type WebGpuApp,
} from "@aperture-engine/webgpu/test-support";

import { createWebGpuAppAutoShadowFrame } from "../../packages/webgpu/src/app/auto-shadow-frame.js";
import { createWebGpuAppResourceReuseReport } from "../../packages/webgpu/src/app/report.js";

describe("WebGPU app auto-shadow frame", () => {
  it("tightens single directional auto-shadows to receiver bounds when a primary camera exists", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("opaque-caster");
    const alphaMesh = createMeshHandle("alpha-helper");

    assets.register(opaqueMesh, { label: "Opaque caster" });
    assets.markReady(opaqueMesh, triangleMesh("Opaque caster"));
    assets.register(alphaMesh, { label: "Alpha helper" });
    assets.markReady(alphaMesh, triangleMesh("Alpha helper"));

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: snapshot({ opaqueMesh, alphaMesh }),
    });

    expect(result).not.toBeNull();
    expect(result?.report.status).toBe("submitted");
    expect(result?.casterDrawList.includedDrawCount).toBe(1);
    expect(
      result?.casterDrawList.lists[0]?.draws.map((draw) => draw.renderId),
    ).toEqual([101]);
    expect(
      result?.casterDrawList.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["shadowCasterDrawList.unsupportedAlphaBlendCaster"]);
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeGreaterThan(7);
    expect(
      result?.matrixComputation.matrices[0]?.orthographicSize,
    ).toBeLessThan(9);
    expect(result?.matrixComputation.matrices[0]?.center).not.toEqual([
      0, 0, 0,
    ]);
  });

  it("uses light-space scene fit as the no-camera fallback", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("flat-caster");
    const alphaMesh = createMeshHandle("alpha-helper");

    assets.register(opaqueMesh, { label: "Flat caster" });
    assets.markReady(opaqueMesh, triangleMesh("Flat caster"));
    assets.register(alphaMesh, { label: "Alpha helper" });
    assets.markReady(alphaMesh, triangleMesh("Alpha helper"));

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: snapshot({
        opaqueMesh,
        alphaMesh,
        opaqueBounds: { min: [-10, 0, -10], max: [10, 1, 10] },
        receiverBounds: { min: [-12, 0, -12], max: [12, 0.1, 12] },
        transforms: directionalLightTransform([0, -1, 0]),
        includeView: false,
      }),
    });

    const orthographicSize =
      result?.matrixComputation.matrices[0]?.orthographicSize;
    const oldWorldDiagonalSize = Math.hypot(20, 1, 20) * 1.1;

    expect(result).not.toBeNull();
    expect(orthographicSize).toBeGreaterThan(21);
    expect(orthographicSize).toBeLessThan(23);
    expect(orthographicSize).toBeLessThan(oldWorldDiagonalSize);
  });

  it("keeps shadow casters that are absent from the visible mesh draw list", () => {
    const calls = createDeviceCalls();
    const assets = new AssetRegistry();
    const opaqueMesh = createMeshHandle("off-camera-caster");
    const alphaMesh = createMeshHandle("off-camera-alpha-helper");

    assets.register(opaqueMesh, { label: "Off-camera caster" });
    assets.markReady(opaqueMesh, triangleMesh("Off-camera caster"));
    assets.register(alphaMesh, { label: "Off-camera alpha helper" });
    assets.markReady(alphaMesh, triangleMesh("Off-camera alpha helper"));

    const source = snapshot({
      opaqueMesh,
      alphaMesh,
      opaqueBounds: { min: [10, 0, 0], max: [12, 2, 2] },
      receiverBounds: { min: [-4, 0, -4], max: [4, 0.1, 4] },
    });
    const visibleReceiver = source.meshDraws.filter(
      (draw) => draw.renderId === 103,
    );
    const shadowCasterDraws = source.meshDraws.filter(
      (draw) => draw.renderId === 101 || draw.renderId === 102,
    );

    const result = createWebGpuAppAutoShadowFrame({
      app: app(device(calls)),
      assets,
      cache: createWebGpuAppResourceCache(),
      reuse: createWebGpuAppResourceReuseReport(),
      snapshot: {
        ...source,
        meshDraws: visibleReceiver,
        shadowCasterDraws,
        report: {
          ...source.report,
          meshDraws: visibleReceiver.length,
          shadowCasterDraws: shadowCasterDraws.length,
        },
      },
    });

    expect(visibleReceiver.map((draw) => draw.renderId)).toEqual([103]);
    expect(result).not.toBeNull();
    expect(result?.casterDrawList.meshDrawCount).toBe(2);
    expect(
      result?.casterDrawList.lists[0]?.draws.map((draw) => draw.renderId),
    ).toEqual([101]);
    expect(
      result?.casterDrawList.diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["shadowCasterDrawList.unsupportedAlphaBlendCaster"]);
  });
});

function app(device: RenderShadowFrameDeviceLike): WebGpuApp {
  return { initialization: { device } } as WebGpuApp;
}

function snapshot(input: {
  readonly opaqueMesh: ReturnType<typeof createMeshHandle>;
  readonly alphaMesh: ReturnType<typeof createMeshHandle>;
  readonly opaqueBounds?: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly receiverBounds?: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  };
  readonly transforms?: Float32Array;
  readonly includeView?: boolean;
}): RenderSnapshot {
  const view = primaryCameraView();
  return {
    frame: 1,
    views: input.includeView === false ? [] : view.views,
    meshDraws: [
      meshDraw({
        renderId: 101,
        mesh: input.opaqueMesh,
        material: createMaterialHandle("opaque-caster"),
        boundsIndex: 0,
        pipelineKey: "standard|opaque|back|less|none",
        castsShadow: true,
        receivesShadow: true,
      }),
      meshDraw({
        renderId: 102,
        mesh: input.alphaMesh,
        material: createMaterialHandle("alpha-helper"),
        boundsIndex: 1,
        pipelineKey: "unlit|blend|none|less|alpha",
        castsShadow: true,
        receivesShadow: false,
      }),
      meshDraw({
        renderId: 103,
        mesh: input.opaqueMesh,
        material: createMaterialHandle("receiver"),
        boundsIndex: 2,
        pipelineKey: "standard|opaque|back|less|none",
        castsShadow: false,
        receivesShadow: true,
      }),
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
        cascadeCount: 1,
        casterLayerMask: 1,
        receiverLayerMask: 1,
      },
    ],
    bounds: [
      boundsPacket(
        0,
        input.opaqueBounds ?? {
          min: [-1, 0, -1],
          max: [1, 2, 1],
        },
      ),
      boundsPacket(1, {
        min: [-1000, -1000, -1000],
        max: [1000, 1000, 1000],
      }),
      boundsPacket(
        2,
        input.receiverBounds ?? {
          min: [-4, 0, -4],
          max: [4, 0.1, 4],
        },
      ),
    ],
    transforms: input.transforms ?? identityTransform(),
    viewMatrices:
      input.includeView === false ? new Float32Array(0) : view.viewMatrices,
    diagnostics: [],
    report: {
      views: input.includeView === false ? 0 : 1,
      meshDraws: 3,
      lights: 1,
      environments: 0,
      shadowRequests: 1,
      bounds: 3,
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

function meshDraw(input: {
  readonly renderId: number;
  readonly mesh: ReturnType<typeof createMeshHandle>;
  readonly material: ReturnType<typeof createMaterialHandle>;
  readonly boundsIndex: number;
  readonly pipelineKey: string;
  readonly castsShadow: boolean;
  readonly receivesShadow: boolean;
}): RenderSnapshot["meshDraws"][number] {
  return {
    renderId: input.renderId,
    entity: { index: input.renderId, generation: 0 },
    mesh: input.mesh,
    material: input.material,
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: input.boundsIndex,
    layerMask: 1,
    castsShadow: input.castsShadow,
    receivesShadow: input.receivesShadow,
    sortKey: {
      queue: input.pipelineKey.includes("|blend|") ? "transparent" : "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: input.pipelineKey,
      materialKey: `material:${input.material.id}`,
      meshKey: `mesh:${input.mesh.id}`,
      depth: 0,
      stableId: input.renderId,
    },
    batchKey: {
      pipelineKey: input.pipelineKey,
      materialKey: `material:${input.material.id}`,
      meshLayoutKey: "POSITION",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: false,
    },
  };
}

function primaryCameraView(): Pick<RenderSnapshot, "views" | "viewMatrices"> {
  const viewMatrix = translationView(80, 40, 120);
  const projectionMatrix = makePerspective(1, 1.5, 0.1, 200);
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

function triangleMesh(label: string): MeshAsset {
  return {
    kind: "mesh",
    label,
    vertexStreams: [
      {
        id: "POSITION",
        arrayStride: 12,
        vertexCount: 3,
        attributes: [{ semantic: "POSITION", format: "float32x3", offset: 0 }],
        data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      },
    ],
    indexBuffer: { format: "uint32", data: new Uint32Array([0, 1, 2]) },
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
  };
}

function identityTransform(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function directionalLightTransform(
  direction: readonly [number, number, number],
): Float32Array {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  const dx = direction[0] / length;
  const dy = direction[1] / length;
  const dz = direction[2] / length;
  const transform = identityTransform();
  transform[8] = -dx;
  transform[9] = -dy;
  transform[10] = -dz;
  return transform;
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
