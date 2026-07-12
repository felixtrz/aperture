import { describe, expect, it } from "vitest";

import {
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  createBoxMeshAsset,
  createBufferAsset,
  createCustomWgslMaterialAsset,
  createDefaultRenderState,
  createPreparedCustomWgslMaterial,
  type BufferAssetData,
  type BufferElementType,
  type CustomWgslMaterialAsset,
  type PackedSnapshotTransforms,
  type PackedSnapshotViewUniforms,
  type PreparedCustomWgslMaterial,
  type RuntimeBufferPacket,
} from "@aperture-engine/render";
import {
  AssetRegistry,
  createBufferHandle,
  type BufferHandle,
} from "@aperture-engine/simulation";
import {
  createCustomWgslAppFrameResources,
  prepareCustomWgslAppStorageBufferBindingResources,
  type CustomWgslAppStorageBufferResource,
  type WebGpuRenderPipelineCreateDescriptor,
  type WebGpuShaderCreateDescriptor,
} from "@aperture-engine/webgpu/test-support";

const GRASS_WGSL = `
@group(2) @binding(0) var<storage, read> bendParams: array<vec4f>;

struct VertexOutput {
  @builtin(position) position: vec4f,
};

@vertex
fn vs_main(
  @location(0) position: vec3f,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position + vec3f(bendParams[instanceIndex].x, 0.0, 0.0), 1.0);
  return output;
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(0.2, 0.7, 0.2, 1.0);
}
`;

describe("custom WGSL storage-buffer app frame resources", () => {
  it("realizes a ready buffer asset as a cached read-only storage binding", () => {
    const { assets, handle } = registryWithBufferAsset({
      elementType: "vec4f",
      elementCount: 4,
      data: new Float32Array(16),
    });
    const { source, prepared } = storageMaterial(handle);
    const cache = new Map<string, CustomWgslAppStorageBufferResource>();
    const reuse = newReuseCounters();
    const createdBuffers: { descriptor: { usage: number; size: number } }[] =
      [];
    const device = storageDevice(createdBuffers);

    const first = prepareCustomWgslAppStorageBufferBindingResources({
      assets,
      device,
      cache,
      reuse,
      source,
      material: prepared,
    });

    expect(first.diagnostics).toEqual([]);
    expect(first.valid).toBe(true);
    expect(first.resources).toHaveLength(1);
    expect(first.resources[0]?.resourceKey).toBe(
      prepared.bindGroup.entries[0]?.resourceKey,
    );
    expect(createdBuffers).toHaveLength(1);
    // usage = STORAGE | COPY_DST, size = elementCount * 16-byte vec4f stride.
    expect(createdBuffers[0]?.descriptor).toMatchObject({
      usage: 0x80 | 0x08,
      size: 64,
    });
    expect(reuse.storageBufferResourcesCreated).toBe(1);

    const second = prepareCustomWgslAppStorageBufferBindingResources({
      assets,
      device,
      cache,
      reuse,
      source,
      material: prepared,
    });

    expect(second.valid).toBe(true);
    expect(createdBuffers).toHaveLength(1);
    expect(reuse.storageBufferResourcesReused).toBe(1);
  });

  it("no longer reports unsupportedBindingKind for storage bindings backed by a ready buffer", async () => {
    const { assets, handle } = registryWithBufferAsset({
      elementType: "vec4f",
      elementCount: 4,
      data: new Float32Array(16),
    });
    const { source, prepared } = storageMaterial(handle);
    const cache = new Map<string, CustomWgslAppStorageBufferResource>();
    const reuse = newReuseCounters();
    const pipelines: unknown[] = [];
    const device = frameDevice(pipelines);
    const storage = prepareCustomWgslAppStorageBufferBindingResources({
      assets,
      device,
      cache,
      reuse,
      source,
      material: prepared,
    });
    const frame = await createCustomWgslAppFrameResources({
      device,
      mesh: createBoxMeshAsset({ label: "Grass Blade" }),
      material: prepared,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      bindingResources: storage.resources,
      bindingResourceDiagnostics: storage.diagnostics,
    });

    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(diagnosticCodes(frame.diagnostics)).not.toContain(
      "customWgslAppFrameResources.unsupportedBindingKind",
    );
  });

  it("diagnoses missing and not-ready buffer dependencies without unsupportedBindingKind", async () => {
    const assets = new AssetRegistry();
    const missingHandle = createBufferHandle("grass.missing");
    const { source, prepared } = storageMaterial(missingHandle);
    const cache = new Map<string, CustomWgslAppStorageBufferResource>();
    const reuse = newReuseCounters();
    const pipelines: unknown[] = [];
    const device = frameDevice(pipelines);
    const storage = prepareCustomWgslAppStorageBufferBindingResources({
      assets,
      device,
      cache,
      reuse,
      source,
      material: prepared,
    });

    expect(storage.valid).toBe(false);
    expect(storage.diagnostics).toMatchObject([
      {
        code: "customWgslAppFrameResources.storageBufferSourceNotReady",
        severity: "error",
        binding: 0,
        bufferKey: "buffer:grass.missing",
        status: "missing",
      },
    ]);

    const frame = await createCustomWgslAppFrameResources({
      device,
      mesh: createBoxMeshAsset({ label: "Grass Blade" }),
      material: prepared,
      viewUniforms: packedViews(1),
      worldTransforms: packedTransforms(1),
      colorFormat: "bgra8unorm",
      depthFormat: "depth24plus",
      bindingResources: storage.resources,
      bindingResourceDiagnostics: storage.diagnostics,
    });
    const codes = diagnosticCodes(frame.diagnostics);

    expect(frame.valid).toBe(false);
    expect(codes).toContain(
      "customWgslAppFrameResources.storageBufferSourceNotReady",
    );
    expect(codes).toContain(
      "customWgslAppFrameResources.storageBufferResourceMissing",
    );
    expect(codes).not.toContain(
      "customWgslAppFrameResources.unsupportedBindingKind",
    );
  });

  it("diagnoses storage bindings without a buffer handle", () => {
    const assets = new AssetRegistry();
    const { source, prepared } = storageMaterial(undefined);
    const storage = prepareCustomWgslAppStorageBufferBindingResources({
      assets,
      device: storageDevice([]),
      cache: new Map(),
      reuse: newReuseCounters(),
      source,
      material: prepared,
    });

    expect(storage.valid).toBe(false);
    expect(storage.diagnostics).toMatchObject([
      {
        code: "customWgslAppFrameResources.storageBufferMissingHandle",
        binding: 0,
      },
    ]);
  });

  it("diagnoses element-count vs data-length mismatches at realization", () => {
    const { assets, handle } = registryWithBufferAsset({
      elementType: "vec4f",
      elementCount: 4,
      data: new Float32Array(8),
    });
    const { source, prepared } = storageMaterial(handle);
    const storage = prepareCustomWgslAppStorageBufferBindingResources({
      assets,
      device: storageDevice([]),
      cache: new Map(),
      reuse: newReuseCounters(),
      source,
      material: prepared,
    });

    expect(storage.valid).toBe(false);
    expect(storage.diagnostics).toMatchObject([
      {
        code: "customWgslAppFrameResources.storageBufferSizeMismatch",
        binding: 0,
        bufferKey: "buffer:grass.bend",
      },
    ]);
  });

  it("streams runtime buffer packets through queue.writeBuffer with zero pipeline rebuilds", async () => {
    const { assets, handle } = registryWithBufferAsset({
      elementType: "vec4f",
      elementCount: 4,
      data: new Float32Array(16),
    });
    const { source, prepared } = storageMaterial(handle, {
      runtimeBufferKey: "grass.bend",
    });
    const cache = new Map<string, CustomWgslAppStorageBufferResource>();
    const reuse = newReuseCounters();
    const pipelines: unknown[] = [];
    const writes: {
      buffer: unknown;
      bufferOffset: number;
      byteLength: number;
    }[] = [];
    const device = frameDevice(pipelines, writes);
    const renderFrame = async (
      packet: RuntimeBufferPacket,
      pipelineResult?: Awaited<
        ReturnType<typeof createCustomWgslAppFrameResources>
      >["pipelineResult"],
    ) => {
      const storage = prepareCustomWgslAppStorageBufferBindingResources({
        assets,
        device,
        cache,
        reuse,
        source,
        material: prepared,
        runtimeBuffers: [packet],
      });

      expect(storage.diagnostics).toEqual([]);
      return createCustomWgslAppFrameResources({
        device,
        mesh: createBoxMeshAsset({ label: "Grass Blade" }),
        material: prepared,
        viewUniforms: packedViews(1),
        worldTransforms: packedTransforms(1),
        colorFormat: "bgra8unorm",
        depthFormat: "depth24plus",
        ...(pipelineResult === undefined || pipelineResult === null
          ? {}
          : { pipelineResult }),
        bindingResources: storage.resources,
        bindingResourceDiagnostics: storage.diagnostics,
      });
    };

    const first = await renderFrame(
      runtimeBufferPacket([0.1, 0, 0, 0, 0.2, 0, 0, 0], 0, 1),
    );

    expect(first.valid).toBe(true);
    expect(pipelines).toHaveLength(1);

    const initialUploadWrites = writes.length;
    const storageWrites = writes.filter(
      (write) => write.bufferOffset === 32 && write.byteLength === 32,
    );

    expect(storageWrites).toHaveLength(0);

    // Same packet again: no additional storage write (value key unchanged).
    const second = await renderFrame(
      runtimeBufferPacket([0.1, 0, 0, 0, 0.2, 0, 0, 0], 0, 1),
      first.pipelineResult,
    );

    expect(second.valid).toBe(true);
    expect(pipelines).toHaveLength(1);

    // Changed values at elementOffset 2 (vec4f stride 16 -> byte offset 32).
    const dynamicWritesBefore = reuse.dynamicBufferWrites;
    const third = await renderFrame(
      runtimeBufferPacket([0.5, 0, 0, 0, 0.75, 0, 0, 0], 2, 2),
      first.pipelineResult,
    );

    expect(third.valid).toBe(true);
    expect(pipelines).toHaveLength(1);
    expect(reuse.dynamicBufferWrites).toBe(dynamicWritesBefore + 1);
    expect(
      writes
        .slice(initialUploadWrites)
        .some((write) => write.bufferOffset === 32 && write.byteLength === 32),
    ).toBe(true);
  });

  it("diagnoses runtime buffer writes outside the buffer capacity", () => {
    const { assets, handle } = registryWithBufferAsset({
      elementType: "f32",
      elementCount: 4,
      data: new Float32Array(4),
    });
    const { source, prepared } = storageMaterial(handle, {
      runtimeBufferKey: "grass.bend",
    });
    const storage = prepareCustomWgslAppStorageBufferBindingResources({
      assets,
      device: storageDevice([]),
      cache: new Map(),
      reuse: newReuseCounters(),
      source,
      material: prepared,
      runtimeBuffers: [runtimeBufferPacket([1, 2, 3], 2, 1)],
    });

    expect(storage.valid).toBe(false);
    expect(storage.diagnostics).toMatchObject([
      {
        code: "customWgslAppFrameResources.runtimeBufferOutOfRange",
        runtimeBufferKey: "grass.bend",
      },
    ]);
  });
});

function registryWithBufferAsset(options: {
  readonly elementType: BufferElementType;
  readonly elementCount: number;
  readonly data?: BufferAssetData;
}): { assets: AssetRegistry; handle: BufferHandle } {
  const assets = new AssetRegistry();
  const handle = createBufferHandle("grass.bend");

  assets.register(handle, { label: "Grass Bend Params" });
  assets.markReady(
    handle,
    createBufferAsset({
      label: "Grass Bend Params",
      elementType: options.elementType,
      elementCount: options.elementCount,
      ...(options.data === undefined ? {} : { data: options.data }),
    }),
  );
  return { assets, handle };
}

function storageMaterial(
  buffer: BufferHandle | undefined,
  options: { readonly runtimeBufferKey?: string } = {},
): { source: CustomWgslMaterialAsset; prepared: PreparedCustomWgslMaterial } {
  const source = createCustomWgslMaterialAsset({
    familyKey: "test/grass",
    label: "Grass Blades",
    shader: {
      kind: "inline-wgsl",
      code: GRASS_WGSL,
      virtualPath: "grass.wgsl",
    },
    entryPoints: { vertex: "vs_main", fragment: "fs_main" },
    renderState: createDefaultRenderState({ cullMode: "none" }),
    bindings: [
      {
        name: "bendParams",
        binding: 0,
        kind: "storage-buffer",
        visibility: ["vertex"],
        ...(buffer === undefined ? {} : { buffer }),
        ...(options.runtimeBufferKey === undefined
          ? {}
          : { runtimeBufferKey: options.runtimeBufferKey }),
      },
    ],
  });
  const prepared = createPreparedCustomWgslMaterial({
    source,
    assetKey: "material:grass",
    shaderCode: GRASS_WGSL,
    shaderSourceKey: "inline:material:grass:grass.wgsl",
  });

  return { source, prepared };
}

function runtimeBufferPacket(
  values: readonly number[],
  elementOffset: number,
  version: number,
): RuntimeBufferPacket {
  return {
    bufferId: 41,
    entity: { index: 41, generation: 0 },
    key: "grass.bend",
    values,
    elementOffset,
    version,
  };
}

function newReuseCounters(): {
  storageBufferResourcesCreated: number;
  storageBufferResourcesReused: number;
  dynamicBufferWrites: number;
} {
  return {
    storageBufferResourcesCreated: 0,
    storageBufferResourcesReused: 0,
    dynamicBufferWrites: 0,
  };
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
  const data = new Float32Array(count * 16);

  for (let index = 0; index < count; index += 1) {
    data.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], index * 16);
  }

  return {
    data,
    offsets: Array.from({ length: count }, (_, index) => ({
      renderId: index + 7,
      sourceOffset: index,
      packedOffset: index,
    })),
    diagnostics: [],
  };
}

function diagnosticCodes(diagnostics: readonly unknown[]): readonly string[] {
  return diagnostics.map((diagnostic) =>
    typeof diagnostic === "object" &&
    diagnostic !== null &&
    "code" in diagnostic
      ? String((diagnostic as { code: unknown }).code)
      : "unknown",
  );
}

function storageDevice(
  createdBuffers: { descriptor: { usage: number; size: number } }[],
) {
  return {
    queue: {
      writeBuffer() {},
    },
    createBuffer(descriptor: { usage: number; size: number }) {
      createdBuffers.push({ descriptor });
      return { descriptor };
    },
  };
}

function frameDevice(
  pipelines: unknown[],
  writes: {
    buffer: unknown;
    bufferOffset: number;
    byteLength: number;
  }[] = [],
) {
  return {
    queue: {
      writeBuffer(
        buffer: unknown,
        bufferOffset: number,
        data: ArrayBufferLike | ArrayBufferView,
        _dataOffset?: number,
        size?: number,
      ) {
        writes.push({
          buffer,
          bufferOffset,
          byteLength: size ?? data.byteLength,
        });
      },
    },
    createBuffer(descriptor: unknown) {
      return { descriptor };
    },
    createShaderModule(descriptor: WebGpuShaderCreateDescriptor) {
      return {
        descriptor,
        compilationInfo: async () => ({ messages: [] }),
      };
    },
    createRenderPipeline(descriptor: WebGpuRenderPipelineCreateDescriptor) {
      pipelines.push(descriptor);
      return {
        descriptor,
        getBindGroupLayout(group: number) {
          return { group };
        },
      };
    },
    createBindGroup(descriptor: unknown) {
      return { descriptor };
    },
  };
}
