import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE,
  createViewUniformBufferDescriptorScratch,
  createViewUniformBufferDescriptor,
  writeViewUniformBufferDescriptor,
  type PackedSnapshotViewUniforms,
} from "@aperture-engine/webgpu/test-support";
import { PACKED_VIEW_UNIFORM_FLOAT_STRIDE } from "@aperture-engine/render";

describe("view uniform buffer descriptor planning", () => {
  it("maps one packed view to a uniform buffer descriptor", () => {
    const packed = packedViews(1);
    const result = createViewUniformBufferDescriptor(packed);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      descriptor: {
        label: "ViewUniforms/uniform",
        size: PACKED_VIEW_UNIFORM_FLOAT_STRIDE * 4,
        usage: DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE,
      },
      views: [{ viewId: 0, sourceOffset: 0, packedOffset: 0 }],
    });
    expect(result.plan?.source).toBe(packed.data);
    expect(result.plan?.descriptor.initialData).toBe(packed.data);
  });

  it("preserves multiple packed view offsets and custom labels", () => {
    const result = createViewUniformBufferDescriptor(packedViews(2), {
      label: "Frame/view-uniforms",
      usage: 321,
    });

    expect(result.valid).toBe(true);
    expect(result.plan?.descriptor).toMatchObject({
      label: "Frame/view-uniforms",
      size: 2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE * 4,
      usage: 321,
    });
    expect(result.plan?.views).toEqual([
      { viewId: 0, sourceOffset: 0, packedOffset: 0 },
      {
        viewId: 1,
        sourceOffset: PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
        packedOffset: PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
      },
    ]);
  });

  it("uses the logical float count from scratch-backed packed views", () => {
    const packed = {
      ...packedViews(2),
      floatCount: 2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
      data: new Float32Array(2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE + 16),
    };
    const result = createViewUniformBufferDescriptor(packed);

    expect(result.valid).toBe(true);
    expect(result.plan?.descriptor.size).toBe(
      2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE * 4,
    );
    expect(result.plan?.source.byteLength).toBe(
      2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE * 4,
    );
    expect(result.plan?.descriptor.initialData).toBe(result.plan?.source);
  });

  it("reuses caller-owned descriptor scratch across successful writes", () => {
    const scratch = createViewUniformBufferDescriptorScratch();
    const packed = {
      ...packedViews(2),
      floatCount: 2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
      data: new Float32Array(2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE + 16),
    };
    const first = writeViewUniformBufferDescriptor(packed, scratch);
    const firstPlan = first.plan;
    const firstDescriptor = first.plan?.descriptor;
    const firstSource = first.plan?.source;
    const firstDiagnostics = first.diagnostics;
    const second = writeViewUniformBufferDescriptor(packed, scratch);

    expect(second).toBe(first);
    expect(second.plan).toBe(firstPlan);
    expect(second.plan?.descriptor).toBe(firstDescriptor);
    expect(second.plan?.source).toBe(firstSource);
    expect(second.diagnostics).toBe(firstDiagnostics);
    expect(second.plan?.descriptor.size).toBe(
      2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE * 4,
    );
  });

  it("reports empty data, invalid usage flags, and carried pack diagnostics", () => {
    const result = createViewUniformBufferDescriptor(
      {
        data: new Float32Array(0),
        views: [],
        diagnostics: [
          {
            code: "viewUniform.emptySnapshot",
            message: "empty",
          },
        ],
      },
      { usage: 0 },
    );

    expect(result.plan).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewUniformBuffer.packDiagnostic",
      "viewUniformBuffer.invalidUsageFlags",
      "viewUniformBuffer.emptyData",
    ]);
    expect(result.diagnostics[0]?.sourceCode).toBe("viewUniform.emptySnapshot");
  });
});

function packedViews(count: number): PackedSnapshotViewUniforms {
  return {
    data: new Float32Array(count * PACKED_VIEW_UNIFORM_FLOAT_STRIDE),
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index,
      sourceOffset: index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
      packedOffset: index * PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
    })),
    diagnostics: [],
  };
}
