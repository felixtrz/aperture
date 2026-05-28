import { describe, expect, it } from "vitest";

import {
  createRenderResourceInspectionReport,
  createRenderResourceLifecycleReport,
  type RenderResourceLifecycleKeySets,
} from "@aperture-engine/webgpu/test-support";

describe("renderer resource lifecycle report", () => {
  it("reports retained resources when key sets do not change", () => {
    const previous = resourceKeys({
      mesh: ["mesh-buffer:Cube"],
      material: ["material-buffer:White"],
      view: ["view-uniform-buffer:MainCamera"],
      shader: ["shader-module:aperture/unlit"],
      pipeline: ["render-pipeline:unlit"],
    });
    const report = createRenderResourceLifecycleReport({
      previous,
      next: previous,
    });

    expect(report.hasChanges).toBe(false);
    expect(report.totals).toEqual({ retained: 5, created: 0, removed: 0 });
    expect(report.byKind.mesh).toEqual({
      retained: ["mesh-buffer:Cube"],
      created: [],
      removed: [],
    });
  });

  it("reports resources created by kind", () => {
    const report = createRenderResourceLifecycleReport({
      previous: resourceKeys(),
      next: resourceKeys({
        mesh: ["mesh-buffer:Sphere", "mesh-buffer:Cube"],
        material: ["material-buffer:White"],
      }),
    });

    expect(report.hasChanges).toBe(true);
    expect(report.totals).toEqual({ retained: 0, created: 3, removed: 0 });
    expect(report.byKind.mesh).toEqual({
      retained: [],
      created: ["mesh-buffer:Cube", "mesh-buffer:Sphere"],
      removed: [],
    });
    expect(report.byKind.material.created).toEqual(["material-buffer:White"]);
  });

  it("reports resources removed by kind without destroying them", () => {
    const report = createRenderResourceLifecycleReport({
      previous: resourceKeys({
        view: ["view-uniform-buffer:MainCamera"],
        shader: ["shader-module:aperture/unlit"],
        pipeline: ["render-pipeline:unlit"],
      }),
      next: resourceKeys(),
    });

    expect(report.hasChanges).toBe(true);
    expect(report.totals).toEqual({ retained: 0, created: 0, removed: 3 });
    expect(report.byKind.view.removed).toEqual([
      "view-uniform-buffer:MainCamera",
    ]);
    expect(report.byKind.shader.removed).toEqual([
      "shader-module:aperture/unlit",
    ]);
    expect(report.byKind.pipeline.removed).toEqual(["render-pipeline:unlit"]);
  });

  it("reports mixed replacement across resource kinds", () => {
    const report = createRenderResourceLifecycleReport({
      previous: resourceKeys({
        mesh: ["mesh-buffer:A", "mesh-buffer:B"],
        material: ["material-buffer:Old"],
        view: ["view-uniform-buffer:Main"],
        shader: ["shader-module:old"],
      }),
      next: resourceKeys({
        mesh: ["mesh-buffer:B", "mesh-buffer:C"],
        material: ["material-buffer:New"],
        view: ["view-uniform-buffer:Main"],
        pipeline: ["render-pipeline:new"],
      }),
    });

    expect(report.totals).toEqual({ retained: 2, created: 3, removed: 3 });
    expect(report.byKind.mesh).toEqual({
      retained: ["mesh-buffer:B"],
      created: ["mesh-buffer:C"],
      removed: ["mesh-buffer:A"],
    });
    expect(report.byKind.material).toEqual({
      retained: [],
      created: ["material-buffer:New"],
      removed: ["material-buffer:Old"],
    });
    expect(report.byKind.view).toEqual({
      retained: ["view-uniform-buffer:Main"],
      created: [],
      removed: [],
    });
    expect(report.byKind.shader).toEqual({
      retained: [],
      created: [],
      removed: ["shader-module:old"],
    });
    expect(report.byKind.pipeline).toEqual({
      retained: [],
      created: ["render-pipeline:new"],
      removed: [],
    });
  });

  it("inspects live, stale, missing, and pending-destroy resources", () => {
    const report = createRenderResourceInspectionReport([
      {
        kind: "mesh",
        assetKey: "mesh:Cube",
        resourceKey: "mesh-buffer:Cube",
        version: 2,
        expectedVersion: 2,
        status: "live",
        pendingDestroy: false,
      },
      {
        kind: "material",
        assetKey: "material:Old",
        resourceKey: "material-buffer:Old",
        version: 1,
        expectedVersion: 2,
        status: "stale",
        pendingDestroy: false,
      },
      {
        kind: "view",
        resourceKey: "view-uniform-buffer:Missing",
        status: "missing",
        pendingDestroy: false,
      },
      {
        kind: "pipeline",
        resourceKey: "pipeline:old",
        status: "pending-destroy",
        pendingDestroy: true,
      },
    ]);

    expect(report.counts).toEqual({
      total: 4,
      live: 1,
      missing: 1,
      stale: 1,
      pendingDestroy: 1,
    });
    expect(report.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderResourceInspection.staleResource",
      "renderResourceInspection.missingResource",
      "renderResourceInspection.pendingDestroy",
    ]);
    expect(report.records.map((record) => record.resourceKey)).toEqual([
      "mesh-buffer:Cube",
      "material-buffer:Old",
      "view-uniform-buffer:Missing",
      "pipeline:old",
    ]);
  });
});

function resourceKeys(
  keys: Partial<Record<keyof RenderResourceLifecycleKeySets, string[]>> = {},
): RenderResourceLifecycleKeySets {
  return {
    mesh: new Set(keys.mesh ?? []),
    material: new Set(keys.material ?? []),
    view: new Set(keys.view ?? []),
    shader: new Set(keys.shader ?? []),
    pipeline: new Set(keys.pipeline ?? []),
  };
}
