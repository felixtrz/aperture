import { describe, expect, it } from "vitest";
import {
  createDrawPackageBatchingReport,
  type BatchCompatibilityKey,
  type RenderWorldDrawPackage,
} from "@aperture-engine/render";

const BASE_BATCH: BatchCompatibilityKey = {
  pipelineKey: "unlit",
  materialKey: "mat:a",
  meshLayoutKey: "p3n3uv2",
  topology: "triangle-list",
  instanced: false,
  skinned: false,
  morphed: false,
};

describe("draw package batching report", () => {
  it("groups one batch and preserves resource keys", () => {
    const report = createDrawPackageBatchingReport([
      drawPackage(2, BASE_BATCH),
      drawPackage(1, BASE_BATCH),
    ]);

    expect(report.drawCount).toBe(2);
    expect(report.batchCount).toBe(1);
    expect(report.groups[0]).toMatchObject({
      drawCount: 2,
      renderIds: [1, 2],
      meshResourceKeys: ["mesh:1", "mesh:2"],
      materialResourceKeys: ["material:1", "material:2"],
    });
  });

  it("separates multiple batches in stable order", () => {
    const report = createDrawPackageBatchingReport([
      drawPackage(1, { ...BASE_BATCH, materialKey: "mat:b" }),
      drawPackage(2, { ...BASE_BATCH, materialKey: "mat:a" }),
    ]);

    expect(report.groups.map((group) => group.batchKey.materialKey)).toEqual([
      "mat:a",
      "mat:b",
    ]);
  });

  it("includes topology and feature flags in batch grouping", () => {
    const report = createDrawPackageBatchingReport([
      drawPackage(1, BASE_BATCH),
      drawPackage(2, {
        ...BASE_BATCH,
        instanced: true,
      }),
      drawPackage(3, {
        ...BASE_BATCH,
        topology: "line-list",
      }),
    ]);

    expect(report.batchCount).toBe(3);
  });

  it("reports empty package input", () => {
    expect(createDrawPackageBatchingReport([])).toMatchObject({
      drawCount: 0,
      batchCount: 0,
      groups: [],
      diagnostics: [{ code: "drawBatching.emptyPackages" }],
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
  } as unknown as RenderWorldDrawPackage;
}
