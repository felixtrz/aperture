import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE,
  UNLIT_MATERIAL_UNIFORM_LAYOUT,
  createSamplerHandle,
  createTextureHandle,
  createUnlitMaterialAsset,
  createUnlitMaterialBufferDescriptor,
  packUnlitMaterial,
  type PackedUnlitMaterial,
} from "@aperture-engine/webgpu";

describe("unlit material buffer descriptor planning", () => {
  it("maps default packed unlit material data to a uniform buffer descriptor", () => {
    const packed = required(
      packUnlitMaterial(createUnlitMaterialAsset()).packed,
    );
    const result = createUnlitMaterialBufferDescriptor(packed);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      descriptor: {
        label: "UnlitMaterial/uniform",
        size: 16,
        usage: DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE,
      },
      dependencies: {
        baseColorTextureKey: null,
        baseColorSamplerKey: null,
      },
    });
    expect(result.plan?.source).toBe(packed.uniform);
    expect(result.plan?.descriptor.initialData).toBe(packed.uniform);
  });

  it("supports tinted materials and custom labels", () => {
    const packed = required(
      packUnlitMaterial(
        createUnlitMaterialAsset({
          baseColorFactor: new Float32Array([0.1, 0.2, 0.3, 0.4]),
        }),
      ).packed,
    );
    const result = createUnlitMaterialBufferDescriptor(packed, {
      label: "material:red/uniform",
      usage: 99,
    });

    expect(result.valid).toBe(true);
    expect(result.plan?.descriptor).toMatchObject({
      label: "material:red/uniform",
      size: 16,
      usage: 99,
    });
  });

  it("preserves textured unlit dependency keys", () => {
    const packed = required(
      packUnlitMaterial(
        createUnlitMaterialAsset({
          baseColorTexture: {
            texture: createTextureHandle("albedo"),
            sampler: createSamplerHandle("linear"),
          },
        }),
      ).packed,
    );

    expect(
      createUnlitMaterialBufferDescriptor(packed).plan?.dependencies,
    ).toEqual({
      baseColorTextureKey: "texture:albedo",
      baseColorSamplerKey: "sampler:linear",
    });
  });

  it("reports null packed input, invalid uniforms, and invalid usage flags", () => {
    const invalidPacked: PackedUnlitMaterial = {
      uniform: new Float32Array(0),
      uniformLayout: UNLIT_MATERIAL_UNIFORM_LAYOUT,
      dependencies: {
        baseColorTextureKey: null,
        baseColorSamplerKey: null,
      },
    };

    expect(createUnlitMaterialBufferDescriptor(null)).toMatchObject({
      valid: false,
      diagnostics: [{ code: "unlitMaterialBuffer.nullPackedMaterial" }],
    });
    expect(
      createUnlitMaterialBufferDescriptor(invalidPacked, {
        usage: 0,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "unlitMaterialBuffer.invalidUsageFlags",
      "unlitMaterialBuffer.invalidUniformData",
    ]);
  });
});

function required<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected test fixture value to exist.");
  }

  return value;
}
