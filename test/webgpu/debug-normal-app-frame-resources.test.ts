import { describe, expect, it } from "vitest";

import { PACKED_VIEW_UNIFORM_FLOAT_STRIDE } from "@aperture-engine/core";
import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import {
  createDebugNormalMaterialAsset,
  createDebugNormalMaterialBindGroupLayoutPlan,
  createOrReuseDebugNormalAppFrameResources,
  createPlaneMeshAsset,
  createPreparedDebugNormalMaterialCache,
  createPreparedMeshGpuResourceCache,
  type DebugNormalAppFrameResourceReuseReport,
  type DebugNormalFrameGpuResourceDeviceLike,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type UnlitBindGroupLayoutResource,
} from "@aperture-engine/webgpu";

describe("debug-normal app frame-resource cache", () => {
  it("creates first-frame resources and records creation counters", () => {
    const writes: unknown[] = [];
    const bindGroups: unknown[] = [];
    const reuse = reuseCounters();
    const registry = new AssetRegistry();
    const materialHandle = createMaterialHandle("debug-normal-app-material");
    registry.register(materialHandle);
    const materialEntry = registry.markReady(
      materialHandle,
      createDebugNormalMaterialAsset({
        label: "Debug Normal App Material",
      }),
    );
    const result = createOrReuseDebugNormalAppFrameResources({
      device: deviceWithResources(writes, bindGroups),
      cache: { current: null },
      mesh: createPlaneMeshAsset({ label: "Debug Normal App Quad" }),
      meshHandle: createMeshHandle("debug-normal-app-quad"),
      meshKey: "mesh:debug-normal-app-quad@1",
      material: required(materialEntry.asset),
      materialHandle,
      materialKey: `${assetHandleKey(materialHandle)}@${materialEntry.version}`,
      sourceMaterialKey: assetHandleKey(materialHandle),
      pipelineKey: "debug-normal|opaque|back|less|none",
      assets: registry,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedDebugNormalMaterials: createPreparedDebugNormalMaterialCache(),
      reuse,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources?.bindGroups.map((group) => group.group)).toEqual([
      0, 1, 2,
    ]);
    expect(reuse).toMatchObject({
      meshBuffersCreated: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      bindGroupsCreated: 3,
    });
    expect(writes).toHaveLength(5);
    expect(bindGroups).toHaveLength(3);
  });

  it("reuses same-key resources and updates dynamic buffers in place", () => {
    const writes: unknown[] = [];
    const bindGroups: unknown[] = [];
    const cache = { current: null };
    const reuse = reuseCounters();
    const device = deviceWithResources(writes, bindGroups);
    const registry = new AssetRegistry();
    const materialHandle = createMaterialHandle("debug-normal-reuse-material");
    registry.register(materialHandle);
    const materialEntry = registry.markReady(
      materialHandle,
      createDebugNormalMaterialAsset({
        label: "Debug Normal Reuse Material",
      }),
    );
    const baseOptions = {
      device,
      cache,
      mesh: createPlaneMeshAsset({ label: "Debug Normal Reuse Quad" }),
      meshHandle: createMeshHandle("debug-normal-reuse-quad"),
      meshKey: "mesh:debug-normal-reuse-quad@1",
      material: required(materialEntry.asset),
      materialHandle,
      materialKey: `${assetHandleKey(materialHandle)}@${materialEntry.version}`,
      sourceMaterialKey: assetHandleKey(materialHandle),
      pipelineKey: "debug-normal|opaque|back|less|none",
      assets: registry,
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedDebugNormalMaterials: createPreparedDebugNormalMaterialCache(),
      reuse,
    };
    const first = createOrReuseDebugNormalAppFrameResources({
      ...baseOptions,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
    });

    writes.length = 0;
    bindGroups.length = 0;

    const second = createOrReuseDebugNormalAppFrameResources({
      ...baseOptions,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
    });

    expect(second).toBe(first);
    expect(second.valid).toBe(true);
    expect(second.resources?.materialBindGroup).toBe(
      first.resources?.materialBindGroup,
    );
    expect(reuse).toMatchObject({
      meshBuffersCreated: 1,
      meshBuffersReused: 1,
      preparedMeshBuffersCreated: 1,
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBindGroupsCreated: 1,
      bindGroupsCreated: 3,
      bindGroupsReused: 3,
      dynamicBufferWrites: 2,
    });
    expect(writes).toHaveLength(2);
    expect(bindGroups).toHaveLength(0);
    expect(second.resources?.viewUniform.views).toHaveLength(1);
    expect(second.resources?.worldTransforms.offsets).toHaveLength(1);
  });

  it("reuses prepared material resources across mesh-only frame cache misses", () => {
    const writes: unknown[] = [];
    const bindGroups: unknown[] = [];
    const cache = { current: null };
    const reuse = reuseCounters();
    const preparedDebugNormalMaterials =
      createPreparedDebugNormalMaterialCache();
    const registry = new AssetRegistry();
    const materialHandle = createMaterialHandle("debug-normal-cross-mesh");
    registry.register(materialHandle);
    const materialEntry = registry.markReady(
      materialHandle,
      createDebugNormalMaterialAsset({
        label: "Debug Normal Cross Mesh Material",
      }),
    );
    const baseOptions = {
      device: deviceWithResources(writes, bindGroups),
      cache,
      mesh: createPlaneMeshAsset({ label: "Debug Normal Cross Mesh Quad" }),
      meshHandle: createMeshHandle("debug-normal-cross-mesh-quad"),
      material: required(materialEntry.asset),
      materialHandle,
      materialKey: `${assetHandleKey(materialHandle)}@${materialEntry.version}`,
      sourceMaterialKey: assetHandleKey(materialHandle),
      pipelineKey: "debug-normal|opaque|back|less|none",
      assets: registry,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
      preparedMeshes: createPreparedMeshGpuResourceCache(),
      preparedDebugNormalMaterials,
      reuse,
    };
    const first = createOrReuseDebugNormalAppFrameResources({
      ...baseOptions,
      meshKey: "mesh:debug-normal-cross-mesh-quad@1",
    });
    const second = createOrReuseDebugNormalAppFrameResources({
      ...baseOptions,
      meshKey: "mesh:debug-normal-cross-mesh-quad@2",
    });

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    expect(second.resources?.material).toBe(first.resources?.material);
    expect(second.resources?.materialBindGroup).toBe(
      first.resources?.materialBindGroup,
    );
    expect(preparedDebugNormalMaterials.resources.size).toBe(1);
    expect(reuse).toMatchObject({
      materialBuffersCreated: 1,
      materialBuffersReused: 1,
      preparedMaterialBuffersCreated: 1,
      preparedMaterialBuffersReused: 1,
      preparedMaterialBindGroupsCreated: 1,
      preparedMaterialBindGroupsReused: 1,
      bindGroupsCreated: 5,
      bindGroupsReused: 1,
    });
    expect(bindGroups).toHaveLength(5);
  });
});

function packedViews(count: number): PackedSnapshotViewUniforms {
  return {
    data: identityViewUniforms(count),
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index + 1,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

function packedTransforms(count: number): PackedSnapshotTransforms {
  return {
    data: identityMatrices(count),
    offsets: Array.from({ length: count }, (_, index) => ({
      renderId: index + 7,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

function identityMatrices(count: number): Float32Array {
  const data = new Float32Array(count * 16);

  for (let index = 0; index < count; index += 1) {
    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], index * 16);
  }

  return data;
}

function identityViewUniforms(count: number): Float32Array {
  const data = new Float32Array(count * PACKED_VIEW_UNIFORM_FLOAT_STRIDE);

  for (let index = 0; index < count; index += 1) {
    const offset = index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE;

    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], offset);
    data.set([index, 0, 1, 1], offset + 16);
  }

  return data;
}

function sharedLayoutResources(): UnlitBindGroupLayoutResource[] {
  return [
    { group: 0, layoutKey: "layout:0", layout: { group: 0 } },
    { group: 1, layoutKey: "layout:1", layout: { group: 1 } },
  ];
}

function materialLayoutResource() {
  return {
    group: 2,
    layoutKey: "debug-normal/group-2",
    layout: { group: 2 },
    descriptor: createDebugNormalMaterialBindGroupLayoutPlan().layout,
  };
}

function reuseCounters(): DebugNormalAppFrameResourceReuseReport {
  return {
    meshBuffersCreated: 0,
    meshBuffersReused: 0,
    preparedMeshBuffersCreated: 0,
    preparedMeshBuffersReused: 0,
    materialBuffersCreated: 0,
    materialBuffersReused: 0,
    preparedMaterialBuffersCreated: 0,
    preparedMaterialBuffersReused: 0,
    preparedMaterialBindGroupsCreated: 0,
    preparedMaterialBindGroupsReused: 0,
    bindGroupsCreated: 0,
    bindGroupsReused: 0,
    dynamicBufferWrites: 0,
  };
}

function deviceWithResources(
  writes: unknown[],
  bindGroups: unknown[],
): DebugNormalFrameGpuResourceDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        writes.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createBindGroup: (descriptor) => {
      bindGroups.push(descriptor);
      return { descriptor };
    },
  };
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected ready test asset.");
  }

  return value;
}
