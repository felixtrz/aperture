import { describe, expect, it } from "vitest";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import { createMorphInstanceDescriptorBufferDescriptor } from "@aperture-engine/webgpu/test-support";

describe("morph instance descriptor GPU buffer", () => {
  it("repacks world-offset snapshot descriptors to packed render instance slots", () => {
    const draw = morphedDraw({ renderId: 9, worldTransformOffset: 16 });
    const descriptor = createMorphInstanceDescriptorBufferDescriptor(
      snapshotWithMorphInstanceDescriptors([
        0,
        0,
        0,
        0, // source transform slot 0 has no morph data.
        7,
        3,
        11,
        24, // source transform slot 1 is the morphed draw.
      ]),
      draw,
      {
        transformOffsets: [{ renderId: 9, sourceOffset: 16, packedOffset: 0 }],
      },
    );

    expect(descriptor.valid).toBe(true);
    expect(descriptor.diagnostics).toEqual([]);
    expect(Array.from(descriptor.plan?.source ?? [])).toEqual([7, 3, 11, 24]);
    expect(descriptor.plan).toMatchObject({
      renderId: 9,
      instanceCount: 1,
      descriptor: {
        size: 4 * 4,
        initialData: new Uint32Array([7, 3, 11, 24]),
      },
    });
  });

  it("diagnoses a missing packed transform offset for a morphed draw", () => {
    const descriptor = createMorphInstanceDescriptorBufferDescriptor(
      snapshotWithMorphInstanceDescriptors([0, 0, 0, 0, 7, 3, 11, 24]),
      morphedDraw({ renderId: 9, worldTransformOffset: 16 }),
      {
        transformOffsets: [{ renderId: 8, sourceOffset: 16, packedOffset: 0 }],
      },
    );

    expect(descriptor.valid).toBe(false);
    expect(descriptor.plan).toBeNull();
    expect(descriptor.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "morphInstanceDescriptorBuffer.missingData",
          renderId: 9,
          field: "transformOffsets",
        }),
      ]),
    );
  });
});

function snapshotWithMorphInstanceDescriptors(
  values: readonly number[],
): Pick<RenderSnapshot, "morphInstanceDescriptors"> {
  return { morphInstanceDescriptors: new Uint32Array(values) };
}

function morphedDraw(overrides: Partial<MeshDrawPacket> = {}): MeshDrawPacket {
  return {
    renderId: overrides.renderId ?? 1,
    entity: { index: 1, generation: 0 },
    mesh: createMeshHandle("morphed"),
    material: createMaterialHandle("standard"),
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: overrides.worldTransformOffset ?? 0,
    morphWeightOffset: overrides.morphWeightOffset ?? 0,
    morphTargetCount: overrides.morphTargetCount ?? 3,
    morphDeltaOffset: overrides.morphDeltaOffset ?? 0,
    morphVertexCount: overrides.morphVertexCount ?? 24,
    batchKey: {
      pipelineKey: "standard|morphed|opaque|back|less|none",
      materialKey: "material:standard",
      meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: true,
    },
    sortKey: {
      queue: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: "standard|morphed|opaque|back|less|none",
      materialKey: "material:standard",
      meshKey: "mesh:morphed",
      depth: 0,
      stableId: 1,
    },
    vertexStart: 0,
    vertexCount: 24,
    indexStart: 0,
    indexCount: 36,
    layerMask: 1,
    boundsIndex: 0,
    ...overrides,
  };
}
