import { describe, expect, it } from "vitest";

import {
  cumulativeArcLengths,
  distancePointToSegmentPixels,
  expandSegmentQuadCornerPixels,
  LINE_SEGMENT_FLOAT_STRIDE,
  packLineSegmentInstances,
  packPointInstances,
  perspectivePointSizePixels,
  POINT_INSTANCE_FLOAT_STRIDE,
  transformPointByFlatMatrix,
  type LinePacket,
  type PointsPacket,
  type RenderSnapshot,
} from "@aperture-engine/webgpu/test-support";

const IDENTITY = Float32Array.from([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

function translation(x: number, y: number, z: number): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

describe("E1 fat-line screen-space quad expansion", () => {
  it("expands a horizontal segment by half the width perpendicular, with half-width caps", () => {
    const p0: [number, number] = [10, 50];
    const p1: [number, number] = [90, 50];
    const halfWidth = 4;

    // Corner 0: endpoint p0, -normal, -along  -> (6, 46)
    // Corner 1: endpoint p0, +normal, -along  -> (6, 54)
    // Corner 2: endpoint p1, +normal, +along  -> (94, 54)
    // Corner 5: endpoint p1, -normal, +along  -> (94, 46)
    expect(expandSegmentQuadCornerPixels(p0, p1, halfWidth, 0)).toEqual([
      6, 46,
    ]);
    expect(expandSegmentQuadCornerPixels(p0, p1, halfWidth, 1)).toEqual([
      6, 54,
    ]);
    expect(expandSegmentQuadCornerPixels(p0, p1, halfWidth, 2)).toEqual([
      94, 54,
    ]);
    expect(expandSegmentQuadCornerPixels(p0, p1, halfWidth, 5)).toEqual([
      94, 46,
    ]);

    // Perpendicular extent equals the full width (2 * halfWidth).
    const perpendicularExtent =
      expandSegmentQuadCornerPixels(p0, p1, halfWidth, 1)[1] -
      expandSegmentQuadCornerPixels(p0, p1, halfWidth, 0)[1];
    expect(perpendicularExtent).toBe(2 * halfWidth);
  });

  it("expands a vertical segment perpendicular along x", () => {
    const p0: [number, number] = [40, 10];
    const p1: [number, number] = [40, 90];
    const corner = expandSegmentQuadCornerPixels(p0, p1, 3, 1);

    // dir = (0,1), normal = (-1,0); corner 1 is +normal at p0 minus along.
    expect(corner[0]).toBeCloseTo(37, 5);
    expect(corner[1]).toBeCloseTo(7, 5);
  });

  it("falls back to a round dot for a degenerate (zero-length) segment", () => {
    const point: [number, number] = [20, 20];
    const corners = [0, 1, 2, 3, 4, 5].map((index) =>
      expandSegmentQuadCornerPixels(point, point, 5, index),
    );

    for (const corner of corners) {
      expect(Math.hypot(corner[0] - 20, corner[1] - 20)).toBeLessThanOrEqual(
        5 * Math.SQRT2 + 1e-6,
      );
    }
  });
});

describe("E1 capsule SDF (round caps/joins)", () => {
  it("measures perpendicular distance and clamps to endpoints", () => {
    const a: [number, number] = [10, 50];
    const b: [number, number] = [90, 50];

    expect(distancePointToSegmentPixels([50, 50], a, b)).toBeCloseTo(0, 6);
    expect(distancePointToSegmentPixels([50, 54], a, b)).toBeCloseTo(4, 6);
    // Before the start: clamps to a, so distance is the cap radius.
    expect(distancePointToSegmentPixels([5, 50], a, b)).toBeCloseTo(5, 6);
  });
});

describe("E1 world-continuous dash arc lengths", () => {
  it("accumulates segment lengths from vertex 0", () => {
    const arc = cumulativeArcLengths([0, 0, 0, 3, 0, 0, 3, 4, 0], 3);

    expect(Array.from(arc)).toEqual([0, 3, 7]);
  });
});

describe("E1 perspective point size attenuation", () => {
  it("scales inversely with clip-space depth (nearer points are larger)", () => {
    const near = perspectivePointSizePixels(1, 600, 1);
    const far = perspectivePointSizePixels(1, 600, 2);

    expect(near).toBeCloseTo(300, 6);
    expect(far).toBeCloseTo(150, 6);
    expect(near).toBeGreaterThan(far);
  });

  it("returns the world size when the point is at/behind the eye", () => {
    expect(perspectivePointSizePixels(4, 600, 0)).toBe(4);
    expect(perspectivePointSizePixels(4, 600, -3)).toBe(4);
  });
});

describe("E1 line segment instance packing", () => {
  it("packs one instance per segment, applying the world transform for arc length", () => {
    const line: LinePacket = {
      renderId: 7,
      entity: { index: 1, generation: 0 },
      vertexOffset: 0,
      vertexCount: 3,
      color: [0.2, 0.4, 0.6, 1],
      width: 8,
      dashSize: 2,
      gapSize: 1,
      dashOffset: 0.5,
      worldTransformOffset: 0,
      boundsIndex: 0,
      layerMask: 1,
      sortKey: {
        queue: "transparent",
        viewId: 0,
        layer: 1,
        order: 0,
        pipelineKey: "fat-line",
        materialKey: "fat-line",
        meshKey: "fat-line-segment",
        depth: 0,
        stableId: 7,
      },
    };
    const snapshot = {
      transforms: Float32Array.from(translation(10, 0, 0)),
      lineVertices: Float32Array.from([0, 0, 0, 3, 0, 0, 3, 4, 0]),
    } as unknown as RenderSnapshot;

    const packed = packLineSegmentInstances(snapshot, [line]);

    expect(packed.segmentCount).toBe(2);
    expect(packed.data.length).toBe(2 * LINE_SEGMENT_FLOAT_STRIDE);
    expect(packed.batches).toHaveLength(1);
    expect(packed.batches[0]).toMatchObject({
      renderId: 7,
      firstInstance: 0,
      instanceCount: 2,
    });

    // First segment: p0 world = (10,0,0) with arc length 0; p1 world = (13,0,0)
    // with arc length 3.
    expect(packed.data[0]).toBeCloseTo(10, 5);
    expect(packed.data[3]).toBeCloseTo(0, 5);
    expect(packed.data[4]).toBeCloseTo(13, 5);
    expect(packed.data[7]).toBeCloseTo(3, 5);
    // Params: width, dashSize, gapSize, dashOffset.
    expect(packed.data[16]).toBe(8);
    expect(packed.data[17]).toBe(2);
    expect(packed.data[18]).toBe(1);
    expect(packed.data[19]).toBe(0.5);

    // Second segment arc length end = 3 + 4 = 7 (world-continuous).
    expect(packed.data[LINE_SEGMENT_FLOAT_STRIDE + 7]).toBeCloseTo(7, 5);
  });
});

describe("E1 point instance packing", () => {
  it("packs one instance per point with world position, per-point color, and flags", () => {
    const cloud: PointsPacket = {
      renderId: 3,
      entity: { index: 2, generation: 0 },
      vertexOffset: 0,
      vertexCount: 2,
      color: [1, 1, 1, 1],
      size: 6,
      sizeAttenuation: true,
      round: false,
      worldTransformOffset: 0,
      boundsIndex: 0,
      layerMask: 1,
      sortKey: {
        queue: "transparent",
        viewId: 0,
        layer: 1,
        order: 0,
        pipelineKey: "point-cloud",
        materialKey: "point-cloud",
        meshKey: "point-quad",
        depth: 0,
        stableId: 3,
      },
    };
    const snapshot = {
      transforms: Float32Array.from(translation(0, 5, 0)),
      pointVertices: Float32Array.from([0, 0, 0, 1, 0, 0]),
      pointColors: Float32Array.from([1, 0, 0, 1, 0, 1, 0, 1]),
    } as unknown as RenderSnapshot;

    const packed = packPointInstances(snapshot, [cloud]);

    expect(packed.pointCount).toBe(2);
    expect(packed.data.length).toBe(2 * POINT_INSTANCE_FLOAT_STRIDE);
    // Point 0 world = (0,5,0), size 6, red.
    expect(packed.data[0]).toBeCloseTo(0, 5);
    expect(packed.data[1]).toBeCloseTo(5, 5);
    expect(packed.data[3]).toBe(6);
    expect(Array.from(packed.data.slice(4, 8))).toEqual([1, 0, 0, 1]);
    // Params: attenuation flag 1, round flag 0 (square).
    expect(packed.data[8]).toBe(1);
    expect(packed.data[9]).toBe(0);
    // Point 1 world = (1,5,0), green.
    expect(packed.data[POINT_INSTANCE_FLOAT_STRIDE]).toBeCloseTo(1, 5);
    expect(
      Array.from(
        packed.data.slice(
          POINT_INSTANCE_FLOAT_STRIDE + 4,
          POINT_INSTANCE_FLOAT_STRIDE + 8,
        ),
      ),
    ).toEqual([0, 1, 0, 1]);
  });
});

describe("E1 flat-matrix point transform", () => {
  it("applies a column-major mat4 translation", () => {
    expect(transformPointByFlatMatrix(IDENTITY, 0, 2, 3, 4)).toEqual([2, 3, 4]);
    expect(
      transformPointByFlatMatrix(
        Float32Array.from(translation(1, 2, 3)),
        0,
        0,
        0,
        0,
      ),
    ).toEqual([1, 2, 3]);
  });
});
