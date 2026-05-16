import { describe, expect, it } from "vitest";

import {
  createSamplerHandle,
  createPlaneMeshAsset,
  createTextureHandle,
  createMultiMaterialUnlitFrameGpuResources,
  createUnlitFrameGpuResources,
  createUnlitMaterialAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type SamplerGpuResource,
  type TextureGpuResource,
  type UnlitBindGroupCreationDescriptor,
  type UnlitBindGroupLayoutResource,
  type UnlitFrameGpuResourceDeviceLike,
} from "../../src/index.js";

describe("unlit frame GPU resource upload", () => {
  it("uploads mesh, frame buffers, material buffers, and actual bind groups", () => {
    const writes: unknown[] = [];
    const bindGroups: UnlitBindGroupCreationDescriptor[] = [];
    const result = createUnlitFrameGpuResources({
      device: deviceWithResources(writes, bindGroups),
      mesh: createPlaneMeshAsset({ label: "Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      material: createUnlitMaterialAsset({
        label: "White",
        baseColorFactor: new Float32Array([1, 1, 1, 1]),
      }),
      layouts: layoutResources(),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      mesh: { resourceKey: "mesh-buffer:Quad" },
      viewUniform: {
        resourceKey: "view-uniform-buffer:ViewUniforms/uniform",
      },
      worldTransforms: {
        resourceKey: "world-transform-buffer:WorldTransforms/storage",
      },
      material: { resourceKey: "material-buffer:White/uniform" },
      bindGroups: [
        {
          group: 0,
          resourceKey:
            "bind-group:unlit/group-0/0:view-uniform-buffer:ViewUniforms/uniform",
        },
        {
          group: 1,
          resourceKey:
            "bind-group:unlit/group-1/0:world-transform-buffer:WorldTransforms/storage",
        },
        {
          group: 2,
          resourceKey:
            "bind-group:unlit/group-2/0:material-buffer:White/uniform",
        },
      ],
    });
    expect(writes).toHaveLength(5);
    expect(bindGroups).toMatchObject([
      { entries: [{ resource: { buffer: expect.any(Object) as unknown } }] },
      { entries: [{ resource: { buffer: expect.any(Object) as unknown } }] },
      { entries: [{ resource: { buffer: expect.any(Object) as unknown } }] },
    ]);
  });

  it("uploads textured material bind groups with texture views and samplers", () => {
    const writes: unknown[] = [];
    const bindGroups: UnlitBindGroupCreationDescriptor[] = [];
    const result = createUnlitFrameGpuResources({
      device: deviceWithResources(writes, bindGroups),
      mesh: createPlaneMeshAsset({ label: "Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      material: createUnlitMaterialAsset({
        label: "Textured",
        baseColorTexture: {
          texture: createTextureHandle("albedo"),
          sampler: createSamplerHandle("linear"),
        },
      }),
      layouts: layoutResources(),
      textures: [textureResource("texture:albedo", { label: "albedo-view" })],
      samplers: [samplerResource("sampler:linear", { label: "linear" })],
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.resources?.bindGroups.find((group) => group.group === 2),
    ).toMatchObject({
      resourceKey:
        "bind-group:unlit/group-2/0:material-buffer:Textured/uniform/1:texture:albedo/2:sampler:linear",
      entryResourceKeys: [
        "material-buffer:Textured/uniform",
        "texture:albedo",
        "sampler:linear",
      ],
    });
    expect(bindGroups.at(-1)).toMatchObject({
      label: "unlit/group-2",
      entries: [
        { binding: 0, resource: { buffer: expect.any(Object) as unknown } },
        { binding: 1, resource: { label: "albedo-view" } },
        { binding: 2, resource: { label: "linear" } },
      ],
    });
  });

  it("reports missing textured material GPU resources", () => {
    const result = createUnlitFrameGpuResources({
      device: deviceWithResources([], []),
      mesh: createPlaneMeshAsset({ label: "Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      material: createUnlitMaterialAsset({
        label: "Textured",
        baseColorTexture: {
          texture: createTextureHandle("missing-albedo"),
          sampler: createSamplerHandle("missing-linear"),
        },
      }),
      layouts: layoutResources(),
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitBindGroupResource.missingTextureResource",
      "unlitBindGroupResource.missingSamplerResource",
    ]);
  });

  it("uploads shared frame resources and deterministic bind groups for multiple materials", () => {
    const writes: unknown[] = [];
    const bindGroups: UnlitBindGroupCreationDescriptor[] = [];
    const result = createMultiMaterialUnlitFrameGpuResources({
      device: deviceWithResources(writes, bindGroups),
      mesh: createPlaneMeshAsset({ label: "Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      materials: [
        createUnlitMaterialAsset({
          label: "Red",
          baseColorFactor: new Float32Array([1, 0, 0, 1]),
        }),
        createUnlitMaterialAsset({
          label: "Blue",
          baseColorFactor: new Float32Array([0, 0, 1, 1]),
        }),
      ],
      layouts: layoutResources(),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      mesh: { resourceKey: "mesh-buffer:Quad" },
      viewUniform: {
        resourceKey: "view-uniform-buffer:ViewUniforms/uniform",
      },
      worldTransforms: {
        resourceKey: "world-transform-buffer:WorldTransforms/storage",
      },
      materials: [
        { resourceKey: "material-buffer:Red/uniform" },
        { resourceKey: "material-buffer:Blue/uniform" },
      ],
      bindGroups: [
        {
          group: 0,
          resourceKey:
            "bind-group:unlit/group-0/0:view-uniform-buffer:ViewUniforms/uniform",
        },
        {
          group: 1,
          resourceKey:
            "bind-group:unlit/group-1/0:world-transform-buffer:WorldTransforms/storage",
        },
        {
          group: 2,
          resourceKey: "bind-group:unlit/group-2/0:material-buffer:Red/uniform",
        },
        {
          group: 2,
          resourceKey:
            "bind-group:unlit/group-2/0:material-buffer:Blue/uniform",
        },
      ],
    });
    expect(writes).toHaveLength(6);
    expect(bindGroups.map((descriptor) => descriptor.label)).toEqual([
      "unlit/group-0",
      "unlit/group-1",
      "unlit/group-2",
      "unlit/group-2",
    ]);
  });

  it("reports missing resource inputs without creating complete resources", () => {
    const result = createUnlitFrameGpuResources({
      device: deviceWithResources([], []),
      mesh: null,
      viewUniforms: null,
      worldTransforms: null,
      material: null,
      layouts: layoutResources(),
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "unlitFrameResources.missingMesh",
      "unlitFrameResources.missingViewUniforms",
      "unlitFrameResources.missingWorldTransforms",
      "unlitFrameResources.missingMaterial",
      "unlitBindGroup.missingViewResource",
      "unlitBindGroup.missingTransformResource",
      "unlitBindGroup.missingMaterialResource",
      "unlitBindGroupResource.invalidDescriptorPlan",
    ]);
  });

  it("reports missing multi-material data without returning complete resources", () => {
    const result = createMultiMaterialUnlitFrameGpuResources({
      device: deviceWithResources([], []),
      mesh: createPlaneMeshAsset({ label: "Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      materials: [null],
      layouts: layoutResources(),
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "unlitFrameResources.missingMaterial",
    );
  });
});

function textureResource(
  resourceKey: string,
  view: unknown,
): TextureGpuResource {
  return {
    resourceKey,
    texture: {},
    view,
    descriptor: {
      size: [2, 2, 1],
      format: "rgba8unorm",
      usage: 1,
    },
  };
}

function samplerResource(
  resourceKey: string,
  sampler: unknown,
): SamplerGpuResource {
  return {
    resourceKey,
    sampler,
    descriptor: {
      label: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
      addressModeW: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMinClamp: 0,
      lodMaxClamp: 32,
      maxAnisotropy: 1,
    },
  };
}

function packedViews(): PackedSnapshotViewUniforms {
  return {
    data: identityMatrices(1),
    views: [{ viewId: 1, sourceOffset: 0, packedOffset: 0 }],
    diagnostics: [],
  };
}

function packedTransforms(): PackedSnapshotTransforms {
  return {
    data: identityMatrices(1),
    offsets: [{ renderId: 7, sourceOffset: 0, packedOffset: 0 }],
    diagnostics: [],
  };
}

function identityMatrices(count: number): Float32Array {
  const data = new Float32Array(count * 16);

  for (let index = 0; index < count; index += 1) {
    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], index * 16);
  }

  return data;
}

function layoutResources(): UnlitBindGroupLayoutResource[] {
  return [
    { group: 0, layoutKey: "layout:0", layout: { group: 0 } },
    { group: 1, layoutKey: "layout:1", layout: { group: 1 } },
    { group: 2, layoutKey: "layout:2", layout: { group: 2 } },
  ];
}

function deviceWithResources(
  writes: unknown[],
  bindGroups: UnlitBindGroupCreationDescriptor[],
): UnlitFrameGpuResourceDeviceLike {
  return {
    queue: {
      writeBuffer: (buffer, bufferOffset, data, dataOffset, size) => {
        writes.push({ buffer, bufferOffset, data, dataOffset, size });
      },
    },
    createBuffer: (descriptor) => ({ descriptor }),
    createBindGroup: (descriptor) => {
      bindGroups.push(descriptor);
      return { descriptor };
    },
  };
}
