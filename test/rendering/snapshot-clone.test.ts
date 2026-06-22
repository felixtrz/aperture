import { describe, expect, it } from "vitest";
import { createEnvironmentMapHandle } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import { validateRenderSnapshotCloneability } from "@aperture-engine/render/test-support";

describe("render snapshot cloneability validation", () => {
  it("accepts structured-clone-friendly snapshots", () => {
    expect(validateRenderSnapshotCloneability(snapshot())).toEqual({
      valid: true,
      diagnostics: [],
    });
  });

  it("accepts environment packets with cloneable environment-map handles", () => {
    const source: RenderSnapshot = {
      ...snapshot(),
      environments: [
        {
          environmentId: 1,
          handle: createEnvironmentMapHandle("studio"),
          color: [1, 1, 1, 1],
          intensity: 1,
          layerMask: 1,
        },
      ],
      report: {
        ...snapshot().report,
        environments: 1,
      },
    };
    const cloned = structuredClone(source) as RenderSnapshot;

    expect(validateRenderSnapshotCloneability(source)).toEqual({
      valid: true,
      diagnostics: [],
    });
    expect(cloned.environments[0]?.handle).toMatchObject({
      kind: "environment-map",
      id: "studio",
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
