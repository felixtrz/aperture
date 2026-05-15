import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNLIT_MATERIAL_BUFFER_USAGE,
  createViewUniformBufferDescriptor,
  type PackedSnapshotViewUniforms,
} from "../../src/index.js";

describe("view uniform buffer descriptor planning", () => {
  it("maps one packed view to a uniform buffer descriptor", () => {
    const packed = packedViews(1);
    const result = createViewUniformBufferDescriptor(packed);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan).toMatchObject({
      descriptor: {
        label: "ViewUniforms/uniform",
        size: 16 * 4,
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
      size: 32 * 4,
      usage: 321,
    });
    expect(result.plan?.views).toEqual([
      { viewId: 0, sourceOffset: 0, packedOffset: 0 },
      { viewId: 1, sourceOffset: 16, packedOffset: 16 },
    ]);
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
    data: new Float32Array(count * 16),
    views: Array.from({ length: count }, (_, index) => ({
      viewId: index,
      sourceOffset: index * 16,
      packedOffset: index * 16,
    })),
    diagnostics: [],
  };
}
