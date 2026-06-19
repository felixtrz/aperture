import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  DRAW_ORDER_WORLD_TRANSFORM_BIND_GROUP_SCOPE_KEY,
  createDrawCommandDescriptorScratch,
  createDrawOrderTransformBufferCache,
  createDrawOrderTransformPackingScratch,
  createRenderPassDrawListScratch,
  prepareDrawOrderTransformPacking,
  writeDrawCommandDescriptors,
  writeRenderPassDrawList,
  type BatchCompatibilityKey,
  type GetOrCreateRenderPipelineResult,
  type MeshDrawPacket,
  type MeshGpuBufferResource,
  type PackedSnapshotTransforms,
  type RenderQueue,
  type RenderSortKey,
  type RenderWorldDrawPackage,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu/test-support";

const MATRIX_FLOATS = 16;

describe("draw-order transform packing", () => {
  it("repackages compatible opaque transforms into draw order for coalescing", () => {
    const device = fakeDevice();
    const packages = [
      drawPackage(3, 32),
      drawPackage(1, 0),
      drawPackage(2, 16),
    ];
    const transforms = packedTransforms();
    const pipelines = [pipeline("pipeline:unlit")];
    const baseBindGroups = bindGroups("material:trees");
    const packing = prepareDrawOrderTransformPacking({
      device,
      packages: { packages, diagnostics: [], summary: {} } as never,
      transforms,
      pipelines,
      bindGroups: baseBindGroups,
      cache: createDrawOrderTransformBufferCache(),
      scratch: createDrawOrderTransformPackingScratch(),
    });

    expect(packing).not.toBeNull();
    expect(packages.map((draw) => draw.transformPackedOffset)).toEqual([
      0, 16, 32,
    ]);
    expect(
      packages.map((draw) =>
        packing?.worldTransformResourceKeyByRenderId.get(draw.renderId),
      ),
    ).toEqual([
      "world-transform-buffer:WorldTransforms/draw-order",
      "world-transform-buffer:WorldTransforms/draw-order",
      "world-transform-buffer:WorldTransforms/draw-order",
    ]);
    expect(device.buffers).toHaveLength(1);
    expect(device.buffers[0]?.descriptor).toMatchObject({
      label: "WorldTransforms/draw-order",
      size: 3 * MATRIX_FLOATS * Float32Array.BYTES_PER_ELEMENT,
    });
    expect(device.writes).toHaveLength(1);
    expect(writeFloats(device.writes[0]).slice(0, 6)).toEqual([
      300, 301, 302, 303, 304, 305,
    ]);
    expect(
      writeFloats(device.writes[0]).slice(MATRIX_FLOATS, MATRIX_FLOATS + 6),
    ).toEqual([100, 101, 102, 103, 104, 105]);
    expect(
      writeFloats(device.writes[0]).slice(
        MATRIX_FLOATS * 2,
        MATRIX_FLOATS * 2 + 6,
      ),
    ).toEqual([200, 201, 202, 203, 204, 205]);

    const drawCommandScratch = createDrawCommandDescriptorScratch();
    const drawCommands = writeDrawCommandDescriptors(
      packages,
      [meshResource()],
      drawCommandScratch,
      {
        ...(packing === null
          ? {}
          : {
              worldTransformResourceKeyByRenderId:
                packing.worldTransformResourceKeyByRenderId,
            }),
      },
    );
    const drawList = writeRenderPassDrawList(
      {
        drawCommands: drawCommands.descriptors,
        pipelines,
        bindGroups: packing?.bindGroups ?? baseBindGroups,
      },
      createRenderPassDrawListScratch(),
    );
    const drawOrderBindGroup = packing?.bindGroups.find((bindGroup) =>
      bindGroup.entryResourceKeys.includes(
        DRAW_ORDER_WORLD_TRANSFORM_BIND_GROUP_SCOPE_KEY,
      ),
    );

    expect(drawCommandScratch.diagnostics).toEqual([]);
    expect(drawList.valid).toBe(true);
    expect(drawList.draws).toMatchObject([
      {
        renderId: 3,
        meshResourceKey: "mesh:tree",
        materialResourceKey: "material:trees",
        transformPackedOffset: 0,
        instanceCount: 3,
      },
    ]);
    expect(drawList.draws[0]?.bindGroupKeys[1]).toBe(
      drawOrderBindGroup?.resourceKey,
    );
  });

  it("reuses the draw-order transform buffer without rewriting identical matrix bytes", () => {
    const device = fakeDevice();
    const cache = createDrawOrderTransformBufferCache();
    const scratch = createDrawOrderTransformPackingScratch();
    const transforms = packedTransforms();
    const pipelines = [pipeline("pipeline:unlit")];
    const baseBindGroups = bindGroups("material:trees");

    const first = prepareDrawOrderTransformPacking({
      device,
      packages: {
        packages: [drawPackage(3, 32), drawPackage(1, 0), drawPackage(2, 16)],
        diagnostics: [],
        summary: {},
      } as never,
      transforms,
      pipelines,
      bindGroups: baseBindGroups,
      cache,
      scratch,
    });
    const second = prepareDrawOrderTransformPacking({
      device,
      packages: {
        packages: [drawPackage(3, 32), drawPackage(1, 0), drawPackage(2, 16)],
        diagnostics: [],
        summary: {},
      } as never,
      transforms,
      pipelines,
      bindGroups: baseBindGroups,
      cache,
      scratch,
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(device.buffers).toHaveLength(1);
    expect(device.writes).toHaveLength(1);
  });

  it("rewrites the draw-order transform buffer when matrix bytes change", () => {
    const device = fakeDevice();
    const cache = createDrawOrderTransformBufferCache();
    const scratch = createDrawOrderTransformPackingScratch();
    const pipelines = [pipeline("pipeline:unlit")];
    const baseBindGroups = bindGroups("material:trees");
    const transforms = packedTransforms();
    const moved = packedTransforms();

    moved.data[32 + 12] = 999;

    prepareDrawOrderTransformPacking({
      device,
      packages: {
        packages: [drawPackage(3, 32), drawPackage(1, 0), drawPackage(2, 16)],
        diagnostics: [],
        summary: {},
      } as never,
      transforms,
      pipelines,
      bindGroups: baseBindGroups,
      cache,
      scratch,
    });
    prepareDrawOrderTransformPacking({
      device,
      packages: {
        packages: [drawPackage(3, 32), drawPackage(1, 0), drawPackage(2, 16)],
        diagnostics: [],
        summary: {},
      } as never,
      transforms: moved,
      pipelines,
      bindGroups: baseBindGroups,
      cache,
      scratch,
    });

    expect(device.buffers).toHaveLength(1);
    expect(device.writes).toHaveLength(2);
    expect(writeFloats(device.writes[1]).slice(12, 14)).toEqual([999, 313]);
  });

  it.each([
    ["transparent", { queue: "transparent" as const }],
    ["alpha-test", { queue: "alpha-test" as const }],
    ["skinned", { skinned: true, boneMatrixOffset: 0, boneMatrixCount: 4 }],
    ["morphed", { morphed: true, morphDeltaOffset: 0, morphTargetCount: 2 }],
    ["occlusion query", { occlusionQuery: true }],
    ["instance tint", { instanceTintOffset: 0 }],
    ["custom instance attributes", { instanceAttributePacketIndex: 0 }],
  ])("does not repack %s draw packages", (_name, overrides) => {
    const packages = [
      drawPackage(1, 0, overrides),
      drawPackage(2, 32, overrides),
    ];
    const packing = prepareDrawOrderTransformPacking({
      device: fakeDevice(),
      packages: { packages, diagnostics: [], summary: {} } as never,
      transforms: packedTransforms(),
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:trees"),
      cache: createDrawOrderTransformBufferCache(),
      scratch: createDrawOrderTransformPackingScratch(),
    });

    expect(packing).toBeNull();
    expect(packages.map((draw) => draw.transformPackedOffset)).toEqual([0, 32]);
  });

  it("does not repack packages with different resolved pipeline keys", () => {
    const packages = [drawPackage(1, 0), drawPackage(2, 16)];
    const packing = prepareDrawOrderTransformPacking({
      device: fakeDevice(),
      packages: { packages, diagnostics: [], summary: {} } as never,
      transforms: packedTransforms(),
      pipelines: [pipeline("pipeline:unlit:a"), pipeline("pipeline:unlit:b")],
      pipelineKeysByRenderId: new Map([
        [1, "pipeline:unlit:a"],
        [2, "pipeline:unlit:b"],
      ]),
      bindGroups: bindGroups("material:trees"),
      cache: createDrawOrderTransformBufferCache(),
      scratch: createDrawOrderTransformPackingScratch(),
    });

    expect(packing).toBeNull();
    expect(packages.map((draw) => draw.transformPackedOffset)).toEqual([0, 16]);
  });

  it("does not repack packages with different transform winding", () => {
    const packages = [drawPackage(1, 0), drawPackage(2, 16)];
    const packing = prepareDrawOrderTransformPacking({
      device: fakeDevice(),
      packages: { packages, diagnostics: [], summary: {} } as never,
      transforms: packedScaleTransforms([-1, 1]),
      pipelines: [pipeline("pipeline:unlit")],
      bindGroups: bindGroups("material:trees"),
      cache: createDrawOrderTransformBufferCache(),
      scratch: createDrawOrderTransformPackingScratch(),
    });

    expect(packing).toBeNull();
    expect(packages.map((draw) => draw.transformPackedOffset)).toEqual([0, 16]);
  });
});

function drawPackage(
  renderId: number,
  transformPackedOffset: number,
  overrides: Partial<MeshDrawPacket> & {
    readonly queue?: RenderQueue;
    readonly skinned?: boolean;
    readonly morphed?: boolean;
  } = {},
): RenderWorldDrawPackage {
  const queue = overrides.queue ?? "opaque";
  const skinned = overrides.skinned ?? false;
  const morphed = overrides.morphed ?? false;
  const batchKey: BatchCompatibilityKey = {
    pipelineKey: "pipeline:unlit",
    materialKey: "material:trees",
    meshLayoutKey: "mesh-layout:tree",
    topology: "triangle-list",
    instanced: false,
    skinned,
    morphed,
  };
  const packet: MeshDrawPacket = {
    renderId,
    entity: { index: renderId, generation: 1 },
    mesh: createMeshHandle("tree"),
    material: createMaterialHandle("trees"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: transformPackedOffset,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: sortKey(renderId, queue),
    batchKey,
    ...overrides,
  };

  return {
    renderId,
    packet,
    batchKey,
    meshResourceKey: "mesh:tree",
    materialResourceKey: "material:trees",
    transformPackedOffset,
  } as RenderWorldDrawPackage;
}

function sortKey(renderId: number, queue: RenderQueue): RenderSortKey {
  return {
    queue,
    viewId: 0,
    layer: 0,
    order: 0,
    pipelineKey: "pipeline:unlit",
    materialKey: "material:trees",
    meshKey: "mesh:tree",
    depth: 0,
    stableId: renderId,
  };
}

function packedTransforms(): PackedSnapshotTransforms {
  const data = new Float32Array(3 * MATRIX_FLOATS);

  fillMatrix(data, 0, 100);
  fillMatrix(data, MATRIX_FLOATS, 200);
  fillMatrix(data, MATRIX_FLOATS * 2, 300);

  return {
    data,
    floatCount: data.length,
    offsets: [
      { renderId: 1, sourceOffset: 0, packedOffset: 0 },
      { renderId: 2, sourceOffset: 16, packedOffset: 16 },
      { renderId: 3, sourceOffset: 32, packedOffset: 32 },
    ],
    diagnostics: [],
  };
}

function fillMatrix(data: Float32Array, offset: number, base: number): void {
  for (let index = 0; index < MATRIX_FLOATS; index += 1) {
    data[offset + index] = base + index;
  }
}

function packedScaleTransforms(
  scales: readonly number[],
): PackedSnapshotTransforms {
  const data = new Float32Array(scales.length * MATRIX_FLOATS);

  for (const [matrixIndex, scale] of scales.entries()) {
    const offset = matrixIndex * MATRIX_FLOATS;

    data[offset] = scale;
    data[offset + 5] = 1;
    data[offset + 10] = 1;
    data[offset + 15] = 1;
  }

  return {
    data,
    floatCount: data.length,
    offsets: scales.map((_scale, index) => ({
      renderId: index + 1,
      sourceOffset: index * MATRIX_FLOATS,
      packedOffset: index * MATRIX_FLOATS,
    })),
    diagnostics: [],
  };
}

function meshResource(): MeshGpuBufferResource {
  return {
    resourceKey: "mesh:tree",
    vertexBuffers: [
      {
        resourceKey: "mesh:tree/positions",
        streamId: "POSITION",
        buffer: { kind: "vertex-buffer" },
        vertexCount: 36,
      },
    ],
    indexBuffer: {
      resourceKey: "mesh:tree/indices",
      buffer: { kind: "index-buffer" },
      format: "uint32",
      indexCount: 36,
    },
    vertexCount: 36,
  } as unknown as MeshGpuBufferResource;
}

function pipeline(key: string): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key,
    pipeline: {
      getBindGroupLayout(group: number) {
        return { group };
      },
    },
    diagnostics: [],
  };
}

function bindGroups(materialResourceKey: string): UnlitBindGroupResource[] {
  return [
    {
      group: 0,
      resourceKey: "bind:view",
      layoutKey: "layout:view",
      bindGroup: { kind: "view-bind-group" },
      entryResourceKeys: ["view-uniform-buffer:main"],
    },
    {
      group: 1,
      resourceKey: "bind:world-transforms",
      layoutKey: "layout:world-transforms",
      bindGroup: { kind: "world-transform-bind-group" },
      entryResourceKeys: ["world-transform-buffer:frame"],
    },
    {
      group: 2,
      resourceKey: "bind:material:trees",
      layoutKey: "layout:material",
      bindGroup: { kind: "material-bind-group" },
      entryResourceKeys: [materialResourceKey],
    },
  ];
}

interface FakeBuffer {
  readonly descriptor: unknown;
  destroyed: boolean;
  destroy(): void;
}

interface FakeWrite {
  readonly buffer: unknown;
  readonly bytes: Uint8Array;
}

function fakeDevice() {
  const buffers: FakeBuffer[] = [];
  const writes: FakeWrite[] = [];
  const bindGroups: unknown[] = [];

  return {
    buffers,
    writes,
    bindGroups,
    createBuffer(descriptor: unknown) {
      const buffer: FakeBuffer = {
        descriptor,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
      };

      buffers.push(buffer);
      return buffer;
    },
    queue: {
      writeBuffer(
        buffer: unknown,
        _bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        dataOffset = 0,
        size?: number,
      ) {
        const source =
          ArrayBuffer.isView(data) === true
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : new Uint8Array(data as ArrayBuffer);
        const byteLength = size ?? source.byteLength - dataOffset;

        writes.push({
          buffer,
          bytes: source.slice(dataOffset, dataOffset + byteLength),
        });
      },
    },
    createBindGroup(descriptor: unknown) {
      const bindGroup = { descriptor };

      bindGroups.push(bindGroup);
      return bindGroup;
    },
  };
}

function writeFloats(write: FakeWrite | undefined): number[] {
  if (write === undefined) {
    return [];
  }

  return [...new Float32Array(write.bytes.buffer)];
}
