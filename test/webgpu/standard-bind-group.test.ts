import { describe, expect, it } from "vitest";

import {
  createStandardMaterialBindGroupDescriptorPlan,
  createStandardMaterialBindGroupResourceKey,
  type StandardMaterialResourceDependencies,
} from "@aperture-engine/webgpu";

describe("standard material bind group descriptor planning", () => {
  it("creates a material-only group-2 descriptor for scalar proof-point materials", () => {
    expect(
      createStandardMaterialBindGroupDescriptorPlan({
        materialResourceKey: "material-buffer:StandardMaterial/Gold/uniform",
        dependencies: emptyDependencies(),
      }),
    ).toEqual({
      valid: true,
      group: 2,
      resourceKey:
        "bind-group:standard/group-2/0:material-buffer:StandardMaterial/Gold/uniform",
      diagnostics: [],
      entries: [
        {
          group: 2,
          binding: 0,
          resourceKey: "material-buffer:StandardMaterial/Gold/uniform",
          resourceKind: "buffer",
        },
      ],
    });
  });

  it("adds stable texture and sampler entries for all declared dependencies", () => {
    const plan = createStandardMaterialBindGroupDescriptorPlan({
      materialResourceKey: "material-buffer:StandardMaterial/Textured/uniform",
      dependencies: {
        baseColor: {
          textureKey: "texture:base",
          samplerKey: "sampler:base",
          texCoord: 0,
        },
        metallicRoughness: {
          textureKey: "texture:mr",
          samplerKey: "sampler:mr",
          texCoord: 0,
        },
        normal: {
          textureKey: "texture:normal",
          samplerKey: "sampler:normal",
          texCoord: 0,
        },
        occlusion: {
          textureKey: "texture:ao",
          samplerKey: "sampler:ao",
          texCoord: 0,
        },
        emissive: {
          textureKey: "texture:emissive",
          samplerKey: "sampler:emissive",
          texCoord: 0,
        },
      },
    });

    expect(plan.valid).toBe(true);
    expect(plan.diagnostics).toEqual([]);
    expect(
      plan.entries.map((entry) => [entry.binding, entry.resourceKey]),
    ).toEqual([
      [0, "material-buffer:StandardMaterial/Textured/uniform"],
      [1, "texture:base"],
      [2, "sampler:base"],
      [3, "texture:mr"],
      [4, "sampler:mr"],
      [5, "texture:normal"],
      [6, "sampler:normal"],
      [7, "texture:ao"],
      [8, "sampler:ao"],
      [9, "texture:emissive"],
      [10, "sampler:emissive"],
    ]);
    expect(plan.resourceKey).toBe(
      "bind-group:standard/group-2/0:material-buffer:StandardMaterial/Textured/uniform/1:texture:base/2:sampler:base/3:texture:mr/4:sampler:mr/5:texture:normal/6:sampler:normal/7:texture:ao/8:sampler:ao/9:texture:emissive/10:sampler:emissive",
    );
  });

  it("reports missing material and partial texture resource keys", () => {
    const plan = createStandardMaterialBindGroupDescriptorPlan({
      materialResourceKey: null,
      dependencies: {
        ...emptyDependencies(),
        baseColor: {
          textureKey: "texture:base",
          samplerKey: null,
          texCoord: 0,
        },
        emissive: {
          textureKey: null,
          samplerKey: "sampler:emissive",
          texCoord: 0,
        },
      },
    });

    expect(plan.valid).toBe(false);
    expect(plan.resourceKey).toBeNull();
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "standardMaterialBindGroup.missingMaterialResource",
      "standardMaterialBindGroup.missingSamplerResource",
      "standardMaterialBindGroup.missingTextureResource",
    ]);
    expect(plan.diagnostics.map((diagnostic) => diagnostic.binding)).toEqual([
      0, 2, 9,
    ]);
  });

  it("creates stable bind group keys from sorted entries", () => {
    expect(
      createStandardMaterialBindGroupResourceKey([
        {
          group: 2,
          binding: 2,
          resourceKey: "sampler:base",
          resourceKind: "sampler",
        },
        {
          group: 2,
          binding: 0,
          resourceKey: "material-buffer:base",
          resourceKind: "buffer",
        },
        {
          group: 2,
          binding: 1,
          resourceKey: "texture:base",
          resourceKind: "texture-view",
        },
      ]),
    ).toBe(
      "bind-group:standard/group-2/0:material-buffer:base/1:texture:base/2:sampler:base",
    );
  });
});

function emptyDependencies(): StandardMaterialResourceDependencies {
  return {
    baseColor: { textureKey: null, samplerKey: null, texCoord: 0 },
    metallicRoughness: { textureKey: null, samplerKey: null, texCoord: 0 },
    normal: { textureKey: null, samplerKey: null, texCoord: 0 },
    occlusion: { textureKey: null, samplerKey: null, texCoord: 0 },
    emissive: { textureKey: null, samplerKey: null, texCoord: 0 },
  };
}
