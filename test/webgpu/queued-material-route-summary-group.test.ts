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

  it("sorts and merges diagnostic-code counts deterministically", () => {
    const prepareSummary = createQueuedMaterialPrepareRouteSummary(
      createQueuedMaterialPrepareRouteResult(
        {
          queueItem: queueItem("standard"),
          material: { kind: "standard" } as never,
          sourceVersion: 4,
          frame: 9,
        },
        {
          valid: false,
          status: "failed",
          diagnostics: [
            {
              code: "z.prepare",
              message: "Last prepare warning.",
              materialKey: "material:standard",
            },
            {
              code: "a.shared",
              message: "Shared prepare warning.",
              resourceKey: "facade-material:material:standard",
            },
            {
              code: "m.prepare",
              message: "Middle prepare warning.",
            },
          ],
        },
      ),
    );
    const frameSummary = createQueuedMaterialFrameResourceRouteShellSummary(
      createQueuedMaterialFrameResourceRouteShell({
        prepareRoute: createQueuedMaterialPrepareRouteResult({
          queueItem: queueItem("standard"),
          material: { kind: "standard" } as never,
          sourceVersion: 4,
          frame: 9,
        }),
        backendMeshKey: "backend-mesh:standard",
        backendMaterialKey: "backend-material:standard",
        frameResources: {
          valid: false,
          diagnostics: [
            {
              code: "z.frame",
              message: "Last frame warning.",
              backendMaterialKey: "backend-material:standard",
            },
            {
              code: "a.shared",
              message: "Shared frame warning.",
            },
            {
              code: "b.frame",
              message: "Middle frame warning.",
            },
          ],
        },
      }),
    );
    const group = queuedMaterialRouteSummaryGroupToJsonValue(
      createQueuedMaterialRouteSummaryGroup({
        prepareRoutes: [prepareSummary],
        frameResources: [frameSummary],
      }),
    );

    expect(group.prepareRoutes.diagnostics.byCode).toEqual({
      "a.shared": 1,
      "m.prepare": 1,
      "z.prepare": 1,
    });
    expect(group.frameResources.diagnostics.byCode).toEqual({
      "a.shared": 1,
      "b.frame": 1,
      "z.frame": 1,
    });
    expect(group.diagnostics.byCode).toEqual({
      "a.shared": 2,
      "b.frame": 1,
      "m.prepare": 1,
      "z.frame": 1,
      "z.prepare": 1,
    });
    expect(Object.keys(group.diagnostics.byCode)).toEqual([
      "a.shared",
      "b.frame",
      "m.prepare",
      "z.frame",
      "z.prepare",
    ]);
    expect(JSON.stringify(group)).not.toContain("material:standard");
    expect(JSON.stringify(group)).not.toContain("facade-material");
    expect(JSON.stringify(group)).not.toContain("backend-material");
    expect(JSON.stringify(group)).not.toContain("GPU");
  });

  it("keeps a clean summary group free of failed route state", () => {
    const failedPrepareSummary = createQueuedMaterialPrepareRouteSummary(
      createQueuedMaterialPrepareRouteResult(
        {
          queueItem: queueItem("debug-normal"),
          material: { kind: "debug-normal" } as never,
          sourceVersion: 7,
          frame: 15,
        },
        {
          valid: false,
          status: "failed",
          diagnostics: [
            {
              code: "queuedMaterialPrepareRoute.missingAdapter",
              message: "DebugNormal route is unsupported.",
              materialFamily: "debug-normal",
              materialKey: "material:debug-normal",
              resourceKey: "facade-material:material:debug-normal",
            },
          ],
        },
      ),
    );
    const failedFrameSummary =
      createQueuedMaterialFrameResourceRouteShellSummary(
        createQueuedMaterialFrameResourceRouteShell({
          prepareRoute: createQueuedMaterialPrepareRouteResult(
            {
              queueItem: queueItem("debug-normal"),
              material: { kind: "debug-normal" } as never,
              sourceVersion: 7,
              frame: 15,
            },
            {
              valid: false,
              status: "failed",
            },
          ),
          backendMeshKey: "backend-mesh:debug-normal",
          backendMaterialKey: "backend-material:debug-normal",
          frameResources: {
            valid: false,
            diagnostics: [
              {
                code: "queuedMaterialFrameResource.failed",
                message: "DebugNormal frame resources failed.",
                backendMaterialKey: "backend-material:debug-normal",
              },
            ],
          },
        }),
      );

    const failedGroup = createQueuedMaterialRouteSummaryGroup({
      prepareRoutes: [failedPrepareSummary],
      frameResources: [failedFrameSummary],
    });

    expect(failedGroup).toMatchObject({
      prepareRoutes: {
        total: 1,
        valid: 0,
        invalid: 1,
        byStatus: { failed: 1 },
        diagnostics: {
          total: 1,
          byCode: {
            "queuedMaterialPrepareRoute.missingAdapter": 1,
          },
        },
      },
      frameResources: {
        total: 1,
        valid: 0,
        invalid: 1,
        byStatus: { failed: 1 },
        diagnostics: {
          total: 1,
          byCode: {
            "queuedMaterialFrameResource.failed": 1,
          },
        },
      },
    });

    const cleanPrepareSummary = createQueuedMaterialPrepareRouteSummary(
      createQueuedMaterialPrepareRouteResult({
        queueItem: queueItem("standard"),
        material: { kind: "standard" } as never,
        sourceVersion: 8,
        frame: 16,
      }),
    );
    const cleanFrameSummary =
      createQueuedMaterialFrameResourceRouteShellSummary(
        createQueuedMaterialFrameResourceRouteShell({
          prepareRoute: createQueuedMaterialPrepareRouteResult({
            queueItem: queueItem("standard"),
            material: { kind: "standard" } as never,
            sourceVersion: 8,
            frame: 16,
          }),
          backendMeshKey: "backend-mesh:standard",
          backendMaterialKey: "backend-material:standard",
          frameResources: {
            valid: true,
            diagnostics: [],
          },
        }),
      );

    const cleanGroup = createQueuedMaterialRouteSummaryGroup({
      prepareRoutes: [cleanPrepareSummary],
      frameResources: [cleanFrameSummary],
    });
    const cleanJson = queuedMaterialRouteSummaryGroupToJsonValue(cleanGroup);

    expect(cleanJson).toEqual({
      prepareRoutes: {
        total: 1,
        valid: 1,
        invalid: 0,
        byStatus: { prepared: 1 },
        diagnostics: {
          total: 0,
          byCode: {},
        },
      },
      frameResources: {
        total: 1,
        valid: 1,
        invalid: 0,
        byStatus: { prepared: 1 },
        diagnostics: {
          total: 0,
          byCode: {},
        },
      },
      diagnostics: {
        total: 0,
        byCode: {},
      },
    });
    expect(JSON.stringify(cleanJson)).not.toContain("failed");
    expect(JSON.stringify(cleanJson)).not.toContain("missingAdapter");
    expect(JSON.stringify(cleanJson)).not.toContain("debug-normal");
    expect(JSON.stringify(cleanJson)).not.toContain("backend-material");
    expect(JSON.stringify(cleanJson)).not.toContain("backend-mesh");
    expect(JSON.stringify(cleanJson)).not.toContain("facade-material");
    expect(JSON.stringify(cleanJson)).not.toContain("facade-mesh");
    expect(JSON.stringify(cleanJson)).not.toContain("GPU");
  });

  it("summarizes test-only non-built-in route health without raw resource keys", () => {
    const materialFamily =
      "preview-custom" as MaterialQueueItem["materialFamily"];
    const prepareSummary = createQueuedMaterialPrepareRouteSummary(
      createQueuedMaterialPrepareRouteResult({
        queueItem: queueItem(materialFamily),
        material: { kind: materialFamily } as never,
        sourceVersion: 21,
        frame: 34,
      }),
    );
    const frameSummary = createQueuedMaterialFrameResourceRouteShellSummary(
      createQueuedMaterialFrameResourceRouteShell({
        prepareRoute: createQueuedMaterialPrepareRouteResult({
          queueItem: queueItem(materialFamily),
          material: { kind: materialFamily } as never,
          sourceVersion: 21,
          frame: 34,
        }),
        backendMeshKey: "backend-mesh:preview-custom",
        backendMaterialKey: "backend-material:preview-custom",
        frameResources: {
          valid: true,
          diagnostics: [],
        },
      }),
    );

    expect(prepareSummary).toMatchObject({
      valid: true,
      status: "prepared",
      family: "preview-custom",
      hasFacadeMeshResourceKey: true,
      hasFacadeMaterialResourceKey: true,
      diagnostics: { total: 0, byCode: {} },
    });
    expect(frameSummary).toMatchObject({
      valid: true,
      status: "prepared",
      family: "preview-custom",
      hasFacadeMeshResourceKey: true,
      hasFacadeMaterialResourceKey: true,
      hasBackendMeshKey: true,
      hasBackendMaterialKey: true,
      diagnostics: { total: 0, byCode: {} },
    });

    const group = createQueuedMaterialRouteSummaryGroup({
      prepareRoutes: [prepareSummary],
      frameResources: [frameSummary],
    });
    const groupJson = queuedMaterialRouteSummaryGroupToJsonValue(group);

    expect(groupJson).toEqual({
      prepareRoutes: {
        total: 1,
        valid: 1,
        invalid: 0,
        byStatus: { prepared: 1 },
        diagnostics: {
          total: 0,
          byCode: {},
        },
      },
      frameResources: {
        total: 1,
        valid: 1,
        invalid: 0,
        byStatus: { prepared: 1 },
        diagnostics: {
          total: 0,
          byCode: {},
        },
      },
      diagnostics: {
        total: 0,
        byCode: {},
      },
    });
    expect(JSON.stringify(prepareSummary)).not.toContain("facade-material");
    expect(JSON.stringify(frameSummary)).not.toContain("backend-material");
    expect(JSON.stringify(groupJson)).not.toContain("facade-material");
    expect(JSON.stringify(groupJson)).not.toContain("facade-mesh");
    expect(JSON.stringify(groupJson)).not.toContain("backend-material");
    expect(JSON.stringify(groupJson)).not.toContain("backend-mesh");
    expect(JSON.stringify(groupJson)).not.toContain("GPU");
  });

  it("aggregates mixed built-in, test-only, and failed routes deterministically", () => {
    const customFamily =
      "preview-custom" as MaterialQueueItem["materialFamily"];
    const preparedStandard = createQueuedMaterialPrepareRouteResult({
      queueItem: queueItem("standard"),
      material: { kind: "standard" } as never,
      sourceVersion: 31,
      frame: 55,
    });
    const preparedCustom = createQueuedMaterialPrepareRouteResult({
      queueItem: queueItem(customFamily),
      material: { kind: customFamily } as never,
      sourceVersion: 32,
      frame: 55,
    });
    const failedDebug = createQueuedMaterialPrepareRouteResult(
      {
        queueItem: queueItem("debug-normal"),
        material: { kind: "debug-normal" } as never,
        sourceVersion: 33,
        frame: 55,
      },
      {
        valid: false,
        status: "failed",
        diagnostics: [
          {
            code: "queuedMaterialPrepareRoute.missingAdapter",
            message: "DebugNormal route is unsupported.",
            materialFamily: "debug-normal",
            materialKey: "material:debug-normal",
            resourceKey: "facade-material:material:debug-normal",
          },
        ],
      },
    );

    const group = createQueuedMaterialRouteSummaryGroup({
      prepareRoutes: [
        createQueuedMaterialPrepareRouteSummary(preparedStandard),
        createQueuedMaterialPrepareRouteSummary(preparedCustom),
        createQueuedMaterialPrepareRouteSummary(failedDebug),
      ],
      frameResources: [
        createQueuedMaterialFrameResourceRouteShellSummary(
          createQueuedMaterialFrameResourceRouteShell({
            prepareRoute: preparedStandard,
            backendMeshKey: "backend-mesh:standard",
            backendMaterialKey: "backend-material:standard",
            frameResources: {
              valid: true,
              diagnostics: [],
            },
          }),
        ),
        createQueuedMaterialFrameResourceRouteShellSummary(
          createQueuedMaterialFrameResourceRouteShell({
            prepareRoute: preparedCustom,
            backendMeshKey: "backend-mesh:preview-custom",
            backendMaterialKey: "backend-material:preview-custom",
            frameResources: {
              valid: true,
              diagnostics: [],
            },
          }),
        ),
        createQueuedMaterialFrameResourceRouteShellSummary(
          createQueuedMaterialFrameResourceRouteShell({
            prepareRoute: failedDebug,
            backendMeshKey: "backend-mesh:debug-normal",
            backendMaterialKey: "backend-material:debug-normal",
            frameResources: {
              valid: false,
              diagnostics: [
                {
                  code: "queuedMaterialFrameResource.failed",
                  message: "DebugNormal frame resources failed.",
                  backendMaterialKey: "backend-material:debug-normal",
                },
              ],
            },
          }),
        ),
      ],
    });
    const groupJson = queuedMaterialRouteSummaryGroupToJsonValue(group);

    expect(groupJson).toEqual({
      prepareRoutes: {
        total: 3,
        valid: 2,
        invalid: 1,
        byStatus: { failed: 1, prepared: 2 },
        diagnostics: {
          total: 1,
          byCode: {
            "queuedMaterialPrepareRoute.missingAdapter": 1,
          },
        },
      },
      frameResources: {
        total: 3,
        valid: 2,
        invalid: 1,
        byStatus: { failed: 1, prepared: 2 },
        diagnostics: {
          total: 1,
          byCode: {
            "queuedMaterialFrameResource.failed": 1,
          },
        },
      },
      diagnostics: {
        total: 2,
        byCode: {
          "queuedMaterialFrameResource.failed": 1,
          "queuedMaterialPrepareRoute.missingAdapter": 1,
        },
      },
    });
    expect(JSON.stringify(groupJson)).not.toContain("material:standard");
    expect(JSON.stringify(groupJson)).not.toContain("material:preview-custom");
    expect(JSON.stringify(groupJson)).not.toContain("material:debug-normal");
    expect(JSON.stringify(groupJson)).not.toContain("facade-material");
    expect(JSON.stringify(groupJson)).not.toContain("facade-mesh");
    expect(JSON.stringify(groupJson)).not.toContain("backend-material");
    expect(JSON.stringify(groupJson)).not.toContain("backend-mesh");
    expect(JSON.stringify(groupJson)).not.toContain("GPU");
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
