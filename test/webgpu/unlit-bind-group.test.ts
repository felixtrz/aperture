import { describe, expect, it } from "vitest";

import {
  createUnlitBindGroupLayoutMetadata,
  createBindGroupResourceCache,
  createUnlitBindGroupDescriptorPlan,
  createUnlitBindGroups,
  createUnlitBindGroupsFromBuffers,
  createUnlitBindGroupsFromGpuResources,
  type UnlitBindGroupCreationDescriptor,
  type UnlitBindGroupLayoutResource,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu";

describe("unlit bind group descriptor planning", () => {
  it("creates descriptor entries for all required resources", () => {
    expect(
      createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        materialResourceKey: "material",
      }),
    ).toEqual({
      valid: true,
      diagnostics: [],
      entries: [
        { group: 0, binding: 0, resourceKey: "view", resourceKind: "buffer" },
        {
          group: 1,
          binding: 0,
          resourceKey: "transforms",
          resourceKind: "buffer",
        },
        {
          group: 2,
          binding: 0,
          resourceKey: "material",
          resourceKind: "buffer",
        },
      ],
    });
  });

  it("adds texture and sampler entries for textured unlit materials", () => {
    expect(
      createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        materialResourceKey: "material",
        baseColorTextureResourceKey: "texture:albedo",
        baseColorSamplerResourceKey: "sampler:linear",
      }),
    ).toEqual({
      valid: true,
      diagnostics: [],
      entries: [
        { group: 0, binding: 0, resourceKey: "view", resourceKind: "buffer" },
        {
          group: 1,
          binding: 0,
          resourceKey: "transforms",
          resourceKind: "buffer",
        },
        {
          group: 2,
          binding: 0,
          resourceKey: "material",
          resourceKind: "buffer",
        },
        {
          group: 2,
          binding: 1,
          resourceKey: "texture:albedo",
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

  it("adds previous world transforms for motion-vector pipelines", () => {
    expect(
      createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        previousWorldTransformResourceKey: "previous-transforms",
        materialResourceKey: "material",
      }).entries,
    ).toEqual([
      { group: 0, binding: 0, resourceKey: "view", resourceKind: "buffer" },
      {
        group: 1,
        binding: 0,
        resourceKey: "transforms",
        resourceKind: "buffer",
      },
      {
        group: 1,
        binding: 3,
        resourceKey: "previous-transforms",
        resourceKind: "buffer",
      },
      {
        group: 2,
        binding: 0,
        resourceKey: "material",
        resourceKind: "buffer",
      },
    ]);
  });

  it("diagnoses partial textured bind group resource keys", () => {
    expect(
      createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        materialResourceKey: "material",
        baseColorTextureResourceKey: "texture:albedo",
        baseColorSamplerResourceKey: null,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["unlitBindGroup.missingBaseColorSamplerResource"]);

    expect(
      createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        materialResourceKey: "material",
        baseColorTextureResourceKey: null,
        baseColorSamplerResourceKey: "sampler:linear",
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["unlitBindGroup.missingBaseColorTextureResource"]);
  });

  it("diagnoses each missing resource independently", () => {
    expect(
      createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: null,
        worldTransformResourceKey: null,
        materialResourceKey: null,
      }).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual([
      "unlitBindGroup.missingViewResource",
      "unlitBindGroup.missingTransformResource",
      "unlitBindGroup.missingMaterialResource",
    ]);
  });

  it("creates bind group resources from descriptor plans and layouts", () => {
    const descriptors: UnlitBindGroupCreationDescriptor[] = [];
    const device = {
      createBindGroup: (descriptor: UnlitBindGroupCreationDescriptor) => {
        descriptors.push(descriptor);
        return { label: descriptor.label };
      },
    };
    const result = createUnlitBindGroups({
      device,
      plan: createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view-uniform-buffer:main",
        worldTransformResourceKey: "buffer:transforms",
        materialResourceKey: "material-buffer:white",
      }),
      layouts: layoutResources(),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject([
      {
        group: 0,
        layoutKey: "layout:0",
        resourceKey: "bind-group:unlit/group-0/0:view-uniform-buffer:main",
        entryResourceKeys: ["view-uniform-buffer:main"],
      },
      {
        group: 1,
        layoutKey: "layout:1",
        resourceKey: "bind-group:unlit/group-1/0:buffer:transforms",
        entryResourceKeys: ["buffer:transforms"],
      },
      {
        group: 2,
        layoutKey: "layout:2",
        resourceKey: "bind-group:unlit/group-2/0:material-buffer:white",
        entryResourceKeys: ["material-buffer:white"],
      },
    ]);
    expect(descriptors).toMatchObject([
      {
        label: "unlit/group-0",
        layout: { group: 0 },
        entries: [
          { binding: 0, resource: { resourceKey: "view-uniform-buffer:main" } },
        ],
      },
      {
        label: "unlit/group-1",
        layout: { group: 1 },
        entries: [
          { binding: 0, resource: { resourceKey: "buffer:transforms" } },
        ],
      },
      {
        label: "unlit/group-2",
        layout: { group: 2 },
        entries: [
          { binding: 0, resource: { resourceKey: "material-buffer:white" } },
        ],
      },
    ]);
  });

  it("reuses cached bind group resources until layout or entry keys change", () => {
    const descriptors: UnlitBindGroupCreationDescriptor[] = [];
    const cache = createBindGroupResourceCache<UnlitBindGroupResource>();
    const plan = createUnlitBindGroupDescriptorPlan({
      viewUniformResourceKey: "view-uniform-buffer:main",
      worldTransformResourceKey: "buffer:transforms",
      materialResourceKey: "material-buffer:white",
    });
    const device = {
      createBindGroup: (descriptor: UnlitBindGroupCreationDescriptor) => {
        descriptors.push(descriptor);
        return { label: descriptor.label, index: descriptors.length };
      },
    };
    const first = createUnlitBindGroups({
      device,
      plan,
      layouts: layoutResources(),
      bindGroupCache: cache,
    });
    const second = createUnlitBindGroups({
      device,
      plan,
      layouts: layoutResources(),
      bindGroupCache: cache,
    });
    const layoutVersion = createUnlitBindGroups({
      device,
      plan,
      layouts: layoutResources().map((layout) =>
        layout.group === 0 ? { ...layout, layoutKey: "layout:0:v2" } : layout,
      ),
      bindGroupCache: cache,
    });
    const resourceVersion = createUnlitBindGroups({
      device,
      plan: createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view-uniform-buffer:main-v2",
        worldTransformResourceKey: "buffer:transforms",
        materialResourceKey: "material-buffer:white",
      }),
      layouts: layoutResources(),
      bindGroupCache: cache,
    });

    expect(first.createdBindGroupCount).toBe(3);
    expect(first.reusedBindGroupCount).toBe(0);
    expect(second.createdBindGroupCount).toBe(0);
    expect(second.reusedBindGroupCount).toBe(3);
    expect(second.resources).toEqual(first.resources);
    expect(layoutVersion.createdBindGroupCount).toBe(1);
    expect(layoutVersion.reusedBindGroupCount).toBe(2);
    expect(resourceVersion.createdBindGroupCount).toBe(1);
    expect(resourceVersion.reusedBindGroupCount).toBe(2);
    expect(cache).toMatchObject({
      created: 5,
      reused: 7,
    });
    expect(descriptors).toHaveLength(5);
  });

  it("creates bind groups from actual GPU buffer binding resources", () => {
    const descriptors: UnlitBindGroupCreationDescriptor[] = [];
    const buffers = [
      { resourceKey: "view-uniform-buffer:main", buffer: { label: "view" } },
      {
        resourceKey: "world-transform-buffer:frame",
        buffer: { label: "transforms" },
      },
      {
        resourceKey: "material-buffer:white",
        buffer: { label: "material" },
      },
    ];
    const result = createUnlitBindGroupsFromBuffers({
      device: {
        createBindGroup: (descriptor: UnlitBindGroupCreationDescriptor) => {
          descriptors.push(descriptor);
          return { label: descriptor.label };
        },
      },
      plan: createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: buffers[0]?.resourceKey ?? null,
        worldTransformResourceKey: buffers[1]?.resourceKey ?? null,
        materialResourceKey: buffers[2]?.resourceKey ?? null,
      }),
      layouts: layoutResources(),
      buffers,
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(descriptors).toMatchObject([
      {
        label: "unlit/group-0",
        entries: [{ binding: 0, resource: { buffer: { label: "view" } } }],
      },
      {
        label: "unlit/group-1",
        entries: [
          { binding: 0, resource: { buffer: { label: "transforms" } } },
        ],
      },
      {
        label: "unlit/group-2",
        entries: [{ binding: 0, resource: { buffer: { label: "material" } } }],
      },
    ]);
  });

  it("creates textured bind groups from buffer, texture, and sampler resources", () => {
    const descriptors: UnlitBindGroupCreationDescriptor[] = [];
    const materialBuffer = { label: "material" };
    const textureView = { label: "albedo-view" };
    const sampler = { label: "linear-sampler" };
    const result = createUnlitBindGroupsFromGpuResources({
      device: {
        createBindGroup: (descriptor: UnlitBindGroupCreationDescriptor) => {
          descriptors.push(descriptor);
          return { label: descriptor.label };
        },
      },
      plan: createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view-uniform-buffer:main",
        worldTransformResourceKey: "world-transform-buffer:frame",
        materialResourceKey: "material-buffer:white",
        baseColorTextureResourceKey: "texture:albedo",
        baseColorSamplerResourceKey: "sampler:linear",
      }),
      layouts: layoutResources(),
      buffers: [
        { resourceKey: "view-uniform-buffer:main", buffer: { label: "view" } },
        {
          resourceKey: "world-transform-buffer:frame",
          buffer: { label: "transforms" },
        },
        { resourceKey: "material-buffer:white", buffer: materialBuffer },
      ],
      textures: [{ resourceKey: "texture:albedo", view: textureView }],
      samplers: [{ resourceKey: "sampler:linear", sampler }],
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.resources.find((resource) => resource.group === 2),
    ).toMatchObject({
      group: 2,
      resourceKey:
        "bind-group:unlit/group-2/0:material-buffer:white/1:texture:albedo/2:sampler:linear",
      entryResourceKeys: [
        "material-buffer:white",
        "texture:albedo",
        "sampler:linear",
      ],
    });
    expect(descriptors.at(-1)).toMatchObject({
      label: "unlit/group-2",
      entries: [
        { binding: 0, resource: { buffer: materialBuffer } },
        { binding: 1, resource: textureView },
        { binding: 2, resource: sampler },
      ],
    });
  });

  it("diagnoses missing actual GPU buffer resources", () => {
    const result = createUnlitBindGroupsFromBuffers({
      device: { createBindGroup: () => ({}) },
      plan: createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        materialResourceKey: "material",
      }),
      layouts: layoutResources(),
      buffers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitBindGroupResource.missingBufferResource",
      "unlitBindGroupResource.missingBufferResource",
      "unlitBindGroupResource.missingBufferResource",
    ]);
    expect(
      result.diagnostics.map((diagnostic) => diagnostic.resourceKey),
    ).toEqual(["view", "transforms", "material"]);
  });

  it("diagnoses missing actual texture and sampler resources", () => {
    const result = createUnlitBindGroupsFromGpuResources({
      device: { createBindGroup: () => ({}) },
      plan: createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        materialResourceKey: "material",
        baseColorTextureResourceKey: "texture:missing",
        baseColorSamplerResourceKey: "sampler:missing",
      }),
      layouts: layoutResources(),
      buffers: [
        { resourceKey: "view", buffer: {} },
        { resourceKey: "transforms", buffer: {} },
        { resourceKey: "material", buffer: {} },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.resources.map((resource) => resource.group)).toEqual([0, 1]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitBindGroupResource.missingTextureResource",
      "unlitBindGroupResource.missingSamplerResource",
    ]);
    expect(
      result.diagnostics.map((diagnostic) => diagnostic.resourceKey),
    ).toEqual(["texture:missing", "sampler:missing"]);
  });

  it("diagnoses null descriptor plans", () => {
    expect(
      createUnlitBindGroups({
        device: { createBindGroup: () => ({}) },
        plan: null,
        layouts: layoutResources(),
      }),
    ).toMatchObject({
      valid: false,
      resources: [],
      diagnostics: [{ code: "unlitBindGroupResource.nullDescriptorPlan" }],
    });
  });

  it("diagnoses missing layout resources", () => {
    const result = createUnlitBindGroups({
      device: { createBindGroup: () => ({}) },
      plan: createUnlitBindGroupDescriptorPlan({
        viewUniformResourceKey: "view",
        worldTransformResourceKey: "transforms",
        materialResourceKey: "material",
      }),
      layouts: layoutResources().filter((layout) => layout.group !== 1),
    });

    expect(result.valid).toBe(false);
    expect(result.resources.map((resource) => resource.group)).toEqual([0, 2]);
    expect(result.diagnostics).toMatchObject([
      { code: "unlitBindGroupResource.missingLayout", group: 1 },
    ]);
  });

  it("diagnoses bind group layout metadata mismatches", () => {
    const result = createUnlitBindGroups({
      device: { createBindGroup: () => ({}) },
      plan: {
        valid: true,
        diagnostics: [],
        entries: [
          {
            group: 2,
            binding: 0,
            resourceKey: "material",
            resourceKind: "texture-view",
          },
          {
            group: 2,
            binding: 0,
            resourceKey: "material:duplicate",
            resourceKind: "buffer",
          },
        ],
      },
      layouts: [
        {
          group: 2,
          layoutKey: "layout:2",
          layout: { group: 2 },
          metadata: createUnlitBindGroupLayoutMetadata(2, "layout:2"),
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitBindGroupResource.resourceKindMismatch",
      "unlitBindGroupResource.duplicateBinding",
    ]);
  });

  it("diagnoses missing required layout bindings", () => {
    const result = createUnlitBindGroups({
      device: { createBindGroup: () => ({}) },
      plan: {
        valid: true,
        diagnostics: [],
        entries: [
          {
            group: 2,
            binding: 1,
            resourceKey: "texture:albedo",
            resourceKind: "texture-view",
          },
        ],
      },
      layouts: [
        {
          group: 2,
          layoutKey: "layout:2",
          layout: { group: 2 },
          metadata: createUnlitBindGroupLayoutMetadata(2, "layout:2"),
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitBindGroupResource.missingRequiredBinding",
    ]);
    expect(result.diagnostics[0]).toMatchObject({ group: 2, binding: 0 });
  });

  it("diagnoses skipped required groups before creation", () => {
    const result = createUnlitBindGroups({
      device: { createBindGroup: () => ({}) },
      plan: {
        valid: true,
        diagnostics: [],
        entries: [
          {
            group: 2,
            binding: 0,
            resourceKey: "material",
            resourceKind: "buffer",
          },
        ],
      },
      layouts: layoutResources(),
      requiredGroups: [0, 1, 2],
    });

    expect(result.valid).toBe(false);
    expect(result.resources.map((resource) => resource.group)).toEqual([2]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitBindGroupResource.skippedRequiredGroup",
      "unlitBindGroupResource.skippedRequiredGroup",
    ]);
  });

  it("diagnoses missing device support", () => {
    expect(
      createUnlitBindGroups({
        device: {},
        plan: createUnlitBindGroupDescriptorPlan({
          viewUniformResourceKey: "view",
          worldTransformResourceKey: "transforms",
          materialResourceKey: "material",
        }),
        layouts: layoutResources(),
      }),
    ).toMatchObject({
      valid: false,
      resources: [],
      diagnostics: [{ code: "unlitBindGroupResource.missingDeviceSupport" }],
    });
  });
});

function layoutResources(): UnlitBindGroupLayoutResource[] {
  return [
    { group: 0, layoutKey: "layout:0", layout: { group: 0 } },
    { group: 1, layoutKey: "layout:1", layout: { group: 1 } },
    { group: 2, layoutKey: "layout:2", layout: { group: 2 } },
  ];
}
