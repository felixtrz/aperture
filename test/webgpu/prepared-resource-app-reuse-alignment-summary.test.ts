import { describe, expect, it } from "vitest";

import {
  createPreparedResourceAppReuseAlignmentSummary,
  preparedResourceAppReuseAlignmentSummaryToJsonValue,
  type PreparedResourceAppReuseFacadeSummary,
  type PreparedResourceAppReuseReportSummary,
} from "@aperture-engine/webgpu/test-support";

describe("prepared resource app reuse alignment summary", () => {
  it("compares render prepared facade counts with app reuse facade counts", () => {
    const summary = createPreparedResourceAppReuseAlignmentSummary({
      facade: facade({ meshes: 2, materials: 3, ready: 2, blocked: 1 }),
      reuse: reuse({
        preparedMeshFacade: { totalEntries: 1 },
        preparedMaterialFacade: { totalEntries: 2 },
        preparedMeshBuffersCreated: 1,
        preparedMeshBuffersReused: 2,
        preparedMaterialBuffersCreated: 3,
        preparedMaterialBuffersReused: 4,
        preparedMaterialBindGroupsCreated: 5,
        preparedMaterialBindGroupsReused: 6,
        textureResourcesCreated: 7,
        textureResourcesReused: 8,
        samplerResourcesCreated: 9,
        samplerResourcesReused: 10,
        dynamicBufferWrites: 11,
      }),
    });

    expect(summary).toEqual({
      facade: {
        preparedMeshes: 2,
        preparedMaterials: 3,
        readyDraws: 2,
        blockedDraws: 1,
      },
      appFacade: {
        preparedMeshes: 1,
        preparedMaterials: 2,
      },
      reuse: {
        preparedMeshBuffersCreated: 1,
        preparedMeshBuffersReused: 2,
        preparedMaterialBuffersCreated: 3,
        preparedMaterialBuffersReused: 4,
        preparedMaterialBindGroupsCreated: 5,
        preparedMaterialBindGroupsReused: 6,
        textureResourcesCreated: 7,
        textureResourcesReused: 8,
        samplerResourcesCreated: 9,
        samplerResourcesReused: 10,
        dynamicBufferWrites: 11,
      },
      diagnostics: [
        expect.objectContaining({
          code: "preparedResourceAppReuse.meshFacadeMismatch",
          renderPreparedCount: 2,
          appPreparedCount: 1,
        }),
        expect.objectContaining({
          code: "preparedResourceAppReuse.materialFacadeMismatch",
          renderPreparedCount: 3,
          appPreparedCount: 2,
        }),
      ],
    });
    expect(
      JSON.stringify(
        preparedResourceAppReuseAlignmentSummaryToJsonValue(summary),
      ),
    ).not.toContain("GPU");
    expect(JSON.stringify(summary)).not.toContain("Map");
    expect(JSON.stringify(summary)).not.toContain("resourceKey");
  });

  it("keeps aligned prepared facade counts quiet", () => {
    const summary = createPreparedResourceAppReuseAlignmentSummary({
      facade: facade({ meshes: 1, materials: 1, ready: 1 }),
      reuse: reuse({
        preparedMeshFacade: { totalEntries: 1 },
        preparedMaterialFacade: { totalEntries: 1 },
      }),
    });

    expect(summary.diagnostics).toEqual([]);
    expect(summary).toMatchObject({
      facade: {
        preparedMeshes: 1,
        preparedMaterials: 1,
        readyDraws: 1,
        blockedDraws: 0,
      },
      appFacade: {
        preparedMeshes: 1,
        preparedMaterials: 1,
      },
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
): PreparedResourceAppReuseFacadeSummary {
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

function reuse(
  input: Partial<PreparedResourceAppReuseReportSummary> = {},
): PreparedResourceAppReuseReportSummary {
  return {
    preparedMeshFacade: { totalEntries: 0 },
    preparedMaterialFacade: { totalEntries: 0 },
    preparedMeshBuffersCreated: 0,
    preparedMeshBuffersReused: 0,
    preparedMaterialBuffersCreated: 0,
    preparedMaterialBuffersReused: 0,
    preparedMaterialBindGroupsCreated: 0,
    preparedMaterialBindGroupsReused: 0,
    textureResourcesCreated: 0,
    textureResourcesReused: 0,
    samplerResourcesCreated: 0,
    samplerResourcesReused: 0,
    dynamicBufferWrites: 0,
    ...input,
  };
}
