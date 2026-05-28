import { describe, expect, it } from "vitest";
import type { MaterialQueueItem } from "@aperture-engine/render";
import {
  createQueuedMaterialFrameResourceRouteShell,
  createQueuedMaterialPrepareRouteResult,
  createWebGpuAppFrameResourceRouteDiagnostic,
} from "@aperture-engine/webgpu/test-support";

describe("queued material frame-resource route diagnostics", () => {
  it("creates JSON-safe app diagnostics from frame-resource route shells", () => {
    const route = createQueuedMaterialFrameResourceRouteShell({
      prepareRoute: createQueuedMaterialPrepareRouteResult({
        queueItem: queueItem("standard"),
        material: { kind: "standard" } as never,
        sourceVersion: 9,
        frame: 44,
      }),
      backendMeshKey: "source-mesh:cube@9",
      backendMaterialKey: "source-material:standard@9",
      frameResources: {
        valid: false,
        diagnostics: [
          {
            code: "standardFrameResources.missingLights",
            message: "StandardMaterial frame resources require lights.",
          },
        ],
      },
    });

    const diagnostic = createWebGpuAppFrameResourceRouteDiagnostic(route);

    expect(diagnostic).toEqual({
      code: "webGpuApp.frameResourceRoute",
      message:
        "WebGPU app frame resource preparation failed for 'standard' material route.",
      route: {
        valid: false,
        status: "failed",
        family: "standard",
        facadeMeshResourceKey: "facade-mesh:mesh:cube",
        facadeMaterialResourceKey: "facade-material:material:standard",
        backendMeshKey: "source-mesh:cube@9",
        backendMaterialKey: "source-material:standard@9",
        pipelineKey: "standard|opaque|back|less|none",
        sourceVersion: 9,
        frame: 44,
        diagnostics: [
          {
            code: "standardFrameResources.missingLights",
            message: "StandardMaterial frame resources require lights.",
          },
        ],
      },
    });
    expect(JSON.stringify(diagnostic)).not.toContain("GPUBuffer");
    expect(JSON.parse(JSON.stringify(diagnostic))).toEqual(diagnostic);
  });
});

function queueItem(
  materialFamily: MaterialQueueItem["materialFamily"],
): MaterialQueueItem {
  return {
    renderId: 5,
    drawIndex: 2,
    entity: { index: 5, generation: 0 },
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
      stableId: 5,
      drawIndex: 2,
    },
  };
}
