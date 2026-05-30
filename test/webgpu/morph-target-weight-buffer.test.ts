import { describe, expect, it } from "vitest";
import {
  createMaterialHandle,
  createMeshHandle,
} from "@aperture-engine/simulation";
import type { MeshDrawPacket, RenderSnapshot } from "@aperture-engine/render";
import {
  createMorphTargetWeightBufferDescriptor,
  createMorphTargetWeightGpuBuffer,
  DEFAULT_MORPH_TARGET_WEIGHT_BUFFER_USAGE,
  morphTargetWeightBufferResourceKeyForRenderId,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu/test-support";

describe("morph target weight GPU buffer", () => {
  it("uploads the whole flat N-weight buffer and validates the draw's slice", () => {
    // Two morphed instances: instance 0 has 3 weights at offset 0, instance 1
    // has 5 weights at offset 3 — an unbounded per-instance count, not a vec4.
    const draw = morphedDraw({
      renderId: 9,
      worldTransformOffset: 16,
      morphWeightOffset: 3,
      morphTargetCount: 5,
    });
    // float32-exact values so the round-trip compares deeply.
    const snapshot = snapshotWithMorphWeights([
      1, 0.5, 0.25, 0.75, 0.5, 0.25, 0.125, 0.5,
    ]);
    const descriptor = createMorphTargetWeightBufferDescriptor(snapshot, draw);

    expect(descriptor.valid).toBe(true);
    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan).toMatchObject({
      renderId: 9,
      weightCount: 8,
      descriptor: {
        label: "MorphTargetWeights/render:9",
        size: 8 * 4,
        usage: DEFAULT_MORPH_TARGET_WEIGHT_BUFFER_USAGE,
      },
    });
    expect(Array.from(descriptor.plan?.source ?? [])).toEqual([
      1, 0.5, 0.25, 0.75, 0.5, 0.25, 0.125, 0.5,
    ]);
  });

  it("creates a draw-scoped GPU resource key after upload", () => {
    const buffer = { label: "morph-weight-buffer" };
    const writes: unknown[] = [];
    const device: WebGpuBufferDeviceLike = {
      queue: {
        writeBuffer: (target, offset, source, dataOffset, size) => {
          writes.push({ target, offset, source, dataOffset, size });
        },
      },
      createBuffer: () => buffer,
    };
    const descriptor = createMorphTargetWeightBufferDescriptor(
      snapshotWithMorphWeights([1, 0, 0]),
      morphedDraw({ renderId: 5, morphWeightOffset: 0, morphTargetCount: 3 }),
    );
    const resource = createMorphTargetWeightGpuBuffer({
      device,
      plan: descriptor.plan,
    });

    expect(resource).toMatchObject({
      valid: true,
      resource: {
        resourceKey: morphTargetWeightBufferResourceKeyForRenderId(5),
        buffer,
        renderId: 5,
        weightCount: 3,
      },
      diagnostics: [],
    });
    expect(writes).toHaveLength(1);
  });

  it("diagnoses non-morphed draws and out-of-range weight slices", () => {
    const notMorphed = createMorphTargetWeightBufferDescriptor(
      snapshotWithMorphWeights([0, 0, 0, 0]),
      morphedDraw({
        renderId: 2,
        morphWeightOffset: 0,
        morphTargetCount: 4,
        batchKey: {
          ...morphedDraw().batchKey,
          morphed: false,
        },
      }),
    );
    const missing = createMorphTargetWeightBufferDescriptor(
      snapshotWithMorphWeights([0, 0]),
      morphedDraw({ renderId: 3, morphWeightOffset: 1, morphTargetCount: 4 }),
    );

    expect(notMorphed.valid).toBe(false);
    expect(notMorphed.plan).toBeNull();
    expect(notMorphed.diagnostics).toMatchObject([
      {
        code: "morphTargetWeightBuffer.notMorphed",
        renderId: 2,
        field: "batchKey.morphed",
      },
    ]);
    expect(missing.valid).toBe(false);
    expect(missing.plan).toBeNull();
    expect(missing.diagnostics).toMatchObject([
      {
        code: "morphTargetWeightBuffer.missingData",
        renderId: 3,
        field: "morphTargetWeights",
      },
    ]);
  });
});

function snapshotWithMorphWeights(
  morphTargetWeights: readonly number[],
): Pick<RenderSnapshot, "morphTargetWeights"> {
  return { morphTargetWeights: new Float32Array(morphTargetWeights) };
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
    morphTargetCount: overrides.morphTargetCount ?? 2,
    morphDeltaOffset: overrides.morphDeltaOffset ?? 0,
    morphVertexCount: overrides.morphVertexCount ?? 3,
    boundsIndex: 0,
    layerMask: 1,
    sortKey: {
      queue: "opaque",
      viewId: 1,
      layer: 1,
      order: 0,
      pipelineKey: "standard|morphed|opaque|back|less|none",
      materialKey: "material:standard",
      meshKey: "mesh:morphed",
      depth: 0,
      stableId: overrides.renderId ?? 1,
    },
    batchKey: {
      pipelineKey: "standard|morphed|opaque|back|less|none",
      materialKey: "material:standard",
      meshLayoutKey:
        "POSITION,NORMAL,TEXCOORD_0,MORPH_POSITION_0,MORPH_NORMAL_0,MORPH_POSITION_1,MORPH_NORMAL_1",
      topology: "triangle-list",
      instanced: false,
      skinned: false,
      morphed: true,
    },
    ...overrides,
  };
}
