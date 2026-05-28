import { describe, expect, it } from "vitest";
import type { MaterialQueueItem } from "@aperture-engine/render";
import {
  createQueuedMaterialFrameResourceRouteShell,
  createQueuedMaterialFrameResourceRouteShellSummary,
  createQueuedMaterialPrepareRouteResult,
  queuedMaterialFrameResourceRouteShellSummaryToJsonValue,
} from "@aperture-engine/webgpu/test-support";

describe("queued material frame resource route shell", () => {
  it("keeps facade queue keys separate from source-version backend preparation keys", () => {
    const prepareRoute = createQueuedMaterialPrepareRouteResult(
      {
        queueItem: queueItem("standard"),
        material: { kind: "standard" } as never,
        sourceVersion: 7,
        frame: 21,
      },
      { status: "prepared" },
    );

    const shell = createQueuedMaterialFrameResourceRouteShell({
      prepareRoute,
      backendMeshKey: "source-mesh:cube@7",
      backendMaterialKey: "source-material:standard@7",
      frameResources: frameResources(true, {
        resources: { rawGpuHandle: "GPUBuffer" },
      }),
    });

    expect(shell).toEqual({
      valid: true,
      status: "prepared",
      family: "standard",
      facadeMeshResourceKey: "facade-mesh:mesh:cube",
      facadeMaterialResourceKey: "facade-material:material:standard",
      backendMeshKey: "source-mesh:cube@7",
      backendMaterialKey: "source-material:standard@7",
      pipelineKey: "standard|opaque|back|less|none",
      sourceVersion: 7,
      frame: 21,
      diagnostics: [],
    });
    expect(JSON.stringify(shell)).not.toContain("GPUBuffer");
    expect(JSON.parse(JSON.stringify(shell))).toEqual(shell);
  });

  it("reports failed frame resource preparation without copying resource handles", () => {
    const shell = createQueuedMaterialFrameResourceRouteShell({
      prepareRoute: createQueuedMaterialPrepareRouteResult({
        queueItem: queueItem("matcap"),
        material: { kind: "matcap" } as never,
        sourceVersion: 3,
        frame: 8,
      }),
      backendMeshKey: "source-mesh:capsule@3",
      backendMaterialKey: "source-material:matcap@3",
      frameResources: frameResources(false, {
        resources: { rawGpuHandle: "GPUBindGroup" },
        diagnostics: [
          {
            code: "test.missingBindGroupLayout",
            message: "Missing bind group layout.",
          },
        ],
      }),
    });

    expect(shell).toMatchObject({
      valid: false,
      status: "failed",
      family: "matcap",
      backendMeshKey: "source-mesh:capsule@3",
      backendMaterialKey: "source-material:matcap@3",
      diagnostics: [
        {
          code: "test.missingBindGroupLayout",
          message: "Missing bind group layout.",
        },
      ],
    });
    expect(JSON.stringify(shell)).not.toContain("GPUBindGroup");
  });

  it("summarizes route shells without facade/backend keys or raw diagnostics", () => {
    const shell = createQueuedMaterialFrameResourceRouteShell({
      prepareRoute: createQueuedMaterialPrepareRouteResult({
        queueItem: queueItem("standard"),
        material: { kind: "standard" } as never,
        sourceVersion: 5,
        frame: 34,
      }),
      backendMeshKey: "source-mesh:cube@5",
      backendMaterialKey: "source-material:standard@5",
      frameResources: frameResources(false, {
        resources: { rawGpuHandle: "GPUBuffer" },
        diagnostics: [
          {
            code: "z.diagnostic",
            message: "last",
            resourceKey: "source-material:standard@5",
          },
          {
            code: "a.diagnostic",
            message: "first",
            resourceKey: "source-mesh:cube@5",
          },
          {
            code: "z.diagnostic",
            message: "again",
            resourceKey: "source-material:standard@5",
          },
        ],
      }),
    });
    const summary = createQueuedMaterialFrameResourceRouteShellSummary(shell);

    expect(summary).toEqual({
      valid: false,
      status: "failed",
      family: "standard",
      hasFacadeMeshResourceKey: true,
      hasFacadeMaterialResourceKey: true,
      hasBackendMeshKey: true,
      hasBackendMaterialKey: true,
      pipelineKey: "standard|opaque|back|less|none",
      sourceVersion: 5,
      frame: 34,
      diagnostics: {
        total: 3,
        byCode: {
          "a.diagnostic": 1,
          "z.diagnostic": 2,
        },
      },
    });
    expect(
      queuedMaterialFrameResourceRouteShellSummaryToJsonValue(summary),
    ).toEqual(summary);
    expect(JSON.stringify(summary)).not.toContain("source-material");
    expect(JSON.stringify(summary)).not.toContain("source-mesh");
    expect(JSON.stringify(summary)).not.toContain("facade-material");
    expect(JSON.stringify(summary)).not.toContain("facade-mesh");
    expect(JSON.stringify(summary)).not.toContain("GPUBuffer");
  });

  it("summarizes non-built-in prepared-resource route metadata without public material APIs", () => {
    const shell = createQueuedMaterialFrameResourceRouteShell({
      prepareRoute: createQueuedMaterialPrepareRouteResult({
        queueItem: queueItem("test-preview"),
        material: {
          kind: "test-preview",
          label: "internal preview",
        } as never,
        sourceVersion: 13,
        frame: 55,
      }),
      backendMeshKey: "gpu-mesh:preview@13",
      backendMaterialKey: "gpu-material:preview@13",
      frameResources: frameResources(true, {
        resources: {
          rawGpuHandle: "GPUTexture",
          bindGroup: "GPUBindGroup",
        },
        diagnostics: [
          {
            code: "z.previewRoute",
            resourceKey: "gpu-material:preview@13",
          },
          {
            code: "a.previewRoute",
            resourceKey: "gpu-mesh:preview@13",
          },
          {
            code: "z.previewRoute",
            resourceKey: "gpu-material:preview@13",
          },
        ],
      }),
    });
    const summary = createQueuedMaterialFrameResourceRouteShellSummary(shell);
    const jsonSummary =
      queuedMaterialFrameResourceRouteShellSummaryToJsonValue(summary);

    expect(shell).toMatchObject({
      valid: true,
      status: "prepared",
      family: "test-preview",
      facadeMeshResourceKey: "facade-mesh:mesh:cube",
      facadeMaterialResourceKey: "facade-material:material:test-preview",
      backendMeshKey: "gpu-mesh:preview@13",
      backendMaterialKey: "gpu-material:preview@13",
      pipelineKey: "test-preview|opaque|back|less|none",
      sourceVersion: 13,
      frame: 55,
    });
    expect(summary).toEqual({
      valid: true,
      status: "prepared",
      family: "test-preview",
      hasFacadeMeshResourceKey: true,
      hasFacadeMaterialResourceKey: true,
      hasBackendMeshKey: true,
      hasBackendMaterialKey: true,
      pipelineKey: "test-preview|opaque|back|less|none",
      sourceVersion: 13,
      frame: 55,
      diagnostics: {
        total: 3,
        byCode: {
          "a.previewRoute": 1,
          "z.previewRoute": 2,
        },
      },
    });
    expect(jsonSummary).toEqual(summary);
    expect(JSON.stringify(shell)).not.toMatch(
      /GPUTexture|GPUBindGroup|rawGpuHandle|bindGroup/,
    );
    expect(JSON.stringify(jsonSummary)).not.toMatch(
      /gpu-material|gpu-mesh|facade-material|facade-mesh|GPU/,
    );
  });
});

function frameResources(
  valid: boolean,
  extra: Record<string, unknown> = {},
): { readonly valid: boolean; readonly diagnostics: readonly unknown[] } {
  return {
    valid,
    diagnostics: [],
    ...extra,
  };
}

function queueItem(
  materialFamily: MaterialQueueItem["materialFamily"],
): MaterialQueueItem {
  return {
    renderId: 3,
    drawIndex: 1,
    entity: { index: 3, generation: 0 },
    renderPhase: "opaque",
    materialFamily,
    pipelineKey: `${materialFamily}|opaque|back|less|none`,
    meshKey: "mesh:cube",
    materialKey: `material:${materialFamily}`,
    meshResourceKey: "facade-mesh:mesh:cube",
    materialResourceKey: `facade-material:material:${materialFamily}`,
    meshLayoutKey: "mesh-layout:position-normal-uv",
    topology: "triangle-list",
    depth: 1,
    sortKey: {
      renderPhase: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey: `${materialFamily}|opaque|back|less|none`,
      materialResourceKey: `facade-material:material:${materialFamily}`,
      meshResourceKey: "facade-mesh:mesh:cube",
      depth: 1,
      stableId: 3,
      drawIndex: 1,
    },
  };
}
