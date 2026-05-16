import { describe, expect, it } from "vitest";

import {
  DEFAULT_MATCAP_MATERIAL_BUFFER_USAGE,
  MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH,
  MATCAP_MATERIAL_UNIFORM_FLOATS,
  MATCAP_MATERIAL_UNIFORM_LAYOUT,
  createMatcapMaterialAsset,
  createMatcapMaterialBufferDescriptor,
  createMatcapMaterialGpuBuffer,
  createMatcapMaterialGpuPreparationPlan,
  createSamplerHandle,
  createStandardMaterialAsset,
  createTextureHandle,
  packMatcapMaterial,
  type PackedMatcapMaterial,
} from "@aperture-engine/webgpu";

describe("matcap material WebGPU uniform packing", () => {
  it("packs base color and required matcap texture dependencies", () => {
    const result = packMatcapMaterial(
      createMatcapMaterialAsset({
        baseColorFactor: new Float32Array([0.2, 0.4, 0.6, 0.8]),
        matcapTexture: {
          texture: createTextureHandle("studio"),
          sampler: createSamplerHandle("linear"),
        },
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.packed?.uniformLayout).toBe(MATCAP_MATERIAL_UNIFORM_LAYOUT);
    expect(result.packed?.uniform.byteLength).toBe(
      MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH,
    );
    expect(result.packed?.uniform.length).toBe(MATCAP_MATERIAL_UNIFORM_FLOATS);
    expect(Array.from(result.packed?.uniform ?? [])).toEqual([
      expect.closeTo(0.2, 5),
      expect.closeTo(0.4, 5),
      expect.closeTo(0.6, 5),
      expect.closeTo(0.8, 5),
    ]);
    expect(result.packed?.dependencies).toEqual({
      matcapTexture: {
        textureKey: "texture:studio",
        samplerKey: "sampler:linear",
      },
    });
  });

  it("plans a material buffer with a stable resource key", () => {
    const material = createMatcapMaterialAsset({
      label: "Studio Matcap",
      matcapTexture: {
        texture: createTextureHandle("studio"),
        sampler: createSamplerHandle("linear"),
      },
    });
    const packed = required(packMatcapMaterial(material).packed);
    const descriptor = createMatcapMaterialBufferDescriptor(packed, {
      label: "MatcapMaterial/Studio/uniform",
    });
    const preparation = createMatcapMaterialGpuPreparationPlan(material, {
      label: "MatcapMaterial/Studio/uniform",
    });

    expect(descriptor.diagnostics).toEqual([]);
    expect(descriptor.plan).toMatchObject({
      descriptor: {
        label: "MatcapMaterial/Studio/uniform",
        size: MATCAP_MATERIAL_UNIFORM_BYTE_LENGTH,
        usage: DEFAULT_MATCAP_MATERIAL_BUFFER_USAGE,
      },
      dependencies: {
        matcapTexture: {
          textureKey: "texture:studio",
          samplerKey: "sampler:linear",
        },
      },
    });
    expect(descriptor.plan?.source).toBe(packed.uniform);
    expect(descriptor.plan?.descriptor.initialData).toBe(packed.uniform);
    expect(preparation.plan).toMatchObject({
      materialBufferResourceKey:
        "material-buffer:MatcapMaterial/Studio/uniform",
    });
  });

  it("creates a GPU buffer resource from the descriptor plan", () => {
    const plan = required(
      createMatcapMaterialBufferDescriptor(
        required(
          packMatcapMaterial(
            createMatcapMaterialAsset({
              matcapTexture: {
                texture: createTextureHandle("studio"),
                sampler: createSamplerHandle("linear"),
              },
            }),
          ).packed,
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

    const result = createMatcapMaterialGpuBuffer({ device, plan });

    expect(result.valid).toBe(true);
    expect(result.resource).toMatchObject({
      resourceKey: "material-buffer:MatcapMaterial/uniform",
      dependencies: {
        matcapTexture: {
          textureKey: "texture:studio",
          samplerKey: "sampler:linear",
        },
      },
    });
    expect(writes).toHaveLength(1);
  });

  it("reports unsupported materials, missing matcap handles, and bad descriptors", () => {
    expect(
      packMatcapMaterial(createStandardMaterialAsset()).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["matcapMaterialPack.unsupportedMaterialKind"]);

    expect(
      packMatcapMaterial(createMatcapMaterialAsset()).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "material.missingTextureHandle",
      "material.missingSamplerHandle",
      "matcapMaterialPack.missingTextureHandle",
      "matcapMaterialPack.missingSamplerHandle",
    ]);

    expect(createMatcapMaterialBufferDescriptor(null)).toMatchObject({
      valid: false,
      diagnostics: [{ code: "matcapMaterialBuffer.nullPackedMaterial" }],
    });
    expect(
      createMatcapMaterialBufferDescriptor(invalidPacked(), {
        usage: 0,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "matcapMaterialBuffer.invalidUsageFlags",
      "matcapMaterialBuffer.invalidUniformData",
    ]);
    expect(createMatcapMaterialGpuBuffer({ device: {}, plan: null })).toEqual({
      valid: false,
      resource: null,
      diagnostics: [
        {
          code: "matcapMaterialGpuBuffer.nullDescriptorPlan",
          message:
            "Cannot create a matcap material GPU buffer from a null descriptor plan.",
        },
      ],
    });
  });
});

function invalidPacked(): PackedMatcapMaterial {
  return {
    uniform: new Float32Array(0),
    uniformLayout: MATCAP_MATERIAL_UNIFORM_LAYOUT,
    dependencies: {
      matcapTexture: {
        textureKey: "texture:studio",
        samplerKey: "sampler:linear",
      },
    },
  };
}

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
