import { describe, expect, it } from "vitest";

import {
  createPreparedResourceLifetimeAlignmentSummary,
  preparedResourceLifetimeAlignmentSummaryToJsonValue,
  type PreparedResourceLifetimeFacadeSummary,
  type RenderResourceSummaryReport,
} from "@aperture-engine/webgpu";

describe("prepared resource lifetime alignment summary", () => {
  it("compares facade prepared counts with backend resource summary counts", () => {
    const summary = createPreparedResourceLifetimeAlignmentSummary({
      facade: facade({ meshes: 2, materials: 3, ready: 1, blocked: 1 }),
      backend: backend({
        meshResources: 1,
        materialBuffers: 2,
        missingResources: 1,
        staleResources: 2,
        pendingDestroyResources: 1,
      }),
    });

    expect(summary).toEqual({
      facade: {
        preparedMeshes: 2,
        preparedMaterials: 3,
        readyDraws: 1,
        blockedDraws: 1,
      },
      backend: {
        meshResources: 1,
        materialBuffers: 2,
        staleResources: 2,
        missingResources: 1,
        pendingDestroyResources: 1,
      },
      diagnostics: [
        expect.objectContaining({
          code: "preparedResourceLifetime.backendMissingResources",
          backendMissingResources: 1,
        }),
        expect.objectContaining({
          code: "preparedResourceLifetime.backendStaleResources",
          backendStaleResources: 2,
        }),
        expect.objectContaining({
          code: "preparedResourceLifetime.backendPendingDestroyResources",
          backendPendingDestroyResources: 1,
        }),
      ],
    });
    expect(
      JSON.stringify(
        preparedResourceLifetimeAlignmentSummaryToJsonValue(summary),
      ),
    ).not.toContain("GPU");
  });

  it("keeps clean backend inspection quiet", () => {
    const summary = createPreparedResourceLifetimeAlignmentSummary({
      facade: facade({ meshes: 1, materials: 1 }),
      backend: backend({ meshResources: 1, materialBuffers: 1 }),
    });

    expect(summary.diagnostics).toEqual([]);
    expect(summary.backend).toMatchObject({
      missingResources: 0,
      staleResources: 0,
      pendingDestroyResources: 0,
    });
  });
});

function facade(
  input: {
    readonly meshes?: number;
    readonly materials?: number;
    readonly ready?: number;
    readonly blocked?: number;
  } = {},
): PreparedResourceLifetimeFacadeSummary {
  return {
    preparedMeshes: { totalEntries: input.meshes ?? 0 },
    preparedMaterials: {
      totalEntries: input.materials ?? 0,
    },
    drawReadiness: {
      ready: input.ready ?? 0,
      blocked: input.blocked ?? 0,
    },
  };
}

function backend(
  counts: Partial<RenderResourceSummaryReport["counts"]> = {},
): RenderResourceSummaryReport {
  return {
    counts: {
      meshResources: 0,
      meshVertexBuffers: 0,
      meshIndexBuffers: 0,
      materialBuffers: 0,
      textures: 0,
      samplers: 0,
      lightBuffers: 0,
      lightGpuBuffers: 0,
      lightBindGroups: 0,
      environmentMaps: 0,
      viewUniformBuffers: 0,
      shaderModules: 0,
      pipelineHits: 0,
      pipelineMisses: 0,
      inspectedResources: 0,
      staleResources: 0,
      missingResources: 0,
      pendingDestroyResources: 0,
      warnings: 0,
      errors: 0,
      ...counts,
    },
    diagnostics: [],
  };
}
