import { describe, expect, it } from "vitest";

import { type MaterialQueueItem } from "@aperture-engine/core";
import {
  createQueuedMaterialFrameResourceRouteShell,
  createQueuedMaterialPrepareRouteResult,
} from "@aperture-engine/webgpu";

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
