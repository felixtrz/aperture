import { describe, expect, it } from "vitest";

import {
  AssetRegistry,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  type EcsWorld,
} from "@aperture-engine/simulation";
import {
  createConfiguredDebugDrawAccumulator,
  createDebugDrawAccumulator,
  extractRenderSnapshot,
  getDebugDrawAccumulator,
  installDebugDrawAccumulator,
  NOOP_DEBUG_DRAW,
  registerRenderAuthoringComponents,
} from "@aperture-engine/render";

function createRenderWorld(): EcsWorld {
  const world = createWorld({ entityCapacity: 16 });
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}

describe("E3 debug-draw accumulator", () => {
  it("counts primitives and segments and packs world-space segments", () => {
    const debug = createDebugDrawAccumulator();
    debug.aabb([-1, -1, -1], [1, 1, 1]); // 12 segments
    debug.axes([0, 0, 0], 1); // 3 segments
    debug.line([0, 0, 0], [1, 0, 0], [1, 0, 0, 1]); // 1 segment

    expect(debug.primitiveCount).toBe(3);
    expect(debug.segmentCount).toBe(16);

    const frame = debug.drain();
    expect(frame).not.toBeNull();
    expect(frame?.report).toEqual({
      primitives: 3,
      segments: 16,
      vertices: 32,
    });
    expect(frame?.debugLines?.segmentCount).toBe(16);
    expect(frame?.debugLines?.positions).toHaveLength(16 * 6);
    expect(frame?.debugLines?.colors).toHaveLength(16 * 4);
    expect(frame?.debugLines?.widths).toHaveLength(16);

    // The explicit line segment is packed with its color.
    const positions = frame?.debugLines?.positions as Float32Array;
    const colors = frame?.debugLines?.colors as Float32Array;
    // Last segment (index 15) is the line() call.
    expect(Array.from(positions.slice(15 * 6, 15 * 6 + 6))).toEqual([
      0, 0, 0, 1, 0, 0,
    ]);
    expect(Array.from(colors.slice(15 * 4, 15 * 4 + 4))).toEqual([1, 0, 0, 1]);
  });

  it("clears after drain so frame N does not leak into frame N+1", () => {
    const debug = createDebugDrawAccumulator();
    debug.aabb([-1, -1, -1], [1, 1, 1]);
    const first = debug.drain();
    expect(first?.report.segments).toBe(12);

    // Nothing drawn in the next frame -> drain returns null and stays empty.
    expect(debug.segmentCount).toBe(0);
    expect(debug.primitiveCount).toBe(0);
    expect(debug.drain()).toBeNull();

    debug.sphere([0, 0, 0], 1, undefined, { segments: 8 });
    const third = debug.drain();
    expect(third?.report.segments).toBe(24); // only this frame's sphere
  });

  it("is a byte-identical no-op when disabled", () => {
    expect(NOOP_DEBUG_DRAW.enabled).toBe(false);
    NOOP_DEBUG_DRAW.aabb([-1, -1, -1], [1, 1, 1]);
    NOOP_DEBUG_DRAW.sphere([0, 0, 0], 1);
    NOOP_DEBUG_DRAW.line([0, 0, 0], [1, 1, 1]);
    expect(NOOP_DEBUG_DRAW.primitiveCount).toBe(0);
    expect(NOOP_DEBUG_DRAW.segmentCount).toBe(0);
    expect(NOOP_DEBUG_DRAW.drain()).toBeNull();

    const disabled = createConfiguredDebugDrawAccumulator(false);
    expect(disabled).toBe(NOOP_DEBUG_DRAW);
    const enabled = createConfiguredDebugDrawAccumulator(true);
    expect(enabled.enabled).toBe(true);
  });

  it("skips degenerate primitives with a structured diagnostic (no throw)", () => {
    const debug = createDebugDrawAccumulator();
    debug.line([0, 0, 0], [Number.NaN, 0, 0]);
    const frame = debug.drain();
    expect(frame).not.toBeNull();
    // The one primitive is counted, but the non-finite segment is dropped.
    expect(frame?.report.primitives).toBe(1);
    expect(frame?.report.segments).toBe(0);
    expect(frame?.debugLines).toBeUndefined();
    expect(frame?.diagnostics.map((d) => d.code)).toContain(
      "render.debugDraw.degeneratePrimitive",
    );
  });

  it("routes physics debug geometry through the same overlay path", () => {
    const debug = createDebugDrawAccumulator();
    debug.physics({
      lines: [
        { from: [0, 0, 0], to: [1, 0, 0], color: [1, 0.5, 0, 1] },
        { from: [1, 0, 0], to: [1, 1, 0], color: [1, 0.5, 0, 1] },
      ],
    });
    const frame = debug.drain();
    expect(frame?.report.primitives).toBe(1);
    expect(frame?.report.segments).toBe(2);
    expect(frame?.debugLines?.segmentCount).toBe(2);
  });
});

describe("E3 debug-draw extraction fold", () => {
  it("omits the family and report field when no debug primitives are drawn", () => {
    const world = createRenderWorld();
    installDebugDrawAccumulator(world, createDebugDrawAccumulator());
    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });
    expect(snapshot.debugLines).toBeUndefined();
    expect(snapshot.report.debugDraw).toBeUndefined();
  });

  it("is byte-identical whether an empty enabled or a disabled accumulator is installed", () => {
    const enabledWorld = createRenderWorld();
    installDebugDrawAccumulator(enabledWorld, createDebugDrawAccumulator());
    const enabled = extractRenderSnapshot(enabledWorld, new AssetRegistry(), {
      frame: 5,
    });

    const disabledWorld = createRenderWorld();
    installDebugDrawAccumulator(disabledWorld, NOOP_DEBUG_DRAW);
    const disabled = extractRenderSnapshot(disabledWorld, new AssetRegistry(), {
      frame: 5,
    });

    expect(JSON.stringify(enabled)).toEqual(JSON.stringify(disabled));
    expect(enabled.debugLines).toBeUndefined();
    expect(enabled.report.debugDraw).toBeUndefined();
  });

  it("folds drawn primitives into snapshot.debugLines + report.debugDraw and drains", () => {
    const world = createRenderWorld();
    const debug = installDebugDrawAccumulator(
      world,
      createDebugDrawAccumulator(),
    );
    debug.aabb([-1, -1, -1], [1, 1, 1]);

    const first = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });
    expect(first.debugLines?.segmentCount).toBe(12);
    expect(first.report.debugDraw).toEqual({
      primitives: 1,
      segments: 12,
      vertices: 24,
    });

    // Immediate-mode: the primitive lasted one frame; the next extract is clean.
    const second = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 2,
    });
    expect(second.debugLines).toBeUndefined();
    expect(second.report.debugDraw).toBeUndefined();
  });

  it("surfaces degenerate/cap diagnostics through the snapshot diagnostics channel", () => {
    const world = createRenderWorld();
    const debug = installDebugDrawAccumulator(
      world,
      createDebugDrawAccumulator(),
    );
    debug.line([0, 0, 0], [Number.POSITIVE_INFINITY, 0, 0]);
    const snapshot = extractRenderSnapshot(world, new AssetRegistry(), {
      frame: 1,
    });
    expect(
      snapshot.diagnostics.some(
        (d) => d.code === "render.debugDraw.degeneratePrimitive",
      ),
    ).toBe(true);
    // The count in the report matches the appended diagnostics.
    expect(snapshot.report.diagnostics).toBe(snapshot.diagnostics.length);
  });

  it("getDebugDrawAccumulator returns the installed instance", () => {
    const world = createRenderWorld();
    const debug = createDebugDrawAccumulator();
    installDebugDrawAccumulator(world, debug);
    expect(getDebugDrawAccumulator(world)).toBe(debug);
  });
});
