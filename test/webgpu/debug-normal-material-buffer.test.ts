import { describe, expect, it } from "vitest";

import {
  DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH,
  DEBUG_NORMAL_MATERIAL_UNIFORM_LAYOUT,
  DEBUG_NORMAL_MATERIAL_UNIFORM_WORDS,
  DEFAULT_DEBUG_NORMAL_MATERIAL_BUFFER_USAGE,
  createDebugNormalMaterialAsset,
  createDebugNormalMaterialBufferDescriptor,
  createDebugNormalMaterialGpuBuffer,
  createDebugNormalMaterialGpuPreparationPlan,
  createStandardMaterialAsset,
  debugNormalMaterialGpuBufferResourceToJsonValue,
  packDebugNormalMaterial,
  type PackedDebugNormalMaterial,
} from "@aperture-engine/webgpu/test-support";

describe("debug-normal material WebGPU uniform packing", () => {
  it("packs the shader mode uniform into the documented 16-byte layout", () => {
    const result = packDebugNormalMaterial(
      createDebugNormalMaterialAsset({ label: "Normals" }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.packed?.uniformLayout).toBe(
      DEBUG_NORMAL_MATERIAL_UNIFORM_LAYOUT,
    );
    expect(result.packed?.uniform.byteLength).toBe(
      DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH,
    );
    expect(result.packed?.uniformUint32.length).toBe(
      DEBUG_NORMAL_MATERIAL_UNIFORM_WORDS,
    );
    expect(Array.from(result.packed?.uniformUint32 ?? [])).toEqual([
      0, 0, 0, 0,
    ]);
    expect(result.packed?.dependencies).toEqual({});
  });

  it("plans a material buffer with a stable resource key", () => {
    const material = createDebugNormalMaterialAsset({ label: "Normals" });
    const packed = required(packDebugNormalMaterial(material).packed);
    const descriptor = createDebugNormalMaterialBufferDescriptor(packed, {
      label: "DebugNormalMaterial/Normals/uniform",
    });
    const preparation = createDebugNormalMaterialGpuPreparationPlan(material, {
      label: "DebugNormalMaterial/Normals/uniform",
    });

    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan).toMatchObject({
      descriptor: {
        label: "DebugNormalMaterial/Normals/uniform",
        size: DEBUG_NORMAL_MATERIAL_UNIFORM_BYTE_LENGTH,
        usage: DEFAULT_DEBUG_NORMAL_MATERIAL_BUFFER_USAGE,
      },
      dependencies: {},
    });
    expect(descriptor.plan?.source).toBe(packed.uniform);
    expect(descriptor.plan?.descriptor.initialData).toBe(packed.uniform);
    expect(preparation.plan).toMatchObject({
      materialBufferResourceKey:
        "material-buffer:DebugNormalMaterial/Normals/uniform",
    });
  });

  it("creates a GPU buffer resource with a JSON-safe inspection view", () => {
    const plan = required(
      createDebugNormalMaterialBufferDescriptor(
        required(
          packDebugNormalMaterial(createDebugNormalMaterialAsset()).packed,
        ),
      ).plan,
    );
    const writes: unknown[] = [];
    const device = {
      createBuffer: (descriptor: unknown) => ({ descriptor }),
      queue: {
        writeBuffer: (...args: unknown[]) => {
          writes.push(args);
        },
      },
    };

    const result = createDebugNormalMaterialGpuBuffer({ device, plan });
    const resource = required(result.resource);

    expect(result.valid).toBe(true);
    expect(resource).toMatchObject({
      resourceKey: "material-buffer:DebugNormalMaterial/uniform",
      dependencies: {},
    });
    expect(writes).toHaveLength(1);
    expect(debugNormalMaterialGpuBufferResourceToJsonValue(resource)).toEqual({
      resourceKey: "material-buffer:DebugNormalMaterial/uniform",
      dependencies: {},
    });
    expect(
      JSON.stringify(debugNormalMaterialGpuBufferResourceToJsonValue(resource)),
    ).not.toMatch(/GPUBuffer|GPUDevice|uniformBuffer|rawGpuHandle/);
  });

  it("reports unsupported materials, null descriptors, and invalid uniforms", () => {
    const invalidPacked: PackedDebugNormalMaterial = {
      uniform: new Uint8Array(0),
      uniformUint32: new Uint32Array(0),
      uniformLayout: DEBUG_NORMAL_MATERIAL_UNIFORM_LAYOUT,
      dependencies: {},
    };

    expect(
      packDebugNormalMaterial(createStandardMaterialAsset()).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["debugNormalMaterialPack.unsupportedMaterialKind"]);
    expect(createDebugNormalMaterialBufferDescriptor(null)).toMatchObject({
      valid: false,
      diagnostics: [{ code: "debugNormalMaterialBuffer.nullPackedMaterial" }],
    });
    expect(
      createDebugNormalMaterialBufferDescriptor(invalidPacked, {
        usage: 0,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "debugNormalMaterialBuffer.invalidUsageFlags",
      "debugNormalMaterialBuffer.invalidUniformData",
    ]);
    expect(
      createDebugNormalMaterialGpuBuffer({ device: {}, plan: null }),
    ).toMatchObject({
      valid: false,
      diagnostics: [
        { code: "debugNormalMaterialGpuBuffer.nullDescriptorPlan" },
      ],
    });
  });
});

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
