import { describe, expect, it } from "vitest";
import type {
  BatchCompatibilityKey,
  RenderWorldDrawPackage,
} from "@aperture-engine/render";
import { inspectRenderPackages } from "@aperture-engine/render/test-support";

const BATCH: BatchCompatibilityKey = {
  pipelineKey: "unlit",
  materialKey: "mat:a",
  meshLayoutKey: "p3n3uv2",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("render package inspection report", () => {
  it("summarizes package resources and offsets", () => {
    const report = inspectRenderPackages([
      drawPackage(2, BATCH),
      drawPackage(1, { ...BATCH, materialKey: "mat:b" }),
    ]);

    expect(report).toMatchObject({
      packageCount: 2,
      renderIds: [1, 2],
      meshResourceKeys: ["mesh:1", "mesh:2"],
      materialResourceKeys: ["material:1", "material:2"],
      transformPackedOffsets: [16, 32],
      diagnostics: [],
    });
    expect(report.batchKeys).toEqual([
      "unlit|mat:a|p3n3uv2|triangle-list|single|rigid|static",
      "unlit|mat:b|p3n3uv2|triangle-list|single|rigid|static",
    ]);
  });

  it("diagnoses duplicate render ids", () => {
    expect(
      inspectRenderPackages([drawPackage(1, BATCH), drawPackage(1, BATCH)])
        .diagnostics,
    ).toMatchObject([{ code: "renderPackage.duplicateRenderId" }]);
  });

  it("diagnoses empty package input", () => {
    expect(inspectRenderPackages([])).toMatchObject({
      packageCount: 0,
      diagnostics: [{ code: "renderPackage.empty" }],
    });
  });
});

function drawPackage(
  renderId: number,
  batchKey: BatchCompatibilityKey,
): RenderWorldDrawPackage {
  return {
    renderId,
    batchKey,
    meshResourceKey: `mesh:${renderId}`,
    materialResourceKey: `material:${renderId}`,
    transformPackedOffset: renderId * 16,
  } as unknown as RenderWorldDrawPackage;
}
