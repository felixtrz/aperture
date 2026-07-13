import { describe, expect, it } from "vitest";

import {
  createComputeKernelAsset,
  isComputeKernelAsset,
  normalizeComputeKernelWorkgroups,
  packComputeKernelUniformBytes,
  validateComputeKernelAsset,
  type ComputeKernelAsset,
  type CustomWgslBindingDeclaration,
} from "@aperture-engine/render";
import {
  createBufferHandle,
  createSamplerHandle,
  createShaderHandle,
  createTextureHandle,
} from "@aperture-engine/simulation";

// C3 (three.js parity plan): the data-described compute kernel — WGSL + typed
// bindings shaped like a custom material, validated + std140-packed here in the
// render package (renderer-independent), realized by the WebGPU backend.

const HISTOGRAM_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> pixels: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> histogram: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;
struct Params { pixelCount: u32, binCount: u32 };
@compute @workgroup_size(1)
fn main() {}
`;

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

function uniformBinding(binding: number): CustomWgslBindingDeclaration {
  return {
    name: "params",
    binding,
    kind: "uniform-buffer",
    visibility: ["compute"],
    fields: { pixelCount: { type: "uint32" }, binCount: { type: "uint32" } },
    values: { pixelCount: 64, binCount: 16 },
  };
}

function histogramKernel(): ComputeKernelAsset {
  return createComputeKernelAsset({
    label: "Luminance Histogram",
    shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
    entryPoint: "main",
    bindings: [
      storageBinding(0, "pixels", "histogram.pixels"),
      storageBinding(1, "histogram", "histogram.bins"),
      uniformBinding(2),
    ],
  });
}

describe("compute kernel asset (C3)", () => {
  it("factory applies defaults and produces a data-only asset", () => {
    const kernel = createComputeKernelAsset({
      shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
    });

    expect(kernel).toEqual({
      kind: "compute-kernel",
      label: "Compute Kernel",
      shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
      entryPoint: "main",
      bindings: [],
    });
    expect(isComputeKernelAsset(kernel)).toBe(true);
    expect(isComputeKernelAsset({ kind: "buffer" })).toBe(false);
  });

  it("validates a well-formed kernel with storage + uniform bindings", () => {
    const report = validateComputeKernelAsset(histogramKernel());

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
  });

  it("accepts a shader-asset handle ref", () => {
    const kernel = createComputeKernelAsset({
      label: "Handle Kernel",
      shader: {
        kind: "shader-asset",
        handle: createShaderHandle("kernel.wgsl"),
      },
      bindings: [storageBinding(0, "out", "k.out")],
    });

    // Shader-asset entry-point presence is only checked for inline sources.
    expect(validateComputeKernelAsset(kernel).valid).toBe(true);
  });

  it("accepts texture + sampler bindings (same union as materials)", () => {
    const kernel = createComputeKernelAsset({
      label: "Sampled Kernel",
      shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
      bindings: [
        {
          name: "tex",
          binding: 0,
          kind: "texture",
          visibility: ["compute"],
          texture: createTextureHandle("k.tex"),
        },
        {
          name: "samp",
          binding: 1,
          kind: "sampler",
          visibility: ["compute"],
          sampler: createSamplerHandle("k.samp"),
        },
      ],
    });

    expect(validateComputeKernelAsset(kernel).valid).toBe(true);
  });

  it("rejects a missing inline entry point", () => {
    const kernel = createComputeKernelAsset({
      label: "Bad Entry",
      shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
      entryPoint: "notThere",
    });
    const report = validateComputeKernelAsset(kernel);

    expect(report.valid).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "computeKernel.missingEntryPoint",
    );
  });

  it("rejects an invalid entry-point name", () => {
    const report = validateComputeKernelAsset(
      createComputeKernelAsset({
        label: "Bad Entry",
        shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
        entryPoint: "3nope",
      }),
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "computeKernel.invalidEntryPoint",
    );
  });

  it("rejects duplicate binding numbers", () => {
    const kernel = createComputeKernelAsset({
      label: "Dup",
      shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
      bindings: [storageBinding(0, "a", "k.a"), storageBinding(0, "b", "k.b")],
    });
    const report = validateComputeKernelAsset(kernel);

    expect(report.valid).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "computeKernel.invalidBindingDeclaration",
    );
  });

  it("rejects a storage binding without a buffer handle", () => {
    const kernel = createComputeKernelAsset({
      label: "No Buffer",
      shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
      bindings: [
        {
          name: "out",
          binding: 0,
          kind: "storage-buffer",
          visibility: ["compute"],
        },
      ],
    });
    const report = validateComputeKernelAsset(kernel);

    expect(report.valid).toBe(false);
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "computeKernel.invalidBindingDeclaration",
    );
  });

  it("warns (not errors) on an empty label", () => {
    const report = validateComputeKernelAsset(
      createComputeKernelAsset({
        label: "",
        shader: { kind: "inline-wgsl", code: HISTOGRAM_WGSL },
      }),
    );

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "computeKernel.invalidLabel",
        severity: "warning",
      }),
    ]);
  });
});

describe("normalizeComputeKernelWorkgroups (C3)", () => {
  it("expands a bare number to [x, 1, 1]", () => {
    expect(normalizeComputeKernelWorkgroups(4)).toEqual([4, 1, 1]);
  });

  it("fills missing tuple dimensions with 1", () => {
    expect(normalizeComputeKernelWorkgroups([8])).toEqual([8, 1, 1]);
    expect(normalizeComputeKernelWorkgroups([8, 2])).toEqual([8, 2, 1]);
    expect(normalizeComputeKernelWorkgroups([8, 2, 3])).toEqual([8, 2, 3]);
  });
});

describe("packComputeKernelUniformBytes (C3 std140)", () => {
  it("packs two u32 params little-endian into a 16-byte buffer", () => {
    const bytes = packComputeKernelUniformBytes(
      { pixelCount: { type: "uint32" }, binCount: { type: "uint32" } },
      { pixelCount: 64, binCount: 16 },
    );

    expect(bytes.byteLength).toBe(16);
    expect(
      Array.from(new Uint32Array(bytes.buffer, bytes.byteOffset, 4)),
    ).toEqual([64, 16, 0, 0]);
  });

  it("aligns a vec2 after a scalar (std140 8-byte alignment)", () => {
    const bytes = packComputeKernelUniformBytes(
      { a: { type: "float32" }, b: { type: "vec2" } },
      { a: 1, b: [2, 3] },
    );

    // a @ 0, b aligned to 8 -> offset 8; total padded to 16.
    expect(bytes.byteLength).toBe(16);
    expect(
      Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, 4)),
    ).toEqual([1, 0, 2, 3]);
  });

  it("falls back to field defaults then zero", () => {
    const bytes = packComputeKernelUniformBytes({
      scale: { type: "float32", default: 2.5 },
      offset: { type: "float32" },
    });

    expect(
      Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, 2)),
    ).toEqual([2.5, 0]);
  });

  it("returns a 16-byte zero buffer for an empty field set", () => {
    const bytes = packComputeKernelUniformBytes({});
    expect(bytes.byteLength).toBe(16);
    expect(bytes.every((value) => value === 0)).toBe(true);
  });
});
