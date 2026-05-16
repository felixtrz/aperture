import { describe, expect, it } from "vitest";

import {
  createMatcapMaterialBindGroupDescriptorPlan,
  createMatcapMaterialBindGroupLayoutMetadata,
  createMatcapMaterialBindGroupLayoutPlan,
  createMatcapMaterialBindGroupResource,
  createMatcapMaterialBindGroupResourceKey,
  validateMatcapMaterialBindGroupLayout,
  type MatcapMaterialBindGroupCreationDescriptor,
} from "@aperture-engine/webgpu";

describe("matcap material bind group descriptor planning", () => {
  it("creates a required material, texture, and sampler group-2 descriptor", () => {
    const plan = createMatcapMaterialBindGroupDescriptorPlan({
      materialResourceKey: "material-buffer:MatcapMaterial/Studio/uniform",
      dependencies: {
        matcapTexture: {
          textureKey: "texture:studio",
          samplerKey: "sampler:linear",
        },
      },
    });

    expect(plan).toEqual({
      valid: true,
      group: 2,
      resourceKey:
        "bind-group:matcap/group-2/0:material-buffer:MatcapMaterial/Studio/uniform/1:texture:studio/2:sampler:linear",
      diagnostics: [],
      entries: [
        {
          group: 2,
          binding: 0,
          resourceKey: "material-buffer:MatcapMaterial/Studio/uniform",
          resourceKind: "buffer",
        },
        {
          group: 2,
          binding: 1,
          resourceKey: "texture:studio",
          resourceKind: "texture-view",
        },
        {
          group: 2,
          binding: 2,
          resourceKey: "sampler:linear",
          resourceKind: "sampler",
        },
      ],
    });
  });

  it("reports missing required group-2 resource keys", () => {
    const plan = createMatcapMaterialBindGroupDescriptorPlan({
      materialResourceKey: null,
      dependencies: {
        matcapTexture: {
          textureKey: null,
          samplerKey: null,
        },
      },
    });

    expect(plan.valid).toBe(false);
    expect(plan.resourceKey).toBeNull();
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "matcapMaterialBindGroup.missingMaterialResource",
      "matcapMaterialBindGroup.missingTextureResource",
      "matcapMaterialBindGroup.missingSamplerResource",
    ]);
    expect(plan.diagnostics.map((diagnostic) => diagnostic.binding)).toEqual([
      0, 1, 2,
    ]);
  });

  it("creates stable bind group keys from sorted entries", () => {
    expect(
      createMatcapMaterialBindGroupResourceKey([
        {
          group: 2,
          binding: 2,
          resourceKey: "sampler:linear",
          resourceKind: "sampler",
        },
        {
          group: 2,
          binding: 0,
          resourceKey: "material-buffer:matcap",
          resourceKind: "buffer",
        },
        {
          group: 2,
          binding: 1,
          resourceKey: "texture:studio",
          resourceKind: "texture-view",
        },
      ]),
    ).toBe(
      "bind-group:matcap/group-2/0:material-buffer:matcap/1:texture:studio/2:sampler:linear",
    );
  });

  it("creates matcap material bind groups from GPU resources", () => {
    const bindGroups: MatcapMaterialBindGroupCreationDescriptor[] = [];
    const plan = createMatcapMaterialBindGroupDescriptorPlan({
      materialResourceKey: "material-buffer:MatcapMaterial/Studio/uniform",
      dependencies: {
        matcapTexture: {
          textureKey: "texture:studio",
          samplerKey: "sampler:linear",
        },
      },
    });
    const layoutPlan = createMatcapMaterialBindGroupLayoutPlan();
    const result = createMatcapMaterialBindGroupResource({
      device: {
        createBindGroup(descriptor) {
          bindGroups.push(descriptor);
          return { kind: "matcap-bind-group" };
        },
      },
      plan,
      layout: {
        group: 2,
        layoutKey: "matcap/group-2",
        layout: "raw-matcap-layout",
        descriptor: layoutPlan.layout,
      },
      buffers: [
        {
          resourceKey: "material-buffer:MatcapMaterial/Studio/uniform",
          buffer: { kind: "raw-matcap-buffer" },
        },
      ],
      textures: [
        {
          resourceKey: "texture:studio",
          view: { kind: "raw-matcap-texture-view" },
        },
      ],
      samplers: [
        {
          resourceKey: "sampler:linear",
          sampler: { kind: "raw-matcap-sampler" },
        },
      ],
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.resource).toEqual({
      group: 2,
      resourceKey:
        "bind-group:matcap/group-2/0:material-buffer:MatcapMaterial/Studio/uniform/1:texture:studio/2:sampler:linear",
      layoutKey: "matcap/group-2",
      bindGroup: { kind: "matcap-bind-group" },
      entryResourceKeys: [
        "material-buffer:MatcapMaterial/Studio/uniform",
        "texture:studio",
        "sampler:linear",
      ],
    });
    expect(bindGroups).toEqual([
      {
        label: "matcap/group-2",
        layout: "raw-matcap-layout",
        entries: [
          {
            binding: 0,
            resource: { buffer: { kind: "raw-matcap-buffer" } },
          },
          {
            binding: 1,
            resource: { kind: "raw-matcap-texture-view" },
          },
          {
            binding: 2,
            resource: { kind: "raw-matcap-sampler" },
          },
        ],
      },
    ]);
  });

  it("reports missing matcap GPU resources without creating a fallback group", () => {
    const plan = createMatcapMaterialBindGroupDescriptorPlan({
      materialResourceKey: "material-buffer:MatcapMaterial/Missing/uniform",
      dependencies: {
        matcapTexture: {
          textureKey: "texture:missing",
          samplerKey: "sampler:missing",
        },
      },
    });
    const result = createMatcapMaterialBindGroupResource({
      device: {
        createBindGroup() {
          return {};
        },
      },
      plan,
      layout: {
        group: 2,
        layoutKey: "matcap/group-2",
        layout: "raw-matcap-layout",
        descriptor: createMatcapMaterialBindGroupLayoutPlan().layout,
      },
      buffers: [],
      textures: [],
      samplers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.resource).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "matcapMaterialBindGroupResource.missingBufferResource",
      "matcapMaterialBindGroupResource.missingTextureResource",
      "matcapMaterialBindGroupResource.missingSamplerResource",
    ]);
  });
});

describe("matcap material bind group layout metadata", () => {
  it("creates required group-2 layout metadata", () => {
    const plan = createMatcapMaterialBindGroupLayoutPlan();

    expect(plan).toMatchObject({
      valid: true,
      diagnostics: [],
      layout: {
        group: 2,
        label: "matcap/group-2",
        metadata: {
          group: 2,
          name: "matcapMaterial",
          layoutKey: "matcap/group-2",
        },
      },
    });
    expect(plan.layout.entries).toEqual([
      { binding: 0, label: "matcapMaterial", resource: "uniform-buffer" },
      { binding: 1, label: "matcapTexture", resource: "texture" },
      { binding: 2, label: "matcapSampler", resource: "sampler" },
    ]);
    expect(plan.layout.metadata.bindings).toEqual([
      {
        binding: 0,
        name: "matcapMaterial",
        resourceKind: "buffer",
        visibility: ["fragment"],
        required: true,
      },
      {
        binding: 1,
        name: "matcapTexture",
        resourceKind: "texture-view",
        visibility: ["fragment"],
        required: true,
      },
      {
        binding: 2,
        name: "matcapSampler",
        resourceKind: "sampler",
        visibility: ["fragment"],
        required: true,
      },
    ]);
  });

  it("validates required matcap material group metadata", () => {
    expect(
      validateMatcapMaterialBindGroupLayout({
        group: 2,
        metadata: createMatcapMaterialBindGroupLayoutMetadata(),
        entries: [
          { binding: 0, label: "matcapMaterial", resource: "uniform-buffer" },
          { binding: 1, label: "matcapTexture", resource: "texture" },
          { binding: 2, label: "matcapSampler", resource: "sampler" },
        ],
      }),
    ).toEqual([]);

    expect(
      validateMatcapMaterialBindGroupLayout({
        group: 1,
        entries: [
          { binding: 0, label: "bad", resource: "texture" },
          { binding: 1, label: "bad", resource: "texture" },
        ],
      }).map((diagnostic) => diagnostic.code),
    ).toEqual([
      "matcapMaterialBindGroupLayout.invalidGroup",
      "matcapMaterialBindGroupLayout.resourceKindMismatch",
      "matcapMaterialBindGroupLayout.missingBinding",
    ]);
  });
});
