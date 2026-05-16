import { describe, expect, it } from "vitest";

import {
  mergeRenderResourceSummaryReports,
  type RenderResourceSummaryReport,
} from "@aperture-engine/webgpu";

describe("renderer resource summary merge", () => {
  it("merges empty inputs", () => {
    expect(mergeRenderResourceSummaryReports([])).toEqual(summary());
  });

  it("sums all-ready resource counts", () => {
    expect(
      mergeRenderResourceSummaryReports([
        summary({ meshResources: 1, pipelineHits: 1 }),
        summary({
          materialBuffers: 2,
          textures: 1,
          samplers: 1,
          lightBuffers: 1,
          lightGpuBuffers: 1,
          lightBindGroups: 1,
          environmentMaps: 2,
          pipelineMisses: 1,
        }),
      ]).counts,
    ).toMatchObject({
      meshResources: 1,
      materialBuffers: 2,
      textures: 1,
      samplers: 1,
      lightBuffers: 1,
      lightGpuBuffers: 1,
      lightBindGroups: 1,
      environmentMaps: 2,
      pipelineHits: 1,
      pipelineMisses: 1,
      warnings: 0,
      errors: 0,
    });
  });

  it("recomputes warning and error totals from merged diagnostics", () => {
    const merged = mergeRenderResourceSummaryReports([
      summary({ warnings: 99, errors: 99 }, [
        { code: "warn", message: "warn", severity: "warning" },
      ]),
      summary({ warnings: 99, errors: 99 }, [
        { code: "error", message: "error", severity: "error" },
      ]),
    ]);

    expect(merged.counts.warnings).toBe(1);
    expect(merged.counts.errors).toBe(1);
    expect(merged.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "warn",
      "error",
    ]);
  });

  it("preserves texture upload validation diagnostics while merging", () => {
    const merged = mergeRenderResourceSummaryReports([
      summary({ textures: 1, warnings: 1 }, [
        {
          code: "textureResource.invalidBytesPerRow",
          message: "invalid row",
          severity: "warning",
        },
      ]),
      summary({ textures: 0, warnings: 1 }, [
        {
          code: "textureResource.uploadDataTooSmall",
          message: "short data",
          severity: "warning",
        },
      ]),
    ]);

    expect(merged.counts).toMatchObject({
      textures: 1,
      warnings: 2,
      errors: 0,
    });
    expect(merged.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "textureResource.invalidBytesPerRow",
      "textureResource.uploadDataTooSmall",
    ]);
  });

  it("preserves diagnostic resource keys while merging", () => {
    const merged = mergeRenderResourceSummaryReports([
      summary({ warnings: 1 }, [
        {
          code: "textureResource.invalidBytesPerRow",
          message: "invalid texture row",
          resourceKey: "texture:albedo",
          severity: "warning",
        },
      ]),
      summary({ warnings: 1 }, [
        {
          code: "samplerResource.samplerCreationFailed",
          message: "sampler failed",
          resourceKey: "sampler:linear",
          severity: "warning",
        },
      ]),
    ]);

    expect(merged.counts).toMatchObject({
      warnings: 2,
      errors: 0,
    });
    expect(merged.diagnostics).toEqual([
      {
        code: "textureResource.invalidBytesPerRow",
        message: "invalid texture row",
        resourceKey: "texture:albedo",
        severity: "warning",
      },
      {
        code: "samplerResource.samplerCreationFailed",
        message: "sampler failed",
        resourceKey: "sampler:linear",
        severity: "warning",
      },
    ]);
  });
});

function summary(
  counts: Partial<RenderResourceSummaryReport["counts"]> = {},
  diagnostics: RenderResourceSummaryReport["diagnostics"] = [],
): RenderResourceSummaryReport {
  return {
    counts: {
      meshResources: counts.meshResources ?? 0,
      meshVertexBuffers: counts.meshVertexBuffers ?? 0,
      meshIndexBuffers: counts.meshIndexBuffers ?? 0,
      materialBuffers: counts.materialBuffers ?? 0,
      textures: counts.textures ?? 0,
      samplers: counts.samplers ?? 0,
      lightBuffers: counts.lightBuffers ?? 0,
      lightGpuBuffers: counts.lightGpuBuffers ?? 0,
      lightBindGroups: counts.lightBindGroups ?? 0,
      environmentMaps: counts.environmentMaps ?? 0,
      viewUniformBuffers: counts.viewUniformBuffers ?? 0,
      shaderModules: counts.shaderModules ?? 0,
      pipelineHits: counts.pipelineHits ?? 0,
      pipelineMisses: counts.pipelineMisses ?? 0,
      warnings: counts.warnings ?? 0,
      errors: counts.errors ?? 0,
    },
    diagnostics,
  };
}
