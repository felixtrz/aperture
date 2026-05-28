import { describe, expect, it } from "vitest";

import {
  createStandardMaterialBindGroupLayoutMetadata,
  createStandardMaterialBindGroupLayoutPlan,
  validateStandardMaterialBindGroupLayout,
} from "@aperture-engine/webgpu/test-support";

describe("standard material bind group layout metadata", () => {
  it("creates group-2 layout metadata for scalar and deferred texture resources", () => {
    const plan = createStandardMaterialBindGroupLayoutPlan();

    expect(plan).toMatchObject({
      valid: true,
      diagnostics: [],
      layout: {
        group: 2,
        label: "standard/group-2",
        metadata: {
          group: 2,
          name: "standardMaterial",
          layoutKey: "standard/group-2",
        },
      },
    });
    expect(plan.layout.entries).toEqual([
      { binding: 0, label: "standardMaterial", resource: "uniform-buffer" },
      { binding: 1, label: "baseColorTexture", resource: "texture" },
      { binding: 2, label: "baseColorSampler", resource: "sampler" },
      {
        binding: 3,
        label: "metallicRoughnessTexture",
        resource: "texture",
      },
      {
        binding: 4,
        label: "metallicRoughnessSampler",
        resource: "sampler",
      },
      { binding: 5, label: "normalTexture", resource: "texture" },
      { binding: 6, label: "normalSampler", resource: "sampler" },
      { binding: 7, label: "occlusionTexture", resource: "texture" },
      { binding: 8, label: "occlusionSampler", resource: "sampler" },
      { binding: 9, label: "emissiveTexture", resource: "texture" },
      { binding: 10, label: "emissiveSampler", resource: "sampler" },
      { binding: 11, label: "clearcoatTexture", resource: "texture" },
      { binding: 12, label: "clearcoatSampler", resource: "sampler" },
      { binding: 13, label: "transmissionTexture", resource: "texture" },
      { binding: 14, label: "transmissionSampler", resource: "sampler" },
      { binding: 15, label: "sheenColorTexture", resource: "texture" },
      { binding: 16, label: "sheenColorSampler", resource: "sampler" },
      { binding: 17, label: "iridescenceTexture", resource: "texture" },
      { binding: 18, label: "iridescenceSampler", resource: "sampler" },
      { binding: 19, label: "sheenRoughnessTexture", resource: "texture" },
      { binding: 20, label: "sheenRoughnessSampler", resource: "sampler" },
      {
        binding: 21,
        label: "iridescenceThicknessTexture",
        resource: "texture",
      },
      {
        binding: 22,
        label: "iridescenceThicknessSampler",
        resource: "sampler",
      },
      {
        binding: 23,
        label: "clearcoatRoughnessTexture",
        resource: "texture",
      },
      {
        binding: 24,
        label: "clearcoatRoughnessSampler",
        resource: "sampler",
      },
    ]);
    expect(plan.layout.metadata.bindings[0]).toEqual({
      binding: 0,
      name: "standardMaterial",
      resourceKind: "buffer",
      visibility: ["fragment"],
      required: true,
    });
    expect(plan.layout.metadata.bindings[1]).toEqual({
      binding: 1,
      name: "baseColorTexture",
      resourceKind: "texture-view",
      visibility: ["fragment"],
      required: false,
    });
  });

  it("validates required standard material group metadata", () => {
    expect(
      validateStandardMaterialBindGroupLayout({
        group: 2,
        metadata: createStandardMaterialBindGroupLayoutMetadata(),
        entries: [
          { binding: 0, label: "standardMaterial", resource: "uniform-buffer" },
        ],
      }),
    ).toEqual([]);

    expect(
      validateStandardMaterialBindGroupLayout({
        group: 1,
        entries: [{ binding: 0, label: "bad", resource: "texture" }],
      }).map((diagnostic) => diagnostic.code),
    ).toEqual([
      "standardMaterialBindGroupLayout.invalidGroup",
      "standardMaterialBindGroupLayout.resourceKindMismatch",
    ]);

    expect(
      validateStandardMaterialBindGroupLayout({
        group: 2,
        entries: [],
      }).map((diagnostic) => diagnostic.code),
    ).toEqual(["standardMaterialBindGroupLayout.missingBinding"]);
  });
});
