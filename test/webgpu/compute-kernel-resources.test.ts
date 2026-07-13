import { describe, expect, it } from "vitest";

import {
  createBufferAsset,
  createComputeKernelAsset,
  type BufferAssetUsage,
  type ComputeKernelAsset,
  type CustomWgslBindingDeclaration,
} from "@aperture-engine/render";
import { AssetRegistry, createBufferHandle } from "@aperture-engine/simulation";
import {
  buildUserPassNode,
  realizeComputeKernelDispatch,
  resolveAppBufferAssetResourceById,
  type ComputeKernelPipelineCacheEntry,
  type CustomWgslAppStorageBufferResource,
  type WebGpuAppComputeKernelPassDescriptor,
  type WebGpuAppPassResolvers,
} from "@aperture-engine/webgpu/test-support";

// C3 (three.js parity plan): the WebGPU realization of a data-described compute
// kernel — pipeline + bind group built from the kernel's WGSL + typed bindings,
// so the user never touches createComputePipeline / createBindGroup /
// createBuffer. Mirrors the custom-material pipeline realization for compute.

const HISTOGRAM_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> pixels: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> histogram: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
struct Params { pixelCount: u32, binCount: u32 };
@compute @workgroup_size(1)
fn main() {}
`;

const INPUT_ID = "histogram.pixels";
const OUTPUT_ID = "histogram.bins";
const PIXELS = 4;
const BINS = 16;

interface DeviceCalls {
  readonly shaderModules: { code: string; label?: string }[];
  readonly computePipelines: { descriptor: FakePipelineDescriptor }[];
  readonly bindGroups: {
    label?: string;
    layout: unknown;
    entries: { binding: number; resource: unknown }[];
  }[];
  readonly buffers: { label?: string; usage: number; size: number }[];
}

interface FakePipelineDescriptor {
  readonly label?: string;
  readonly layout: unknown;
  readonly compute: { readonly module: unknown; readonly entryPoint: string };
}

function fakeDevice(): { device: unknown; calls: DeviceCalls } {
  const calls: DeviceCalls = {
    shaderModules: [],
    computePipelines: [],
    bindGroups: [],
    buffers: [],
  };
  const device = {
    queue: { writeBuffer() {} },
    createBuffer(descriptor: { label?: string; usage: number; size: number }) {
      calls.buffers.push(descriptor);
      return { __buffer: descriptor.label ?? "", usage: descriptor.usage };
    },
    createShaderModule(descriptor: { code: string; label?: string }) {
      calls.shaderModules.push(descriptor);
      return { __module: descriptor.label ?? "" };
    },
    createComputePipeline(descriptor: FakePipelineDescriptor) {
      calls.computePipelines.push({ descriptor });
      return {
        descriptor,
        getBindGroupLayout(index: number) {
          return { __layout: index };
        },
      };
    },
    createBindGroup(descriptor: {
      label?: string;
      layout: unknown;
      entries: { binding: number; resource: unknown }[];
    }) {
      calls.bindGroups.push(descriptor);
      return {
        __bindGroup: descriptor.label ?? "",
        entries: descriptor.entries,
      };
    },
  };
  return { device, calls };
}

function histogramRegistry(): AssetRegistry {
  const assets = new AssetRegistry();
  registerBuffer(assets, INPUT_ID, "vec4f", PIXELS, "read-only-storage", {
    data: new Float32Array(PIXELS * 4),
  });
  registerBuffer(assets, OUTPUT_ID, "u32", BINS, "storage");
  return assets;
}

function registerBuffer(
  assets: AssetRegistry,
  id: string,
  elementType: "vec4f" | "u32",
  elementCount: number,
  usage: BufferAssetUsage,
  options: { data?: Float32Array | Uint32Array } = {},
): void {
  const handle = createBufferHandle(id);
  assets.register(handle, { label: id });
  assets.markReady(
    handle,
    createBufferAsset({
      label: id,
      elementType,
      elementCount,
      usage,
      ...(options.data === undefined ? {} : { data: options.data }),
    }),
  );
}

function storageBinding(
  binding: number,
  name: string,
  bufferId: string,
): CustomWgslBindingDeclaration {
  return {
    name,
    binding,
    kind: "storage-buffer",
    visibility: ["compute"],
    buffer: createBufferHandle(bufferId),
  };
}

function histogramKernel(): ComputeKernelAsset {
  return createComputeKernelAsset({
    label: "Luminance Histogram",
    shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
    entryPoint: "main",
    bindings: [
      storageBinding(0, "pixels", INPUT_ID),
      storageBinding(1, "histogram", OUTPUT_ID),
      {
        name: "params",
        binding: 2,
        kind: "uniform-buffer",
        visibility: ["compute"],
        fields: {
          pixelCount: { type: "uint32" },
          binCount: { type: "uint32" },
        },
        values: { pixelCount: PIXELS, binCount: BINS },
      },
    ],
  });
}

function newStorageReuse() {
  return {
    storageBufferResourcesCreated: 0,
    storageBufferResourcesReused: 0,
    dynamicBufferWrites: 0,
  };
}

function newTextureReuse() {
  return {
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
  };
}

function realize(input: {
  device: unknown;
  assets: AssetRegistry;
  storageBuffers?: Map<string, CustomWgslAppStorageBufferResource>;
  pipelineCache?: Map<string, ComputeKernelPipelineCacheEntry>;
  kernel?: ComputeKernelAsset;
  storageReuse?: ReturnType<typeof newStorageReuse>;
}) {
  return realizeComputeKernelDispatch({
    device: input.device,
    assets: input.assets,
    storageBuffers: input.storageBuffers ?? new Map(),
    storageReuse: input.storageReuse ?? newStorageReuse(),
    textureSamplers: { textures: new Map(), samplers: new Map() },
    textureSamplerReuse: newTextureReuse(),
    pipelineCache: input.pipelineCache ?? new Map(),
    kernel: input.kernel ?? histogramKernel(),
    workgroups: 1,
    passName: "histogram-kernel",
  });
}

describe("realizeComputeKernelDispatch (C3)", () => {
  it("builds a compute pipeline + bind group from the data description", () => {
    const { device, calls } = fakeDevice();
    const result = realize({ device, assets: histogramRegistry() });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.realization).not.toBeNull();

    // Pipeline built with layout:auto from the kernel's WGSL + entry point.
    expect(calls.shaderModules[0]?.code).toBe(HISTOGRAM_WGSL);
    expect(calls.computePipelines).toHaveLength(1);
    expect(calls.computePipelines[0]?.descriptor.layout).toBe("auto");
    expect(calls.computePipelines[0]?.descriptor.compute.entryPoint).toBe(
      "main",
    );

    // Bind group built from group(0) auto layout with one entry per binding.
    expect(calls.bindGroups).toHaveLength(1);
    expect(calls.bindGroups[0]?.layout).toEqual({ __layout: 0 });
    const entries = calls.bindGroups[0]?.entries ?? [];
    expect(entries.map((entry) => entry.binding)).toEqual([0, 1, 2]);
    for (const entry of entries) {
      expect(entry.resource).toHaveProperty("buffer");
    }

    // The uniform buffer was created UNIFORM|COPY_DST, std140-sized (16 bytes).
    const uniformBuffer = calls.buffers.find(
      (buffer) => buffer.usage === (0x40 | 0x08),
    );
    expect(uniformBuffer?.size).toBe(16);

    // The WRITABLE output buffer is auto-declared for ordering; the read-only
    // input is not.
    expect(result.realization?.writableBufferIds).toEqual([OUTPUT_ID]);
    expect(result.realization?.workgroups).toEqual([1, 1, 1]);
  });

  it("caches the compute pipeline across dispatches (built once)", () => {
    const { device, calls } = fakeDevice();
    const assets = histogramRegistry();
    const storageBuffers = new Map<
      string,
      CustomWgslAppStorageBufferResource
    >();
    const pipelineCache = new Map<string, ComputeKernelPipelineCacheEntry>();

    const first = realize({ device, assets, storageBuffers, pipelineCache });
    const second = realize({ device, assets, storageBuffers, pipelineCache });

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    // One shader module + one pipeline for both dispatches.
    expect(calls.computePipelines).toHaveLength(1);
    expect(calls.shaderModules).toHaveLength(1);
    // Both dispatches bind the identical realized pipeline object.
    expect(first.realization?.pipeline).toBe(second.realization?.pipeline);
  });

  it("binds the SAME buffers a hand-built (raw) bind group would (kernel == raw)", () => {
    const { device } = fakeDevice();
    const assets = histogramRegistry();
    const storageBuffers = new Map<
      string,
      CustomWgslAppStorageBufferResource
    >();
    const reuse = newStorageReuse();

    const kernelResult = realize({
      device,
      assets,
      storageBuffers,
      storageReuse: reuse,
    });
    const kernelEntries =
      (
        kernelResult.realization?.bindGroup as {
          entries?: { binding: number; resource: unknown }[];
        }
      )?.entries ?? [];

    // The raw path resolves the SAME buffers through the shared cache (C1). Both
    // storage bindings resolve to the identical GPUBuffer object the kernel bound
    // — proving the data-described bind group matches the hand-built one.
    const rawInput = resolveAppBufferAssetResourceById({
      assets,
      device,
      cache: storageBuffers,
      reuse,
      bufferId: INPUT_ID,
    })?.buffer;
    const rawOutput = resolveAppBufferAssetResourceById({
      assets,
      device,
      cache: storageBuffers,
      reuse,
      bufferId: OUTPUT_ID,
    })?.buffer;

    expect(
      (kernelEntries[0]?.resource as { buffer?: unknown } | undefined)?.buffer,
    ).toBe(rawInput);
    expect(
      (kernelEntries[1]?.resource as { buffer?: unknown } | undefined)?.buffer,
    ).toBe(rawOutput);
  });

  it("diagnoses a device without compute-pipeline support", () => {
    const result = realize({
      device: { queue: { writeBuffer() {} }, createBuffer() {} },
      assets: histogramRegistry(),
    });

    expect(result.valid).toBe(false);
    expect(result.realization).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "computeKernel.deviceUnavailable",
    ]);
  });

  it("diagnoses a not-ready storage buffer binding", () => {
    const { device } = fakeDevice();
    // Only the input is registered; the output storage buffer is missing.
    const assets = new AssetRegistry();
    registerBuffer(assets, INPUT_ID, "vec4f", PIXELS, "read-only-storage", {
      data: new Float32Array(PIXELS * 4),
    });

    const result = realize({ device, assets });

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.code).toBe(
      "computeKernel.bindingResourceUnavailable",
    );
    expect(result.diagnostics[0]?.binding).toBe(1);
  });

  it("diagnoses an invalid kernel (missing entry point) before touching the GPU", () => {
    const { device, calls } = fakeDevice();
    const result = realize({
      device,
      assets: histogramRegistry(),
      kernel: createComputeKernelAsset({
        label: "Bad",
        shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
        entryPoint: "missing",
        bindings: [storageBinding(0, "out", OUTPUT_ID)],
      }),
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.code).toBe("computeKernel.invalidAsset");
    expect(calls.computePipelines).toHaveLength(0);
  });
});

describe("buildUserPassNode with a compute-kernel descriptor (C3)", () => {
  function kernelResolvers(
    realization: ReturnType<typeof realize>["realization"],
  ): WebGpuAppPassResolvers {
    return {
      view: (handle) => ({ view: handle }),
      buffer: (handle) => ({ buffer: handle }),
      createBindGroup: (entries) => ({ bindGroup: entries }),
      realizeComputeKernel: () => realization,
    };
  }

  it("records setComputePipeline / setBindGroup(0) / dispatch and auto-declares writable writes", () => {
    const { device } = fakeDevice();
    const realized = realize({
      device,
      assets: histogramRegistry(),
    }).realization;
    const descriptor: WebGpuAppComputeKernelPassDescriptor = {
      name: "histogram-kernel",
      kernel: histogramKernel(),
      workgroups: 1,
    };

    const node = buildUserPassNode(descriptor, kernelResolvers(realized));

    expect(node.kind).toBe("compute");
    if (node.kind !== "compute") {
      return;
    }
    expect(node.commands.map((command) => command.kind)).toEqual([
      "setComputePipeline",
      "setComputeBindGroup",
      "dispatchWorkgroups",
    ]);
    const dispatch = node.commands[2];
    expect(
      dispatch?.kind === "dispatchWorkgroups" && dispatch.workgroupCountX,
    ).toBe(1);
    // The kernel's writable storage output is auto-declared as a pass write.
    expect(node.writes.map((write) => write.handle)).toEqual([OUTPUT_ID]);
  });

  it("records no commands when the realizer degrades (null realization)", () => {
    const descriptor: WebGpuAppComputeKernelPassDescriptor = {
      name: "histogram-kernel",
      kernel: histogramKernel(),
      workgroups: 1,
      writes: ["explicit.buffer"],
    };

    const node = buildUserPassNode(descriptor, kernelResolvers(null));

    expect(node.kind).toBe("compute");
    if (node.kind !== "compute") {
      return;
    }
    expect(node.commands).toEqual([]);
    // Declared writes are preserved even when the dispatch degrades.
    expect(node.writes.map((write) => write.handle)).toEqual([
      "explicit.buffer",
    ]);
  });
});
