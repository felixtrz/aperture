import { describe, expect, it } from "vitest";

import {
  createRenderResourceSummaryReport,
  createStandardMaterialAsset,
  createStandardMaterialBufferDescriptor,
  createStandardMaterialGpuBuffer,
  packStandardMaterial,
  type StandardMaterialBufferDescriptorPlan,
  type WebGpuBufferDeviceLike,
} from "@aperture-engine/webgpu";

describe("standard material GPU buffer resource creation", () => {
  it("creates uniform buffer resources for standard materials", () => {
    const writes: unknown[] = [];
    const plan = descriptorPlan(
      createStandardMaterialAsset({
        label: "Gold",
        metallicFactor: 1,
        roughnessFactor: 0.35,
      }),
      "StandardMaterial/Gold/uniform",
    );
    const result = createStandardMaterialGpuBuffer({
      device: deviceWithBuffers(writes),
      plan,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toMatchObject({
      resourceKey: "material-buffer:StandardMaterial/Gold/uniform",
      dependencies: {
        baseColor: { textureKey: null, samplerKey: null, texCoord: 0 },
      },
      featureFlags: 0,
    });
    expect(writes).toHaveLength(1);
  });

  it("reports null descriptor plans and buffer creation failures", () => {
    const plan = descriptorPlan(
      createStandardMaterialAsset(),
      "StandardMaterial/Invalid/uniform",
    );
    const invalidPlan: StandardMaterialBufferDescriptorPlan = {
      ...plan,
      descriptor: { ...plan.descriptor, size: 0 },
    };

    expect(
      createStandardMaterialGpuBuffer({
        device: deviceWithBuffers([]),
        plan: null,
      }),
    ).toMatchObject({
      valid: false,
      diagnostics: [{ code: "standardMaterialGpuBuffer.nullDescriptorPlan" }],
    });
    expect(
      createStandardMaterialGpuBuffer({
        device: deviceWithBuffers([]),
        plan: invalidPlan,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["standardMaterialGpuBuffer.creationFailed"]);
  });

  it("is counted by resource summary without exposing raw GPU handles", () => {
    const valid = createStandardMaterialGpuBuffer({
      device: deviceWithBuffers([]),
      plan: descriptorPlan(
        createStandardMaterialAsset(),
        "StandardMaterial/Ready/uniform",
      ),
    });
    const failed = createStandardMaterialGpuBuffer({
      device: { createBuffer: () => ({ raw: "buffer" }) },
      plan: descriptorPlan(
        createStandardMaterialAsset(),
        "StandardMaterial/MissingQueue/uniform",
      ),
    });
    const report = createRenderResourceSummaryReport({
      meshResources: [],
      materialResources: [valid, failed],
      viewUniformResources: [],
      shaderResources: [],
      pipelines: [],
    });

    expect(report.counts).toMatchObject({
      materialBuffers: 1,
      warnings: 1,
      errors: 0,
    });
    expect(report.diagnostics).toEqual([
      {
        code: "standardMaterialGpuBuffer.creationFailed",
        message:
          "Failed to create standard material uniform buffer 'material-buffer:StandardMaterial/MissingQueue/uniform': WebGPU buffer initial data requires queue.writeBuffer.",
        resourceKey: "material-buffer:StandardMaterial/MissingQueue/uniform",
        severity: "warning",
      },
    ]);
    expect(JSON.stringify(report)).not.toContain("raw");
  });
});

function descriptorPlan(
  material: ReturnType<typeof createStandardMaterialAsset>,
  label: string,
): StandardMaterialBufferDescriptorPlan {
  return required(
    createStandardMaterialBufferDescriptor(
      required(packStandardMaterial(material).packed),
      { label },
    ).plan,
  );
}

function deviceWithBuffers(writes: unknown[]): WebGpuBufferDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        writes.push({ buffer, bufferOffset, data, dataOffset, size });
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
