import { describe, expect, it } from "vitest";

import {
  bufferAssetByteLength,
  bufferElementByteStride,
  bufferElementComponentCount,
  createBufferAsset,
  validateBufferAsset,
  type BufferAsset,
} from "@aperture-engine/render";

describe("buffer source assets", () => {
  it("creates read-only storage buffer assets with defaults", () => {
    const asset = createBufferAsset({
      elementType: "vec4f",
      elementCount: 8,
    });

    expect(asset).toEqual({
      kind: "buffer",
      label: "Buffer",
      elementType: "vec4f",
      elementCount: 8,
      usage: "read-only-storage",
    });
    expect(validateBufferAsset(asset).valid).toBe(true);
  });

  it("accepts matching typed-array data and keeps it on the asset", () => {
    const data = new Float32Array(12);
    const asset = createBufferAsset({
      label: "Bend Params",
      elementType: "vec4f",
      elementCount: 3,
      data,
    });
    const report = validateBufferAsset(asset);

    expect(asset.data).toBe(data);
    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
  });

  it("uses std430-style array strides for the GPU byte layout", () => {
    expect(bufferElementComponentCount("f32")).toBe(1);
    expect(bufferElementComponentCount("vec2f")).toBe(2);
    expect(bufferElementComponentCount("vec4f")).toBe(4);
    expect(bufferElementByteStride("f32")).toBe(4);
    expect(bufferElementByteStride("u32")).toBe(4);
    expect(bufferElementByteStride("i32")).toBe(4);
    expect(bufferElementByteStride("vec2f")).toBe(8);
    // vec3f documents WHY it is rejected: its storage-array stride is 16.
    expect(bufferElementByteStride("vec3f")).toBe(16);
    expect(bufferElementByteStride("vec4f")).toBe(16);
    expect(
      bufferAssetByteLength({ elementType: "vec4f", elementCount: 64 }),
    ).toBe(1024);
    expect(
      bufferAssetByteLength({ elementType: "f32", elementCount: 64 }),
    ).toBe(256);
  });

  it("rejects vec3f element types with a stride-explaining diagnostic", () => {
    const report = validateBufferAsset(
      createBufferAsset({ elementType: "vec3f", elementCount: 4 }),
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "bufferAsset.vec3fUnsupported",
        severity: "error",
        field: "elementType",
      },
    ]);
    expect(report.diagnostics[0]?.message).toContain("16-byte");
  });

  it("rejects non-positive and non-integer element counts", () => {
    for (const elementCount of [0, -3, 1.5, Number.NaN]) {
      const report = validateBufferAsset(
        createBufferAsset({ elementType: "f32", elementCount }),
      );

      expect(report.valid).toBe(false);
      expect(
        report.diagnostics.some(
          (diagnostic) => diagnostic.code === "bufferAsset.invalidElementCount",
        ),
      ).toBe(true);
    }
  });

  it("diagnoses element count vs data length mismatches", () => {
    const report = validateBufferAsset(
      createBufferAsset({
        elementType: "vec2f",
        elementCount: 4,
        data: new Float32Array(6),
      }),
    );

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "bufferAsset.dataLengthMismatch",
        severity: "error",
        field: "data",
      },
    ]);
  });

  it("diagnoses typed-array constructor mismatches per element type", () => {
    const asUintData = validateBufferAsset(
      createBufferAsset({
        elementType: "u32",
        elementCount: 2,
        data: new Float32Array(2) as unknown as Uint32Array,
      }),
    );
    const asFloatData = validateBufferAsset(
      createBufferAsset({
        elementType: "f32",
        elementCount: 2,
        data: new Int32Array(2) as unknown as Float32Array,
      }),
    );

    expect(asUintData.diagnostics).toMatchObject([
      { code: "bufferAsset.dataTypeMismatch" },
    ]);
    expect(asFloatData.diagnostics).toMatchObject([
      { code: "bufferAsset.dataTypeMismatch" },
    ]);
  });

  it("rejects live GPU objects in the data slot like other material sources", () => {
    class GPUBuffer {
      destroy(): void {}
      mapAsync(): Promise<void> {
        return Promise.resolve();
      }
    }

    const asset: BufferAsset = {
      kind: "buffer",
      label: "Live Object",
      elementType: "f32",
      elementCount: 4,
      usage: "read-only-storage",
      data: new GPUBuffer() as unknown as Float32Array,
    };
    const report = validateBufferAsset(asset);

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      { code: "bufferAsset.liveRendererObject", severity: "error" },
    ]);
  });

  it("rejects usages other than read-only-storage", () => {
    const report = validateBufferAsset({
      kind: "buffer",
      label: "Wrong Usage",
      elementType: "f32",
      elementCount: 4,
      usage: "storage" as unknown as BufferAsset["usage"],
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      { code: "bufferAsset.invalidUsage" },
    ]);
  });

  it("flags empty labels as warnings without failing validation alone", () => {
    const report = validateBufferAsset({
      kind: "buffer",
      label: "  ",
      elementType: "f32",
      elementCount: 1,
      usage: "read-only-storage",
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toMatchObject([
      { code: "bufferAsset.invalidLabel", severity: "warning" },
    ]);
  });
});
