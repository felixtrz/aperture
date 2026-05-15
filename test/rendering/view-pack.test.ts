import { describe, expect, it } from "vitest";

import {
  packSnapshotViewUniforms,
  type RenderSnapshot,
  type ViewPacket,
} from "../../src/index.js";

describe("snapshot view uniform packing", () => {
  it("packs one view-projection matrix", () => {
    const matrix = matrixValues(1);
    const result = packSnapshotViewUniforms(
      snapshot({
        views: [view(3, 0)],
        viewMatrices: matrix,
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.views).toEqual([
      { viewId: 3, sourceOffset: 0, packedOffset: 0 },
    ]);
    expect(Array.from(result.data)).toEqual(Array.from(matrix));
  });

  it("packs multiple views in snapshot order", () => {
    const first = matrixValues(1);
    const second = matrixValues(100);
    const viewMatrices = new Float32Array([...first, ...second]);
    const result = packSnapshotViewUniforms(
      snapshot({
        views: [view(8, 16), view(2, 0)],
        viewMatrices,
      }),
    );

    expect(result.views).toEqual([
      { viewId: 8, sourceOffset: 16, packedOffset: 0 },
      { viewId: 2, sourceOffset: 0, packedOffset: 16 },
    ]);
    expect(Array.from(result.data.slice(0, 16))).toEqual(Array.from(second));
    expect(Array.from(result.data.slice(16, 32))).toEqual(Array.from(first));
  });

  it("diagnoses missing and out-of-range matrix data", () => {
    expect(
      packSnapshotViewUniforms(
        snapshot({ views: [view(1, 0)], viewMatrices: new Float32Array(0) }),
      ).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["viewUniform.missingMatrixData"]);

    expect(
      packSnapshotViewUniforms(
        snapshot({ views: [view(1, 8)], viewMatrices: matrixValues(1) }),
      ).diagnostics.map((diagnostic) => diagnostic.code),
    ).toEqual(["viewUniform.matrixOutOfRange"]);
  });

  it("diagnoses duplicate view ids and empty snapshots", () => {
    const duplicate = packSnapshotViewUniforms(
      snapshot({
        views: [view(4, 0), view(4, 0)],
        viewMatrices: matrixValues(1),
      }),
    );

    expect(duplicate.views).toEqual([
      { viewId: 4, sourceOffset: 0, packedOffset: 0 },
    ]);
    expect(duplicate.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "viewUniform.duplicateViewId",
    ]);

    expect(
      packSnapshotViewUniforms(snapshot({ views: [], viewMatrices: [] }))
        .diagnostics,
    ).toEqual([
      {
        code: "viewUniform.emptySnapshot",
        message: "Render snapshot has no views to pack.",
      },
    ]);
  });
});

function view(viewId: number, viewProjectionMatrixOffset: number): ViewPacket {
  return {
    viewId,
    camera: { index: viewId, generation: 0 },
    priority: 0,
    layerMask: 1,
    viewMatrixOffset: viewProjectionMatrixOffset,
    projectionMatrixOffset: viewProjectionMatrixOffset,
    viewProjectionMatrixOffset,
    viewport: [0, 0, 1, 1],
    scissor: [0, 0, 1, 1],
    clearColor: [0, 0, 0, 1],
    clearDepth: 1,
    clearStencil: 0,
    renderTarget: null,
  };
}

function snapshot(input: {
  readonly views: readonly ViewPacket[];
  readonly viewMatrices: ArrayLike<number>;
}): RenderSnapshot {
  return {
    frame: 1,
    views: input.views,
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: Float32Array.from(input.viewMatrices),
    diagnostics: [],
    report: {
      views: input.views.length,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function matrixValues(start: number): Float32Array {
  return Float32Array.from({ length: 16 }, (_, index) => start + index);
}
