import { describe, expect, it } from "vitest";

import {
  validateRenderSnapshotCloneability,
  type RenderSnapshot,
} from "../../src/index.js";

describe("render snapshot cloneability validation", () => {
  it("accepts structured-clone-friendly snapshots", () => {
    expect(validateRenderSnapshotCloneability(snapshot())).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it("reports clone failures through injected clone functions", () => {
    expect(
      validateRenderSnapshotCloneability(snapshot(), {
        clone: () => {
          throw new Error("cannot clone");
        },
      }).diagnostics,
    ).toEqual([
      {
        code: "renderSnapshotClone.cloneFailed",
        message: "cannot clone",
      },
    ]);
  });

  it("reports invalid transform and view matrix buffers", () => {
    const invalid = {
      ...snapshot(),
      transforms: [] as unknown as Float32Array,
      viewMatrices: [] as unknown as Float32Array,
    };

    expect(
      validateRenderSnapshotCloneability(invalid).diagnostics.map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual([
      "renderSnapshotClone.invalidTransformBuffer",
      "renderSnapshotClone.invalidViewMatrixBuffer",
    ]);
  });
});

function snapshot(): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}
