import { describe, expect, it } from "vitest";
import { PACKED_VIEW_UNIFORM_FLOAT_STRIDE } from "@aperture-engine/render";
import {
  createMatcapFrameGpuResources,
  createMatcapMaterialAsset,
  createMatcapMaterialBindGroupLayoutPlan,
  createPlaneMeshAsset,
  createSamplerHandle,
  createTextureHandle,
  type MatcapFrameGpuResourceDeviceLike,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type SamplerGpuResource,
  type TextureGpuResource,
  type UnlitBindGroupLayoutResource,
} from "@aperture-engine/webgpu";

describe("matcap frame GPU resource assembly", () => {
  it("uploads shared frame resources and creates a matcap material bind group", () => {
    const writes: unknown[] = [];
    const bindGroups: unknown[] = [];
    const result = createMatcapFrameGpuResources({
      device: deviceWithResources(writes, bindGroups),
      mesh: createPlaneMeshAsset({ label: "Matcap Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      material: createMatcapMaterialAsset({
        label: "Studio Matcap",
        baseColorFactor: new Float32Array([0.7, 0.8, 0.9, 1]),
        matcapTexture: {
          texture: createTextureHandle("studio"),
          sampler: createSamplerHandle("linear"),
        },
      }),
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
      textures: [textureResource("texture:studio", { label: "studio-view" })],
      samplers: [samplerResource("sampler:linear", { label: "linear" })],
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.resources).toMatchObject({
      mesh: { resourceKey: "mesh-buffer:Matcap Quad" },
      viewUniform: {
        resourceKey: "view-uniform-buffer:ViewUniforms/uniform",
      },
      worldTransforms: {
        resourceKey: "world-transform-buffer:WorldTransforms/storage",
      },
      material: { resourceKey: "material-buffer:Studio Matcap/uniform" },
      materialBindGroup: {
        group: 2,
        resourceKey:
          "bind-group:matcap/group-2/0:material-buffer:Studio Matcap/uniform/1:texture:studio/2:sampler:linear",
      },
    });
    expect(result.resources?.bindGroups.map((group) => group.group)).toEqual([
      0, 1, 2,
    ]);
    expect(writes).toHaveLength(5);
    expect(bindGroups).toHaveLength(3);
    expect(bindGroups.at(-1)).toMatchObject({
      label: "matcap/group-2",
      entries: [
        { binding: 0, resource: { buffer: expect.any(Object) as unknown } },
        { binding: 1, resource: { label: "studio-view" } },
        { binding: 2, resource: { label: "linear" } },
      ],
    });
  });

  it("reports missing matcap texture and sampler resources", () => {
    const result = createMatcapFrameGpuResources({
      device: deviceWithResources([], []),
      mesh: createPlaneMeshAsset({ label: "Matcap Quad" }),
      viewUniforms: packedViews(),
      worldTransforms: packedTransforms(),
      material: createMatcapMaterialAsset({
        label: "Missing Matcap",
        matcapTexture: {
          texture: createTextureHandle("missing-studio"),
          sampler: createSamplerHandle("missing-linear"),
        },
      }),
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
      textures: [],
      samplers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "matcapMaterialBindGroupResource.missingTextureResource",
    );
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "matcapMaterialBindGroupResource.missingSamplerResource",
    );
  });

  it("reports missing required frame inputs without returning resources", () => {
    const result = createMatcapFrameGpuResources({
      device: deviceWithResources([], []),
      mesh: null,
      viewUniforms: null,
      worldTransforms: null,
      material: null,
      sharedLayouts: sharedLayoutResources(),
      materialLayout: materialLayoutResource(),
      textures: [],
      samplers: [],
    });

    expect(result.valid).toBe(false);
    expect(result.resources).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "matcapFrameResources.missingMesh",
      "matcapFrameResources.missingViewUniforms",
      "matcapFrameResources.missingWorldTransforms",
      "matcapFrameResources.missingMaterial",
      "unlitBindGroup.missingViewResource",
      "unlitBindGroup.missingTransformResource",
      "unlitBindGroupResource.invalidDescriptorPlan",
      "unlitBindGroupResource.skippedRequiredGroup",
      "unlitBindGroupResource.skippedRequiredGroup",
      "matcapMaterialBindGroupResource.nullDescriptorPlan",
    ]);
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
    data: identityViewUniforms(1),
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

function identityViewUniforms(count: number): Float32Array {
  const data = new Float32Array(count * PACKED_VIEW_UNIFORM_FLOAT_STRIDE);

  for (let index = 0; index < count; index += 1) {
    const offset = index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE;

    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], offset);
    data.set([0, 0, 1, 1], offset + 16);
  }

  return data;
}

function sharedLayoutResources(): UnlitBindGroupLayoutResource[] {
  return [
    { group: 0, layoutKey: "layout:0", layout: { group: 0 } },
    { group: 1, layoutKey: "layout:1", layout: { group: 1 } },
  ];
}

function materialLayoutResource() {
  return {
    group: 2,
    layoutKey: "matcap/group-2",
    layout: { group: 2 },
    descriptor: createMatcapMaterialBindGroupLayoutPlan().layout,
  };
}

function deviceWithResources(
  writes: unknown[],
  bindGroups: unknown[],
): MatcapFrameGpuResourceDeviceLike {
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
