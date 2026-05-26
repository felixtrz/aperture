import { describe, expect, it } from "vitest";
import { PACKED_VIEW_UNIFORM_FLOAT_STRIDE } from "@aperture-engine/render";
import {
  createDebugNormalFrameGpuResources,
  createDebugNormalMaterialAsset,
  createDebugNormalMaterialBindGroupLayoutPlan,
  createPlaneMeshAsset,
  type DebugNormalFrameGpuResourceDeviceLike,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type UnlitBindGroupLayoutResource,
} from "@aperture-engine/webgpu";

describe("debug-normal frame GPU resource assembly", () => {
  it("uploads shared frame resources and creates a debug-normal material bind group", () => {
    const writes: unknown[] = [];
    const bindGroups: unknown[] = [];
    const result = createDebugNormalFrameGpuResources({
      device: deviceWithResources(writes, bindGroups),
      mesh: createPlaneMeshAsset({ label: "Debug Normal Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      material: createDebugNormalMaterialAsset({
        label: "Debug Normals",
      }),
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      mesh: { resourceKey: "mesh-buffer:Debug Normal Quad" },
      viewUniform: {
        resourceKey: "view-uniform-buffer:ViewUniforms/uniform",
      },
      worldTransforms: {
        resourceKey: "world-transform-buffer:WorldTransforms/storage",
      },
      material: { resourceKey: "material-buffer:Debug Normals/uniform" },
      materialBindGroup: {
        group: 2,
        resourceKey:
          "bind-group:debug-normal/group-2/0:material-buffer:Debug Normals/uniform",
      },
    });
    expect(result.resources?.bindGroups.map((group) => group.group)).toEqual([
      0, 1, 2,
    ]);
    expect(writes).toHaveLength(5);
    expect(bindGroups).toHaveLength(3);
    expect(bindGroups.at(-1)).toMatchObject({
      label: "debug-normal/group-2",
      entries: [
        { binding: 0, resource: { buffer: expect.any(Object) as unknown } },
      ],
    });
  });

  it("reports missing required frame inputs without returning resources", () => {
    const result = createDebugNormalFrameGpuResources({
      device: deviceWithResources([], []),
      mesh: null,
      viewUniforms: null,
      worldTransforms: null,
      material: null,
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "debugNormalFrameResources.missingMesh",
      "debugNormalFrameResources.missingViewUniforms",
      "debugNormalFrameResources.missingWorldTransforms",
      "debugNormalFrameResources.missingMaterial",
      "unlitBindGroup.missingViewResource",
      "unlitBindGroup.missingTransformResource",
      "unlitBindGroupResource.invalidDescriptorPlan",
      "unlitBindGroupResource.skippedRequiredGroup",
      "unlitBindGroupResource.skippedRequiredGroup",
      "debugNormalMaterialBindGroupResource.nullDescriptorPlan",
    ]);
  });
});

function packedViews(): PackedSnapshotViewUniforms {
  return {
    data: identityViewUniforms(1),
    views: [{ viewId: 1, sourceOffset: 0, packedOffset: 0 }],
    diagnostics: [],
  };
}

function packedTransforms(): PackedSnapshotTransforms {
  return {
    data: identityMatrices(1),
    offsets: [{ renderId: 7, sourceOffset: 0, packedOffset: 0 }],
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
    data.set([0, 0, 1, 1], offset + 16);
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
