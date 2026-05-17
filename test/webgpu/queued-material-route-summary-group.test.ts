import { describe, expect, it } from "vitest";

import { type MaterialQueueItem } from "@aperture-engine/core";
import {
  createQueuedMaterialFrameResourceRouteShell,
  createQueuedMaterialFrameResourceRouteShellSummary,
  createQueuedMaterialPrepareRouteResult,
  createQueuedMaterialPrepareRouteSummary,
  createQueuedMaterialRouteSummaryGroup,
  queuedMaterialPrepareRouteSummaryToJsonValue,
  queuedMaterialRouteSummaryGroupToJsonValue,
} from "@aperture-engine/webgpu";

describe("queued material route summary group", () => {
  it("summarizes prepare routes without raw material or resource keys", () => {
    const summary = createQueuedMaterialPrepareRouteSummary(
      createQueuedMaterialPrepareRouteResult(
        {
          queueItem: queueItem("standard"),
          material: { kind: "standard" } as never,
          sourceVersion: 12,
          frame: 40,
        },
        {
          valid: false,
          status: "failed",
          diagnostics: [
            {
              code: "z.prepare",
              message: "last",
              materialKey: "material:standard",
            },
            {
              code: "a.prepare",
              message: "first",
              resourceKey: "prepared-material:standard",
            },
          ],
        },
      ),
    );

    expect(summary).toEqual({
      valid: false,
      status: "failed",
      family: "standard",
      hasFacadeMeshResourceKey: true,
      hasFacadeMaterialResourceKey: true,
      pipelineKey: "standard|opaque|back|less|none",
      sourceVersion: 12,
      frame: 40,
      diagnostics: {
        total: 2,
        byCode: {
          "a.prepare": 1,
          "z.prepare": 1,
        },
      },
    });
    expect(queuedMaterialPrepareRouteSummaryToJsonValue(summary)).toEqual(
      summary,
    );
    expect(JSON.stringify(summary)).not.toContain("material:standard");
    expect(JSON.stringify(summary)).not.toContain("prepared-material");
    expect(JSON.stringify(summary)).not.toContain("GPU");
  });

  it("groups prepare and frame-resource route health by stage", () => {
    const prepareSummary = createQueuedMaterialPrepareRouteSummary(
      createQueuedMaterialPrepareRouteResult(
        {
          queueItem: queueItem("unlit"),
          material: { kind: "unlit" } as never,
          sourceVersion: 3,
          frame: 8,
        },
        {
          diagnostics: [
            {
              code: "shared.warning",
              message: "Prepare warning.",
            },
          ],
        },
      ),
    );
    const frameSummary = createQueuedMaterialFrameResourceRouteShellSummary(
      createQueuedMaterialFrameResourceRouteShell({
        prepareRoute: createQueuedMaterialPrepareRouteResult(
          {
            queueItem: queueItem("unlit"),
            material: { kind: "unlit" } as never,
            sourceVersion: 3,
            frame: 8,
          },
          { status: "prepared" },
        ),
        backendMeshKey: "source-mesh:cube@3",
        backendMaterialKey: "source-material:unlit@3",
        frameResources: {
          valid: false,
          diagnostics: [
            {
              code: "shared.warning",
              message: "Frame warning.",
            },
            {
              code: "frame.failed",
              message: "Frame failed.",
            },
          ],
        },
      }),
    );
    const group = createQueuedMaterialRouteSummaryGroup({
      prepareRoutes: [prepareSummary],
      frameResources: [frameSummary],
    });

    expect(group).toEqual({
      prepareRoutes: {
        total: 1,
        valid: 1,
        invalid: 0,
        byStatus: { prepared: 1 },
        diagnostics: {
          total: 1,
          byCode: { "shared.warning": 1 },
        },
      },
      frameResources: {
        total: 1,
        valid: 0,
        invalid: 1,
        byStatus: { failed: 1 },
        diagnostics: {
          total: 2,
          byCode: {
            "frame.failed": 1,
            "shared.warning": 1,
          },
        },
      },
      diagnostics: {
        total: 3,
        byCode: {
          "frame.failed": 1,
          "shared.warning": 2,
        },
      },
    });
    expect(queuedMaterialRouteSummaryGroupToJsonValue(group)).toEqual(group);
    expect(JSON.stringify(group)).not.toContain("source-material");
    expect(JSON.stringify(group)).not.toContain("source-mesh");
    expect(JSON.stringify(group)).not.toContain("facade-material");
    expect(JSON.stringify(group)).not.toContain("facade-mesh");
    expect(JSON.stringify(group)).not.toContain("GPU");
  });
});

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
