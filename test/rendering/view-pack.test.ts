import { describe, expect, it } from "vitest";

import {
  PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
  createPackedSnapshotViewUniformsScratch,
  packSnapshotViewUniforms,
  writePackedSnapshotViewUniforms,
  type RenderSnapshot,
  type ViewPacket,
} from "@aperture-engine/core";

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
    expect(result.data.length).toBe(PACKED_VIEW_UNIFORM_FLOAT_STRIDE);
    expect(Array.from(result.data.slice(0, 16))).toEqual(Array.from(matrix));
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
      {
        viewId: 2,
        sourceOffset: 0,
        packedOffset: PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
      },
    ]);
    expect(Array.from(result.data.slice(0, 16))).toEqual(Array.from(second));
    expect(
      Array.from(
        result.data.slice(
          PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
          PACKED_VIEW_UNIFORM_FLOAT_STRIDE + 16,
        ),
      ),
    ).toEqual(Array.from(first));
  });

  it("packs camera world position after the view-projection matrix", () => {
    const viewMatrix = viewMatrixForCamera(2, 3, 4);
    const viewProjection = matrixValues(100);
    const result = packSnapshotViewUniforms(
      snapshot({
        views: [view(12, 16, 0)],
        viewMatrices: new Float32Array([...viewMatrix, ...viewProjection]),
      }),
    );

    expect(result.diagnostics).toEqual([]);
    expect(Array.from(result.data.slice(0, 16))).toEqual(
      Array.from(viewProjection),
    );
    expect(Array.from(result.data.slice(16, 20))).toEqual([2, 3, 4, 1]);
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

  it("reuses scratch result, view records, and backing data across successful writes", () => {
    const firstMatrix = matrixValues(1);
    const secondMatrix = matrixValues(100);
    const viewMatrices = new Float32Array([...firstMatrix, ...secondMatrix]);
    const scratch = createPackedSnapshotViewUniformsScratch(32, 2);
    const first = writePackedSnapshotViewUniforms(
      snapshot({
        views: [view(8, 16), view(2, 0)],
        viewMatrices,
      }),
      scratch,
    );
    const firstData = first.data;
    const firstViews = [...first.views];
    const second = writePackedSnapshotViewUniforms(
      snapshot({
        views: [view(2, 0), view(8, 16)],
        viewMatrices,
      }),
      scratch,
    );

    expect(second).toBe(first);
    expect(second.data).toBe(firstData);
    expect(new Set(second.views)).toEqual(new Set(firstViews));
    expect(second.floatCount).toBe(2 * PACKED_VIEW_UNIFORM_FLOAT_STRIDE);
    expect(second.views.map((record) => record.viewId)).toEqual([2, 8]);
    expect(Array.from(second.data.slice(0, 16))).toEqual(
      Array.from(firstMatrix),
    );
    expect(
      Array.from(
        second.data.slice(
          PACKED_VIEW_UNIFORM_FLOAT_STRIDE,
          PACKED_VIEW_UNIFORM_FLOAT_STRIDE + 16,
        ),
      ),
    ).toEqual(Array.from(secondMatrix));
  });
});

function view(
  viewId: number,
  viewProjectionMatrixOffset: number,
  viewMatrixOffset = viewProjectionMatrixOffset,
): ViewPacket {
  return {
    viewId,
    camera: { index: viewId, generation: 0 },
    priority: 0,
    layerMask: 1,
    viewMatrixOffset,
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

function viewMatrixForCamera(x: number, y: number, z: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
}
