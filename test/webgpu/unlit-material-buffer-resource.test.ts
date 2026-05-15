import { describe, expect, it } from "vitest";

import {
  createSamplerHandle,
  createTextureHandle,
  createUnlitMaterialAsset,
  createUnlitMaterialBufferDescriptor,
  createUnlitMaterialGpuBuffer,
  packUnlitMaterial,
  type UnlitMaterialBufferDescriptorPlan,
  type WebGpuBufferDeviceLike,
} from "../../src/index.js";

describe("unlit material GPU buffer resource creation", () => {
  it("creates uniform buffer resources for default unlit materials", () => {
    const created: unknown[] = [];
    const plan = descriptorPlan(createUnlitMaterialAsset());
    const result = createUnlitMaterialGpuBuffer({
      device: deviceWithBuffers(created),
      plan,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "material-buffer:UnlitMaterial/uniform",
      dependencies: {
        baseColorTextureKey: null,
        baseColorSamplerKey: null,
      },
    });
    expect(created).toHaveLength(1);
  });

  it("preserves textured unlit dependency keys", () => {
    const plan = descriptorPlan(
      createUnlitMaterialAsset({
        baseColorTexture: {
          texture: createTextureHandle("albedo"),
          sampler: createSamplerHandle("linear"),
        },
      }),
    );
    const result = createUnlitMaterialGpuBuffer({
      device: deviceWithBuffers([]),
      plan,
    });

    expect(result.resource?.dependencies).toEqual({
      baseColorTextureKey: "texture:albedo",
      baseColorSamplerKey: "sampler:linear",
    });
  });

  it("reports null descriptor plans and buffer creation failures", () => {
    const plan = descriptorPlan(createUnlitMaterialAsset());
    const invalidPlan: UnlitMaterialBufferDescriptorPlan = {
      ...plan,
      descriptor: { ...plan.descriptor, size: 0 },
    };

    expect(
      createUnlitMaterialGpuBuffer({
        device: deviceWithBuffers([]),
        plan: null,
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "unlitMaterialGpuBuffer.nullDescriptorPlan" }],
    });
    expect(
      createUnlitMaterialGpuBuffer({
        device: deviceWithBuffers([]),
        plan: invalidPlan,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["unlitMaterialGpuBuffer.creationFailed"]);
  });
});

function descriptorPlan(
  material: ReturnType<typeof createUnlitMaterialAsset>,
): UnlitMaterialBufferDescriptorPlan {
  return required(
    createUnlitMaterialBufferDescriptor(
      required(packUnlitMaterial(material).packed),
    ).plan,
  );
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
