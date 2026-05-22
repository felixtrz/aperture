import { describe, expect, it } from "vitest";

import {
  createMaterialHandle,
  createMeshHandle,
  type MeshDrawPacket,
  type RenderSnapshot,
} from "@aperture-engine/core";
import {
  DEFAULT_SKINNING_JOINT_BUFFER_USAGE,
  createSkinningJointBufferDescriptor,
  createSkinningJointGpuBuffer,
  skinningJointBufferResourceKeyForRenderId,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";

describe("skinning joint matrix GPU buffer", () => {
  it("creates a storage buffer plan from a draw-scoped snapshot bone palette", () => {
    const draw = skinnedDraw({ renderId: 7, boneMatrixOffset: 16 });
    const snapshot = snapshotWithBones([
      ...identityMatrix(),
      ...translationMatrix(2, 0, 0),
    ]);
    const descriptor = createSkinningJointBufferDescriptor(snapshot, draw);

    expect(descriptor.valid).toBe(true);
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan).toMatchObject({
      renderId: 7,
      sourceOffset: 16,
      jointCount: 1,
      descriptor: {
        label: "SkinningJointMatrices/render:7",
        size: 64,
        usage: DEFAULT_SKINNING_JOINT_BUFFER_USAGE,
      },
    });
    expect(Array.from(descriptor.plan?.source ?? [])).toEqual(
      translationMatrix(2, 0, 0),
    );
  });

  it("creates a draw-scoped GPU resource key after upload", () => {
    const buffer = { label: "skin-buffer" };
    const writes: unknown[] = [];
    const device: WebGpuBufferDeviceLike = {
      queue: {
        writeBuffer: (target, offset, source, dataOffset, size) => {
          writes.push({ target, offset, source, dataOffset, size });
        },
      },
      createBuffer: () => buffer,
    };
    const descriptor = createSkinningJointBufferDescriptor(
      snapshotWithBones(identityMatrix()),
      skinnedDraw({ renderId: 3 }),
    );
    const resource = createSkinningJointGpuBuffer({
      device,
      plan: descriptor.plan,
    });

    expect(resource).toMatchObject({
      valid: true,
      resource: {
        resourceKey: skinningJointBufferResourceKeyForRenderId(3),
        buffer,
        renderId: 3,
        jointCount: 1,
        sourceOffset: 0,
      },
      diagnostics: [],
    });
    expect(writes).toHaveLength(1);
  });

  it("diagnoses skinned draws that reference missing bone matrix data", () => {
    const descriptor = createSkinningJointBufferDescriptor(
      snapshotWithBones(identityMatrix()),
      skinnedDraw({ renderId: 4, boneMatrixOffset: 16 }),
    );

    expect(descriptor.valid).toBe(false);
    expect(descriptor.plan).toBeNull();
    expect(descriptor.diagnostics).toMatchObject([
      {
        code: "skinningJointBuffer.missingData",
        renderId: 4,
        field: "bones",
      },
    ]);
  });
});

function snapshotWithBones(
  bones: readonly number[],
): Pick<RenderSnapshot, "bones"> {
  return { bones: new Float32Array(bones) };
}

function skinnedDraw(overrides: Partial<MeshDrawPacket> = {}): MeshDrawPacket {
  return {
    renderId: overrides.renderId ?? 1,
    entity: { index: 1, generation: 0 },
    mesh: createMeshHandle("skinned"),
    material: createMaterialHandle("standard"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boneMatrixOffset: overrides.boneMatrixOffset ?? 0,
    boneMatrixCount: overrides.boneMatrixCount ?? 1,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: {
      queue: "opaque",
      viewId: 1,
      layer: 1,
      order: 0,
      pipelineKey: "standard|skinned|opaque|back|less|none",
      materialKey: "material:standard",
      meshKey: "mesh:skinned",
      depth: 0,
      stableId: overrides.renderId ?? 1,
    },
    batchKey: {
      pipelineKey: "standard|skinned|opaque|back|less|none",
      materialKey: "material:standard",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0,JOINTS_0,WEIGHTS_0",
      topology: "triangle-list",
      instanced: false,
      skinned: true,
      morphed: false,
    },
    ...overrides,
  };
}

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function translationMatrix(x: number, y: number, z: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}
