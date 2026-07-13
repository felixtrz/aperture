import { describe, expect, it } from "vitest";

import type { Mat4 } from "@aperture-engine/simulation";
import {
  DEBUG_AXIS_COLORS,
  tessellateAabb,
  tessellateAxes,
  tessellateBones,
  tessellateBox,
  tessellateFrustum,
  tessellateGrid,
  tessellateLightGizmo,
  tessellateSphere,
  type DebugSegment,
} from "@aperture-engine/render";

function has(
  segments: readonly DebugSegment[],
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): boolean {
  const match = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
  ): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  return segments.some(
    (segment) =>
      (match(segment.from, from) && match(segment.to, to)) ||
      (match(segment.from, to) && match(segment.to, from)),
  );
}

describe("E3 debug-draw tessellation math", () => {
  it("tessellates an AABB into 12 edges over the 8 corners", () => {
    const segments = tessellateAabb([-1, -2, -3], [1, 2, 3], [1, 0, 0, 1]);
    expect(segments).toHaveLength(12);

    // Every edge connects two corners that differ in exactly one axis.
    for (const segment of segments) {
      const differing = [0, 1, 2].filter(
        (axis) => segment.from[axis] !== segment.to[axis],
      );
      expect(differing).toHaveLength(1);
      expect(segment.color).toEqual([1, 0, 0, 1]);
    }

    // The 12 canonical box edges are all present (spot-check a few corners).
    expect(has(segments, [-1, -2, -3], [1, -2, -3])).toBe(true); // bottom X edge
    expect(has(segments, [-1, -2, -3], [-1, 2, -3])).toBe(true); // vertical pillar
    expect(has(segments, [-1, 2, 3], [1, 2, 3])).toBe(true); // top far X edge

    // Exactly 8 distinct corners are referenced.
    const corners = new Set<string>();
    for (const segment of segments) {
      corners.add(segment.from.join(","));
      corners.add(segment.to.join(","));
    }
    expect(corners.size).toBe(8);
  });

  it("tessellates a center+halfExtents box identically to the min/max AABB", () => {
    const box = tessellateBox([0, 0, 0], [1, 2, 3]);
    const aabb = tessellateAabb([-1, -2, -3], [1, 2, 3]);
    expect(box).toEqual(aabb);
  });

  it("tessellates a sphere into 3 great-circle rings of the requested segment count", () => {
    const segments = tessellateSphere([0, 0, 0], 2, [0, 1, 0, 1], 16);
    // 3 rings, each a closed loop of 16 segments.
    expect(segments).toHaveLength(3 * 16);

    // Every endpoint sits on the sphere surface (radius 2 from center).
    for (const segment of segments) {
      const r0 = Math.hypot(...segment.from);
      const r1 = Math.hypot(...segment.to);
      expect(r0).toBeCloseTo(2, 6);
      expect(r1).toBeCloseTo(2, 6);
    }

    // One ring lives in each coordinate plane: check a fixed axis per ring group.
    const xyRing = segments.filter((s) => s.from[2] === 0 && s.to[2] === 0);
    const yzRing = segments.filter((s) => s.from[0] === 0 && s.to[0] === 0);
    const xzRing = segments.filter((s) => s.from[1] === 0 && s.to[1] === 0);
    expect(xyRing.length).toBe(16);
    expect(yzRing.length).toBe(16);
    expect(xzRing.length).toBe(16);
  });

  it("tessellates axes into 3 colored segments (X red, Y green, Z blue)", () => {
    const segments = tessellateAxes([5, 0, 0], 3);
    expect(segments).toHaveLength(3);
    expect(segments[0]?.from).toEqual([5, 0, 0]);
    expect(segments[0]?.to).toEqual([8, 0, 0]);
    expect(segments[0]?.color).toEqual(DEBUG_AXIS_COLORS[0]);
    expect(segments[1]?.to).toEqual([5, 3, 0]);
    expect(segments[1]?.color).toEqual(DEBUG_AXIS_COLORS[1]);
    expect(segments[2]?.to).toEqual([5, 0, 3]);
    expect(segments[2]?.color).toEqual(DEBUG_AXIS_COLORS[2]);
  });

  it("tessellates a grid into 2*(divisions+1) segments on the XZ plane", () => {
    const segments = tessellateGrid({ size: 10, divisions: 10 });
    expect(segments).toHaveLength(2 * (10 + 1));

    // Every segment lies in the plane y=0 and spans the full extent (10).
    for (const segment of segments) {
      expect(segment.from[1]).toBe(0);
      expect(segment.to[1]).toBe(0);
      const length = Math.hypot(
        segment.to[0] - segment.from[0],
        segment.to[2] - segment.from[2],
      );
      expect(length).toBeCloseTo(10, 6);
    }

    // A coarser grid scales linearly.
    expect(tessellateGrid({ divisions: 4 })).toHaveLength(2 * 5);
  });

  it("tessellates a frustum into 12 edges from an inverse view-projection", () => {
    // Identity inverse VP: NDC corners map straight to the NDC cube (z in 0..1).
    const identity = [
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ] as unknown as Mat4;
    const segments = tessellateFrustum(identity, [1, 1, 0, 1]);
    expect(segments).toHaveLength(12);

    // The near-plane loop sits at z=0, the far-plane loop at z=1.
    const nearLoop = segments.filter((s) => s.from[2] === 0 && s.to[2] === 0);
    const farLoop = segments.filter((s) => s.from[2] === 1 && s.to[2] === 1);
    const connectors = segments.filter((s) => s.from[2] !== s.to[2]);
    expect(nearLoop).toHaveLength(4);
    expect(farLoop).toHaveLength(4);
    expect(connectors).toHaveLength(4);

    // A connector runs from a near corner (z=0) to its far corner (z=1).
    expect(has(segments, [-1, -1, 0], [-1, -1, 1])).toBe(true);
  });

  it("tessellates bones into one segment per joint link", () => {
    const segments = tessellateBones(
      [
        { from: [0, 0, 0], to: [0, 1, 0] },
        { from: [0, 1, 0], to: [0, 2, 0] },
      ],
      [1, 1, 1, 1],
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]?.from).toEqual([0, 0, 0]);
    expect(segments[1]?.to).toEqual([0, 2, 0]);
  });

  it("tessellates a light gizmo as axes plus an optional aim ray", () => {
    const withoutRay = tessellateLightGizmo({ position: [1, 2, 3], size: 1 });
    expect(withoutRay).toHaveLength(3);

    const withRay = tessellateLightGizmo({
      position: [0, 0, 0],
      direction: [0, -1, 0],
      size: 1,
    });
    // 3 axis segments + 1 aim ray.
    expect(withRay).toHaveLength(4);
    expect(withRay[3]?.to).toEqual([0, -2, 0]);
  });
});
