import { describe, expect, it } from "vitest";

import {
  PACKED_LIGHT_FLOAT_STRIDE,
  PACKED_LIGHT_METADATA_STRIDE,
  DEFAULT_LIGHT_BUFFER_RESOURCE_KEY,
  DEFAULT_LIGHT_BUFFER_USAGE,
  PackedLightKindId,
  createLightBufferDescriptor,
  createLightBufferDescriptorPlan,
  createLightGpuBuffers,
  packLightPackets,
  packedLightKindId,
  type LightPacket,
  type RenderSnapshot,
  type WebGpuBufferDeviceLike,
} from "../../src/index.js";

describe("light packet packing", () => {
  it("packs light packet float and metadata fields in packet order", () => {
    const lights = [
      light("ambient", 1),
      light("directional", 2),
      light("point", 3),
      light("spot", 4),
    ];

    const packed = packLightPackets(lights);

    expect(packed.count).toBe(4);
    expect(packed.floatStride).toBe(PACKED_LIGHT_FLOAT_STRIDE);
    expect(packed.metadataStride).toBe(PACKED_LIGHT_METADATA_STRIDE);
    expect(Array.from(packed.floats.slice(0, 8))).toEqual([
      1, 0.5, 0.25, 1, 10, 20, 0.125, 0.25,
    ]);
    expect(metadataColumn(packed.metadata, 0)).toEqual([
      PackedLightKindId.Ambient,
      PackedLightKindId.Directional,
      PackedLightKindId.Point,
      PackedLightKindId.Spot,
    ]);
    expect(metadataColumn(packed.metadata, 1)).toEqual([16, 32, 48, 64]);
    expect(metadataColumn(packed.metadata, 2)).toEqual([2, 4, 8, 16]);
    expect(metadataColumn(packed.metadata, 3)).toEqual([101, 102, 103, 104]);
  });

  it("packs snapshot lights without reading ECS state", () => {
    const packed = packLightPackets(snapshot([light("directional", 5)]));

    expect(packed.count).toBe(1);
    expect(Array.from(packed.metadata)).toEqual([
      PackedLightKindId.Directional,
      80,
      32,
      105,
      5,
      0,
    ]);
  });

  it("returns stable empty typed arrays for snapshots without lights", () => {
    const packed = packLightPackets([]);

    expect(packed.count).toBe(0);
    expect(packed.floats).toBeInstanceOf(Float32Array);
    expect(packed.metadata).toBeInstanceOf(Int32Array);
    expect(packed.floats).toHaveLength(0);
    expect(packed.metadata).toHaveLength(0);
  });

  it("creates renderer-owned light buffer descriptors without GPU buffers", () => {
    const packed = packLightPackets([light("directional", 2)]);
    const descriptor = createLightBufferDescriptor(packed, {
      resourceKey: "light-buffer:test",
    });

    expect(descriptor).toMatchObject({
      resourceKey: "light-buffer:test",
      usageIntent: "read-only-storage",
      count: 1,
      floatByteLength:
        PACKED_LIGHT_FLOAT_STRIDE * Float32Array.BYTES_PER_ELEMENT,
      metadataByteLength:
        PACKED_LIGHT_METADATA_STRIDE * Int32Array.BYTES_PER_ELEMENT,
      byteLength:
        PACKED_LIGHT_FLOAT_STRIDE * Float32Array.BYTES_PER_ELEMENT +
        PACKED_LIGHT_METADATA_STRIDE * Int32Array.BYTES_PER_ELEMENT,
    });
    expect(descriptor.packed).toBe(packed);
  });

  it("creates valid no-op descriptors for empty light inputs", () => {
    const descriptor = createLightBufferDescriptor([]);

    expect(descriptor.resourceKey).toBe(DEFAULT_LIGHT_BUFFER_RESOURCE_KEY);
    expect(descriptor.count).toBe(0);
    expect(descriptor.byteLength).toBe(0);
    expect(descriptor.packed.floats).toHaveLength(0);
    expect(descriptor.packed.metadata).toHaveLength(0);
  });

  it("creates WebGPU buffer descriptor plans for non-empty light data", () => {
    const descriptor = createLightBufferDescriptor(
      [light("directional", 1), light("point", 2)],
      { resourceKey: "light-buffer:test" },
    );
    const result = createLightBufferDescriptorPlan(descriptor, {
      label: "TestLights",
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      resourceKey: "light-buffer:test",
      source: descriptor.packed,
      floatDescriptor: {
        label: "TestLights/floats",
        size: descriptor.floatByteLength,
        usage: DEFAULT_LIGHT_BUFFER_USAGE,
      },
      metadataDescriptor: {
        label: "TestLights/metadata",
        size: descriptor.metadataByteLength,
        usage: DEFAULT_LIGHT_BUFFER_USAGE,
      },
    });
    expect(result.plan?.floatDescriptor.initialData).toBe(
      descriptor.packed.floats,
    );
    expect(result.plan?.metadataDescriptor.initialData).toBe(
      descriptor.packed.metadata,
    );
  });

  it("treats empty light buffer descriptor plans as valid no-ops", () => {
    const result = createLightBufferDescriptorPlan(
      createLightBufferDescriptor([]),
    );

    expect(result).toEqual({
      valid: true,
      plan: null,
      diagnostics: [],
    });
  });

  it("diagnoses invalid light buffer usage flags", () => {
    const result = createLightBufferDescriptorPlan(
      createLightBufferDescriptor([light("spot", 3)]),
      { usage: 0 },
    );

    expect(result.plan).toBeNull();
    expect(result.diagnostics).toEqual([
      {
        code: "lightBufferDescriptor.invalidUsageFlags",
        field: "usage",
        message: "Light buffer usage flags must be a positive integer.",
      },
    ]);
  });

  it("creates injected light GPU buffer resources from descriptor plans", () => {
    const created: unknown[] = [];
    const plan = required(
      createLightBufferDescriptorPlan(
        createLightBufferDescriptor([light("directional", 1)]),
      ).plan,
    );
    const result = createLightGpuBuffers({
      device: deviceWithBuffers(created),
      plan,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "light-buffer:main",
      floatResourceKey: "light-buffer:main/floats",
      metadataResourceKey: "light-buffer:main/metadata",
      count: 1,
    });
    expect(created).toHaveLength(2);
  });

  it("diagnoses null and failed light GPU buffer creation", () => {
    const plan = required(
      createLightBufferDescriptorPlan(
        createLightBufferDescriptor([light("spot", 3)]),
      ).plan,
    );
    const invalidPlan = {
      ...plan,
      floatDescriptor: { ...plan.floatDescriptor, size: 0 },
    };

    expect(
      createLightGpuBuffers({
        device: deviceWithBuffers([]),
        plan: null,
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "lightGpuBuffer.nullDescriptorPlan" }],
    });
    expect(
      createLightGpuBuffers({
        device: deviceWithBuffers([]),
        plan: invalidPlan,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["lightGpuBuffer.creationFailed"]);
  });

  it("maps all light kinds to stable numeric ids", () => {
    expect(
      ["ambient", "directional", "point", "spot", "environment"].map((kind) =>
        packedLightKindId(kind as LightPacket["kind"]),
      ),
    ).toEqual([0, 1, 2, 3, 4]);
  });
});

function light(kind: LightPacket["kind"], seed: number): LightPacket {
  return {
    lightId: 100 + seed,
    entity: { index: seed, generation: 0 },
    kind,
    color: [1, 0.5, 0.25, 1],
    intensity: 10 * seed,
    range: 20 * seed,
    innerConeAngle: 0.125 * seed,
    outerConeAngle: 0.25 * seed,
    worldTransformOffset: 16 * seed,
    layerMask: 1 << seed,
  };
}

function deviceWithBuffers(created: unknown[]): WebGpuBufferDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        created.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => ({ descriptor }),
  };
}

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}

function snapshot(
  lights: readonly LightPacket[],
): Pick<RenderSnapshot, "lights"> {
  return { lights };
}

function metadataColumn(values: Int32Array, column: number): number[] {
  const result: number[] = [];

  for (
    let offset = column;
    offset < values.length;
    offset += PACKED_LIGHT_METADATA_STRIDE
  ) {
    result.push(values[offset] ?? 0);
  }

  return result;
}
