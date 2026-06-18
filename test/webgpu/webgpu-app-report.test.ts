import type {
  RenderSnapshot,
  RenderSnapshotChangeSet,
  RenderSnapshotFamilyChangeCounts,
} from "@aperture-engine/render";
import { describe, expect, it } from "vitest";
import {
  renderReport,
  webGpuAppRenderReportToJsonValue,
} from "../../packages/webgpu/src/app/report.js";

describe("WebGPU app report serialization", () => {
  it("keeps full render change-set keys for explicit reports and compacts status keys", () => {
    const report = renderReport({
      ok: true,
      snapshot: emptySnapshot(2),
      snapshotChangeSet: changeSetWithKeys(),
      diagnostics: [],
    });
    const full = webGpuAppRenderReportToJsonValue(report);
    const status = webGpuAppRenderReportToJsonValue(report, {
      detail: "status",
    });

    expect(
      full.renderChangeSet?.["keys"]?.["meshDraws"]?.["unchanged"],
    ).toEqual([
      "mesh-draw:0",
      "mesh-draw:1",
      "mesh-draw:2",
      "mesh-draw:3",
      "mesh-draw:4",
      "mesh-draw:5",
      "mesh-draw:6",
      "mesh-draw:7",
      "mesh-draw:8",
      "mesh-draw:9",
    ]);
    expect(
      status.renderChangeSet?.["keys"]?.["meshDraws"]?.["unchanged"],
    ).toEqual({
      count: 10,
      sample: [
        "mesh-draw:0",
        "mesh-draw:1",
        "mesh-draw:2",
        "mesh-draw:3",
        "mesh-draw:4",
        "mesh-draw:5",
        "mesh-draw:6",
        "mesh-draw:7",
      ],
      omitted: 2,
    });
    expect(status.renderChangeSet?.["meshDraws"]).toEqual({
      changed: 1,
      unchanged: 10,
      removed: 0,
    });
  });
});

const noChanges: RenderSnapshotFamilyChangeCounts = {
  changed: 0,
  unchanged: 0,
  removed: 0,
};

function changeSetWithKeys(): RenderSnapshotChangeSet {
  const meshUnchanged = Array.from(
    { length: 10 },
    (_, index) => `mesh-draw:${index}`,
  );

  return {
    previousFrame: 1,
    frame: 2,
    views: noChanges,
    meshDraws: {
      changed: 1,
      unchanged: meshUnchanged.length,
      removed: 0,
    },
    shadowCasterDraws: noChanges,
    lights: noChanges,
    environments: noChanges,
    shadowRequests: noChanges,
    bounds: {
      changed: 0,
      unchanged: 1,
      removed: 0,
    },
    total: {
      changed: 1,
      unchanged: meshUnchanged.length + 1,
      removed: 0,
    },
    keys: {
      views: emptyKeys(),
      meshDraws: {
        changed: ["mesh-draw:changed"],
        unchanged: meshUnchanged,
        removed: [],
      },
      shadowCasterDraws: emptyKeys(),
      lights: emptyKeys(),
      environments: emptyKeys(),
      shadowRequests: emptyKeys(),
      bounds: {
        changed: [],
        unchanged: ["bounds:12:1"],
        removed: [],
      },
    },
  };
}

function emptyKeys(): {
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly removed: readonly string[];
} {
  return {
    changed: [],
    unchanged: [],
    removed: [],
  };
}

function emptySnapshot(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(),
    viewMatrices: new Float32Array(),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      fogs: 0,
      shadowRequests: 0,
      bounds: 0,
      quadBatches: 0,
      quadInstances: 0,
      diagnostics: 0,
    },
  };
}
