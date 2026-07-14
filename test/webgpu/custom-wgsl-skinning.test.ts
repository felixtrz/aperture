import { describe, expect, it } from "vitest";

import {
  APERTURE_SKINNED_JOINTS_LOCATION,
  APERTURE_SKINNED_WEIGHTS_LOCATION,
  createBoxMeshAsset,
  createCustomWgslMaterialAsset,
  createPreparedCustomWgslMaterial,
  type CustomWgslMaterialAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type PreparedCustomWgslMaterial,
} from "@aperture-engine/render";
import {
  createBrowserCustomWgslMaterialPipelineDescriptor,
  createCustomWgslAppFrameResources,
  createCustomWgslLitFrameCache,
  createCustomWgslSkinnedTransformBindGroupLayoutDescriptor,
  getOrCreateCustomWgslLitPipelineLayout,
  prepareCustomWgslLitFrameResources,
  requiredBindGroupGroupsForPipelineKey,
  UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT,
  type CustomWgslLitDiagnostic,
} from "@aperture-engine/webgpu/test-support";

// F3 (three.js parity plan): WebGPU-side coverage for the skinning contract —
// the skinned vertex-buffer layout (JOINTS_0/WEIGHTS_0), the unchanged required
// bind groups (the palette is @group(1) @binding(1), not a new group), the
// group(1) transforms+palette layout, the lit+skinned pipeline layout (still 4
// groups), and the frame-resources joint-palette binding.

const SKIN_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @location(8) joints0: vec4u,
  @location(9) weights0: vec4f,
  @builtin(instance_index) instanceIndex: u32,
};

@vertex
fn vs_main(input: VertexInput) -> @builtin(position) vec4f {
  let skinned = apertureSkin(input.position, input.normal, input.joints0, input.weights0);
  let world = worldTransforms[input.instanceIndex] * vec4f(skinned.position, 1.0);
  return view.viewProjection * world;
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0);
}
`;

function skinnedMaterial(options: {
  readonly skinned?: boolean;
  readonly lighting?: CustomWgslMaterialAsset["lighting"];
}): PreparedCustomWgslMaterial {
  const source = createCustomWgslMaterialAsset({
    familyKey: "test/skinned-strip",
    label: "Skinned Strip",
    shader: { kind: "inline-wgsl", code: SKIN_WGSL, virtualPath: "skin.wgsl" },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    ...(options.skinned === undefined ? {} : { skinned: options.skinned }),
    ...(options.lighting === undefined ? {} : { lighting: options.lighting }),
    bindings: [],
  });

  return createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:skinned-strip",
    shaderCode: SKIN_WGSL,
    shaderSourceKey: "inline:material:skinned-strip:skin.wgsl",
  });
}

describe("custom WGSL skinning WebGPU resources", () => {
  it("adds the JOINTS_0/WEIGHTS_0 vertex attributes only when skinned", () => {
    const skinnedDescriptor = createBrowserCustomWgslMaterialPipelineDescriptor(
      {
        material: skinnedMaterial({ skinned: true }),
        shaderModule: { kind: "shader-module" },
        colorFormat: "bgra8unorm",
        depthFormat: "depth24plus",
      },
    );
    const skinnedBuffers = (
      skinnedDescriptor.vertex as {
        buffers: readonly {
          arrayStride: number;
          attributes: readonly {
            shaderLocation: number;
            offset: number;
            format: string;
          }[];
        }[];
      }
    ).buffers;

    expect(skinnedBuffers).toHaveLength(1);
    expect(skinnedBuffers[0]?.arrayStride).toBe(56);
    expect(skinnedBuffers[0]?.attributes).toEqual([
      { shaderLocation: 0, offset: 0, format: "float32x3" },
      { shaderLocation: 1, offset: 12, format: "float32x3" },
      { shaderLocation: 2, offset: 24, format: "float32x2" },
      {
        shaderLocation: APERTURE_SKINNED_JOINTS_LOCATION,
        offset: 32,
        format: "uint16x4",
      },
      {
        shaderLocation: APERTURE_SKINNED_WEIGHTS_LOCATION,
        offset: 40,
        format: "float32x4",
      },
    ]);

    // A non-skinned material keeps the byte-identical POSITION/NORMAL/UV layout.
    const plainDescriptor = createBrowserCustomWgslMaterialPipelineDescriptor({
      material: skinnedMaterial({ skinned: false }),
      shaderModule: { kind: "shader-module" },
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
    });

    expect(
      (plainDescriptor.vertex as { buffers: readonly unknown[] }).buffers,
    ).toEqual([UNLIT_PRIMITIVE_VERTEX_BUFFER_LAYOUT]);
  });

  it("keeps the required bind groups unchanged when skinned (palette is a binding in group(1), not a new group)", () => {
    const plain = skinnedMaterial({ skinned: false });
    const skinned = skinnedMaterial({ skinned: true });
    const litSkinned = skinnedMaterial({ skinned: true, lighting: "lit" });
    const litOnly = skinnedMaterial({ lighting: "lit" });

    // Skinning adds no group — the joint palette is @group(1) @binding(1).
    expect(
      requiredBindGroupGroupsForPipelineKey(plain.pipeline.pipelineKey),
    ).toEqual([0, 1, 2]);
    expect(
      requiredBindGroupGroupsForPipelineKey(skinned.pipeline.pipelineKey),
    ).toEqual([0, 1, 2]);
    expect(
      requiredBindGroupGroupsForPipelineKey(litOnly.pipeline.pipelineKey),
    ).toEqual([0, 1, 2, 3]);
    // Composition: lit (group 3) + skinned (group(1) binding(1)), no collision.
    expect(
      requiredBindGroupGroupsForPipelineKey(litSkinned.pipeline.pipelineKey),
    ).toEqual([0, 1, 2, 3]);
  });

  it("describes the group(1) skinned transform layout as transforms + joint palette (both vertex read-only storage)", () => {
    expect(createCustomWgslSkinnedTransformBindGroupLayoutDescriptor()).toEqual(
      {
        label: "custom-wgsl/skinned/group-1@v1",
        entries: [
          {
            binding: 0,
            // 1 === GPUShaderStage.VERTEX (transforms + skinning run in vertex).
            visibility: 1,
            buffer: { type: "read-only-storage" },
          },
          {
            binding: 1,
            visibility: 1,
            buffer: { type: "read-only-storage" },
          },
        ],
      },
    );
  });

  it("swaps group(1) for the transforms+palette layout in the lit+skinned pipeline layout (still 4 groups)", () => {
    const pipelineLayouts: { bindGroupLayouts: unknown[] }[] = [];
    const device = {
      createBindGroupLayout(raw: unknown) {
        return { layout: (raw as { label?: string }).label };
      },
      createPipelineLayout(raw: unknown) {
        const descriptor = raw as { bindGroupLayouts: unknown[] };
        pipelineLayouts.push(descriptor);
        return { pipelineLayout: descriptor };
      },
      createBindGroup() {
        return { kind: "bind-group" };
      },
      createBuffer() {
        return { kind: "buffer" };
      },
      createTexture() {
        return { createView: () => ({ kind: "view" }) };
      },
      createSampler() {
        return { kind: "sampler" };
      },
      queue: { writeBuffer() {} },
    };
    const cache = createCustomWgslLitFrameCache();

    // Populate the lit layouts (view/transform/material/lit) via a light-free
    // frame; then request the lit+skinned pipeline layout.
    prepareCustomWgslLitFrameResources({
      device,
      snapshot: { lights: [], transforms: new Float32Array(16) },
      viewUniforms: { data: new Float32Array(0), views: [], diagnostics: [] },
      cache,
      reuse: {
        litBindGroupsCreated: 0,
        litBindGroupsReused: 0,
        dynamicBufferWrites: 0,
      },
    });

    const diagnostics: CustomWgslLitDiagnostic[] = [];
    const litLayout = getOrCreateCustomWgslLitPipelineLayout({
      device,
      cache,
      material: skinnedMaterial({ lighting: "lit" }),
      diagnostics,
    });
    const litSkinnedLayout = getOrCreateCustomWgslLitPipelineLayout({
      device,
      cache,
      material: skinnedMaterial({ skinned: true, lighting: "lit" }),
      diagnostics,
    });

    expect(diagnostics).toEqual([]);
    expect(litLayout).not.toBeNull();
    expect(litSkinnedLayout).not.toBeNull();
    // Both are 4 groups [view, transform, material, lit]; the lit+skinned one
    // swaps group(1) for the transforms+palette layout (no extra group).
    for (const descriptor of pipelineLayouts) {
      expect(descriptor.bindGroupLayouts).toHaveLength(4);
    }
    const litOnlyDescriptor = pipelineLayouts.find(
      (descriptor) =>
        (descriptor.bindGroupLayouts[1] as { layout?: string }).layout ===
        "custom-wgsl/lit/group-1@v1",
    );
    const litSkinnedDescriptor = pipelineLayouts.find(
      (descriptor) =>
        (descriptor.bindGroupLayouts[1] as { layout?: string }).layout ===
        "custom-wgsl/skinned/group-1@v1",
    );

    expect(litOnlyDescriptor).toBeDefined();
    expect(litSkinnedDescriptor).toBeDefined();
  });

  it("binds the joint palette at group(1) binding(1) in the skinned frame resources", async () => {
    const bindGroupDescriptors: {
      label: string;
      layout: unknown;
      entries: readonly { binding: number; resource: unknown }[];
    }[] = [];
    const device = {
      queue: { writeBuffer() {} },
      createShaderModule() {
        return { compilationInfo: async () => ({ messages: [] }) };
      },
      createRenderPipeline() {
        return {
          kind: "render-pipeline",
          getBindGroupLayout(group: number) {
            return { group };
          },
        };
      },
      createBuffer(raw: unknown) {
        const descriptor = raw as { label?: string };
        return { label: descriptor.label, descriptor };
      },
      createBindGroup(descriptor: {
        label: string;
        layout: unknown;
        entries: readonly { binding: number; resource: unknown }[];
      }) {
        bindGroupDescriptors.push(descriptor);
        return { bindGroup: descriptor.label };
      },
    };
    const skinBuffer = { kind: "skin-joint-buffer" };
    const frame = await createCustomWgslAppFrameResources({
      device,
      mesh: createBoxMeshAsset({ label: "Skinned Strip" }),
      material: skinnedMaterial({ skinned: true }),
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      skin: { buffer: skinBuffer, resourceKey: "skin:render:1" },
    });

    expect(frame.diagnostics).toEqual([]);
    expect(frame.valid).toBe(true);

    // The joint palette rides the group(1) transforms bind group (binding 1),
    // not a separate group.
    const groupOneBindGroups = frame.resources?.bindGroups.filter(
      (bindGroup) => bindGroup.group === 1,
    );

    expect(groupOneBindGroups).toHaveLength(1);
    // The palette resource key + the pipeline cache key are match keys, so the
    // draw-list binder pipeline-scopes the group(1) bind group.
    expect(groupOneBindGroups?.[0]?.entryResourceKeys).toContain(
      "skin:render:1",
    );
    expect(groupOneBindGroups?.[0]?.entryResourceKeys).toContain(
      frame.pipeline?.cacheKey,
    );
    // The group(1) descriptor binds the world transforms (binding 0) AND the
    // joint palette (binding 1).
    const transformDescriptor = bindGroupDescriptors.find(
      (descriptor) => descriptor.label === "unlit/group-1",
    );
    expect(transformDescriptor?.entries).toHaveLength(2);
    expect(
      transformDescriptor?.entries.find((entry) => entry.binding === 1)
        ?.resource,
    ).toEqual({ buffer: skinBuffer });
  });
});

function packedViews(count: number): PackedSnapshotViewUniforms {
  return {
    data: new Float32Array(count * 24),
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index + 1,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

function packedTransforms(count: number): PackedSnapshotTransforms {
  const data = new Float32Array(count * 16);

  for (let index = 0; index < count; index += 1) {
    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], index * 16);
  }

  return {
    data,
    offsets: Array.from({ length: count }, (_, index) => ({
      renderId: index + 1,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}
