import { describe, expect, it } from "vitest";

import {
  APERTURE_LIT_CONTRACT_VERSION,
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  createBoxMeshAsset,
  createCustomWgslMaterialAsset,
  createPreparedCustomWgslMaterial,
  type CustomWgslMaterialAsset,
  type LightPacket,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type PreparedCustomWgslMaterial,
} from "@aperture-engine/render";
import {
  createCustomWgslAppFrameResources,
  createCustomWgslLitFrameCache,
  getOrCreateCustomWgslLitPipelineLayout,
  prepareCustomWgslLitFrameResources,
  type CustomWgslLitDiagnostic,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu/test-support";

// A1 (three.js parity plan): fake-device coverage for the lit contract frame
// resources — the group(3) layout/bind group are created once and reused
// across frames (counters), lit pipelines compile against the explicit
// pipeline layout, and devices without the required creators fall back with
// a structured diagnostic instead of a device error.

const LIT_WGSL = `
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) worldPosition: vec3f,
  @location(1) worldNormal: vec3f,
};

@vertex
fn vs_main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[instanceIndex] * vec4f(position, 1.0);
  output.position = view.viewProjection * world;
  output.worldPosition = world.xyz;
  output.worldNormal = normal;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let viewDir = normalize(view.cameraPosition.xyz - input.worldPosition);
  var direct = vec3f(0.0);
  for (var i = 0u; i < apertureCountLights(); i = i + 1u) {
    direct = direct + apertureEvaluateLight(i, input.worldPosition, input.worldNormal, viewDir);
  }
  return vec4f(direct * apertureDirectionalShadow(input.worldPosition, input.worldNormal), 1.0);
}
`;

interface FakeDeviceLog {
  readonly bindGroupLayouts: { label?: string }[];
  readonly pipelineLayouts: { bindGroupLayouts: unknown[] }[];
  readonly bindGroups: {
    label: string;
    layout: unknown;
    entries: readonly { binding: number; resource: unknown }[];
  }[];
  readonly buffers: { label?: string; size: number; usage: number }[];
  readonly textures: { label?: string; format?: string }[];
  readonly samplers: { label?: string; compare?: string }[];
  readonly writes: { label: string | undefined; byteLength: number }[];
  readonly pipelines: WebGpuRenderPipelineCreateDescriptor[];
}

function newFakeDeviceLog(): FakeDeviceLog {
  return {
    bindGroupLayouts: [],
    pipelineLayouts: [],
    bindGroups: [],
    buffers: [],
    textures: [],
    samplers: [],
    writes: [],
    pipelines: [],
  };
}

function litDevice(log: FakeDeviceLog) {
  return {
    queue: {
      writeBuffer(
        buffer: unknown,
        _bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        _dataOffset?: number,
        size?: number,
      ) {
        log.writes.push({
          label: (buffer as { label?: string }).label,
          byteLength: size ?? data.byteLength,
        });
      },
    },
    createBuffer(raw: unknown) {
      const descriptor = raw as { label?: string; size: number; usage: number };

      log.buffers.push(descriptor);
      return { label: descriptor.label, descriptor };
    },
    createBindGroupLayout(raw: unknown) {
      const descriptor = raw as { label?: string };

      log.bindGroupLayouts.push(descriptor);
      return { layout: descriptor.label };
    },
    createPipelineLayout(raw: unknown) {
      const descriptor = raw as { bindGroupLayouts: unknown[] };

      log.pipelineLayouts.push(descriptor);
      return { pipelineLayout: descriptor };
    },
    createBindGroup(descriptor: {
      readonly label: string;
      readonly layout: unknown;
      readonly entries: readonly { binding: number; resource: unknown }[];
    }) {
      log.bindGroups.push({
        label: descriptor.label,
        layout: descriptor.layout,
        entries: descriptor.entries,
      });
      return { bindGroup: descriptor.label };
    },
    createTexture(raw: unknown) {
      const descriptor = raw as { label?: string; format?: string };

      log.textures.push(descriptor);
      return {
        createView(view?: unknown) {
          return {
            view:
              (view as { label?: string } | undefined)?.label ??
              descriptor.label,
          };
        },
      };
    },
    createSampler(raw: unknown) {
      const descriptor = raw as { label?: string; compare?: string };

      log.samplers.push(descriptor);
      return { sampler: descriptor.label };
    },
    createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
      return {
        descriptor,
        compilationInfo: async () => ({ messages: [] }),
      };
    },
    createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
      log.pipelines.push(descriptor);
      return {
        descriptor,
        getBindGroupLayout(group: number) {
          return { group };
        },
      };
    },
  };
}

function litMaterial(): {
  source: CustomWgslMaterialAsset;
  prepared: PreparedCustomWgslMaterial;
} {
  const source = createCustomWgslMaterialAsset({
    familyKey: "test/lit-sphere",
    label: "Lit Sphere",
    shader: { kind: "inline-wgsl", code: LIT_WGSL, virtualPath: "lit.wgsl" },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    lighting: "lit",
    bindings: [],
  });
  const prepared = createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:lit-sphere",
    shaderCode: LIT_WGSL,
    shaderSourceKey: "inline:material:lit-sphere:lit.wgsl",
  });

  return { source, prepared };
}

function newReuseCounters(): {
  litBindGroupsCreated: number;
  litBindGroupsReused: number;
  dynamicBufferWrites: number;
} {
  return {
    litBindGroupsCreated: 0,
    litBindGroupsReused: 0,
    dynamicBufferWrites: 0,
  };
}

function litSnapshot(intensity: number): {
  lights: LightPacket[];
  transforms: Float32Array;
} {
  return {
    lights: [
      {
        lightId: 1,
        entity: { index: 1, generation: 0 },
        kind: "directional",
        color: [1, 1, 1, 1],
        intensity,
        range: 0,
        innerConeAngle: 0,
        outerConeAngle: 0,
        worldTransformOffset: 0,
        layerMask: 1,
      },
    ],
    transforms: identityTransforms(1),
  };
}

function identityTransforms(count: number): Float32Array {
  const data = new Float32Array(count * 16);

  for (let index = 0; index < count; index += 1) {
    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], index * 16);
  }

  return data;
}

function packedViews(count: number): PackedSnapshotViewUniforms {
  const data = new Float32Array(count * PACKED_VIEW_UNIFORM_FLOAT_STRIDE);

  for (let index = 0; index < count; index += 1) {
    const offset = index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE;

    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], offset);
    data.set([index, 0, 1, 1], offset + 16);
  }

  return {
    data,
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index + 1,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

function packedTransforms(count: number): PackedSnapshotTransforms {
  return {
    data: identityTransforms(count),
    offsets: Array.from({ length: count }, (_, index) => ({
      renderId: index + 7,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

describe("custom WGSL lit frame resources", () => {
  it("creates the group(3) layout and bind group once and reuses them across frames", () => {
    const log = newFakeDeviceLog();
    const device = litDevice(log);
    const cache = createCustomWgslLitFrameCache();
    const reuse = newReuseCounters();
    const snapshot = litSnapshot(2);

    const first = prepareCustomWgslLitFrameResources({
      device,
      snapshot,
      viewUniforms: packedViews(1),
      cache,
      reuse,
    });

    expect(first.diagnostics).toEqual([]);
    expect(first.valid).toBe(true);
    expect(first.bindGroup?.group).toBe(3);
    expect(first.bindGroup?.entryResourceKeys).toContain(
      first.bindGroup?.resourceKey,
    );
    // group(3) lit layout + group(0)/group(1) shared layouts.
    expect(log.bindGroupLayouts).toHaveLength(3);
    expect(log.bindGroups).toHaveLength(1);
    expect(log.bindGroups[0]?.entries.map((entry) => entry.binding)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(reuse.litBindGroupsCreated).toBe(1);

    const second = prepareCustomWgslLitFrameResources({
      device,
      snapshot,
      viewUniforms: packedViews(1),
      cache,
      reuse,
    });

    expect(second.valid).toBe(true);
    expect(second.bindGroup).toBe(first.bindGroup);
    expect(log.bindGroupLayouts).toHaveLength(3);
    expect(log.bindGroups).toHaveLength(1);
    expect(reuse.litBindGroupsCreated).toBe(1);
    expect(reuse.litBindGroupsReused).toBe(1);
  });

  it("streams light changes through queue.writeBuffer without rebuilding the bind group", () => {
    const log = newFakeDeviceLog();
    const device = litDevice(log);
    const cache = createCustomWgslLitFrameCache();
    const reuse = newReuseCounters();

    prepareCustomWgslLitFrameResources({
      device,
      snapshot: litSnapshot(2),
      viewUniforms: packedViews(1),
      cache,
      reuse,
    });

    const writesAfterFirst = reuse.dynamicBufferWrites;
    const bindGroupsAfterFirst = log.bindGroups.length;

    // Same lights: no writes, no bind group churn.
    prepareCustomWgslLitFrameResources({
      device,
      snapshot: litSnapshot(2),
      viewUniforms: packedViews(1),
      cache,
      reuse,
    });

    expect(reuse.dynamicBufferWrites).toBe(writesAfterFirst);

    // Changed intensity: a dirty-window write on the persistent float buffer,
    // still no bind group churn (buffer identity is stable).
    prepareCustomWgslLitFrameResources({
      device,
      snapshot: litSnapshot(3),
      viewUniforms: packedViews(1),
      cache,
      reuse,
    });

    expect(reuse.dynamicBufferWrites).toBe(writesAfterFirst + 1);
    expect(log.bindGroups).toHaveLength(bindGroupsAfterFirst);
    expect(reuse.litBindGroupsReused).toBe(2);
  });

  it("binds fallback resources when the frame has no lights, shadows, or environment", () => {
    const log = newFakeDeviceLog();
    const device = litDevice(log);
    const cache = createCustomWgslLitFrameCache();
    const reuse = newReuseCounters();

    const result = prepareCustomWgslLitFrameResources({
      device,
      snapshot: { lights: [], transforms: identityTransforms(1) },
      viewUniforms: packedViews(1),
      cache,
      reuse,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
    // Fallback storage + params only — no per-light buffers were needed.
    expect(
      log.buffers.map((buffer) => buffer.label ?? "unnamed").sort(),
    ).toEqual(["custom-wgsl-lit/fallback-storage", "custom-wgsl-lit/params"]);
    expect(
      log.textures.map((texture) => texture.format ?? "unknown").sort(),
    ).toEqual(["depth24plus", "rgba8unorm", "rgba8unorm"]);
    expect(
      log.samplers.some((sampler) => sampler.compare === "less-equal"),
    ).toBe(true);
    expect(log.bindGroups[0]?.entries).toHaveLength(10);
  });

  it("falls back cleanly when the device lacks the lit contract creators", () => {
    const log = newFakeDeviceLog();
    const device = litDevice(log) as Record<string, unknown>;

    delete device.createTexture;

    const result = prepareCustomWgslLitFrameResources({
      device,
      snapshot: litSnapshot(1),
      viewUniforms: packedViews(1),
      cache: createCustomWgslLitFrameCache(),
      reuse: newReuseCounters(),
    });

    expect(result.valid).toBe(false);
    expect(result.bindGroup).toBeNull();
    expect(result.diagnostics).toMatchObject([
      { code: "customWgslMaterial.litContractUnavailable", severity: "error" },
    ]);
  });

  it("compiles lit materials against the explicit pipeline layout and attaches the lit bind group", async () => {
    const log = newFakeDeviceLog();
    const device = litDevice(log);
    const cache = createCustomWgslLitFrameCache();
    const reuse = newReuseCounters();
    const { prepared } = litMaterial();

    expect(prepared.lighting).toBe("lit");
    expect(prepared.pipelineKey.split("|")).toContain(
      `lit:v${APERTURE_LIT_CONTRACT_VERSION}`,
    );

    const litFrame = prepareCustomWgslLitFrameResources({
      device,
      snapshot: litSnapshot(2),
      viewUniforms: packedViews(1),
      cache,
      reuse,
    });
    const litDiagnostics: CustomWgslLitDiagnostic[] = [];
    const pipelineLayout = getOrCreateCustomWgslLitPipelineLayout({
      device,
      cache,
      material: prepared,
      diagnostics: litDiagnostics,
    });

    expect(litDiagnostics).toEqual([]);
    expect(pipelineLayout).not.toBeNull();
    // view + transforms + material(2) + lit(3).
    expect(log.pipelineLayouts[0]?.bindGroupLayouts).toHaveLength(4);

    // Cached per material bind-group-layout identity.
    expect(
      getOrCreateCustomWgslLitPipelineLayout({
        device,
        cache,
        material: prepared,
        diagnostics: litDiagnostics,
      }),
    ).toBe(pipelineLayout);
    expect(log.pipelineLayouts).toHaveLength(1);

    const frame = await createCustomWgslAppFrameResources({
      device,
      mesh: createBoxMeshAsset({ label: "Lit Sphere" }),
      material: prepared,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      lit: {
        pipelineLayout,
        bindGroup: litFrame.bindGroup!,
      },
    });

    expect(frame.diagnostics).toEqual([]);
    expect(frame.valid).toBe(true);
    // The pipeline compiled against the EXPLICIT layout, not "auto".
    expect(log.pipelines[0]?.layout).toBe(pipelineLayout);

    const litBindGroups = frame.resources?.bindGroups.filter(
      (bindGroup) => bindGroup.group === 3,
    );

    expect(litBindGroups).toHaveLength(1);
    // Pipeline-scoped match key so the draw-list binder selects it per lit
    // pipeline (and never for unlit/standard commands).
    expect(litBindGroups?.[0]?.entryResourceKeys).toContain(
      frame.pipeline?.cacheKey,
    );
  });
});
