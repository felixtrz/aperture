import { describe, expect, it } from "vitest";

import {
  compileFrameGraph,
  createFrameGraphHistoryResource,
  createFrameGraph,
} from "@aperture-engine/webgpu/test-support";

// M3-T6 Done-when #1 + #4: a double-buffered history resource carries the TAA
// color history across frames — this frame's 'current' write becomes next
// frame's 'previous' read, current() and previous() are never the same physical
// buffer (no read-write aliasing), and the pool stays exactly two textures over
// N frames (no leaks).

describe("frame graph history resource (M3-T6)", () => {
  it("resolves previous() to the prior frame's written buffer, distinct from current()", () => {
    const a = { id: "buffer-A" };
    const b = { id: "buffer-B" };
    const history = createFrameGraphHistoryResource(a, b);

    // frame 0: write current; no real previous yet
    expect(history.current()).toBe(a);
    expect(history.hasPrevious()).toBe(false);
    expect(history.current()).not.toBe(history.previous());
    history.swap();

    // frame 1: current is the OTHER buffer; previous is frame 0's write (a)
    expect(history.current()).toBe(b);
    expect(history.previous()).toBe(a);
    expect(history.hasPrevious()).toBe(true);
    expect(history.current()).not.toBe(history.previous());
    history.swap();

    // frame 2: buffers swap back; previous is frame 1's write (b)
    expect(history.current()).toBe(a);
    expect(history.previous()).toBe(b);
    expect(history.current()).not.toBe(history.previous());
  });

  it("keeps the pool at exactly two buffers across many frames (no leaks)", () => {
    const a = { id: "A" };
    const b = { id: "B" };
    const history = createFrameGraphHistoryResource(a, b);
    const seen = new Set<unknown>();

    for (let frame = 0; frame < 10; frame += 1) {
      seen.add(history.current());
      seen.add(history.previous());
      // current is always one of the two backing buffers, never a fresh alloc
      expect(history.buffers).toContain(history.current());
      expect(history.buffers).toContain(history.previous());
      history.swap();
    }

    expect(seen.size).toBe(2);
    expect(history.buffers).toHaveLength(2);
    expect(history.swapCount).toBe(10);
  });

  it("integrates with declareHistory: a history-texture handle is double-buffered", () => {
    const graph = createFrameGraph();
    const handle = graph.declareHistory("taa-history", {
      width: 8,
      height: 8,
      format: "rgba16float",
      sampleCount: 1,
    });

    expect(handle.descriptor.kind).toBe("history-texture");
    expect(handle.descriptor.history).toBe(true);
    expect(handle.descriptor.lifetime).toBe("persistent");
    // the same handle id is resolvable from the graph
    expect(graph.handle("taa-history")).toBe(handle);
  });

  it("compiles two consecutive frames: the TAA node's history 'previous' read resolves to frame N-1's 'current' write, a distinct physical buffer", () => {
    const bufferA = { id: "history-A" };
    const bufferB = { id: "history-B" };
    const pool = createFrameGraphHistoryResource(bufferA, bufferB);
    const colorDesc = {
      kind: "color-texture" as const,
      width: 8,
      height: 8,
      format: "rgba16float",
      sampleCount: 1,
    };

    // A frame: scene → taa (reads scene-color, writes the history 'current'
    // handle) → present (reads the history handle, writes the swapchain).
    const compileFrame = () => {
      const graph = createFrameGraph();
      graph.importSwapchain();
      graph.declareTransient("scene-color", colorDesc);
      graph.declareHistory("taa-history", {
        width: 8,
        height: 8,
        format: "rgba16float",
        sampleCount: 1,
      });
      graph.addRenderPass({
        name: "scene",
        reads: [],
        writes: [{ handle: "scene-color", attachment: "clear" }],
        commands: [],
      });
      graph.addRenderPass({
        name: "taa",
        reads: ["scene-color"],
        writes: [{ handle: "taa-history", attachment: "clear" }],
        commands: [],
      });
      graph.addRenderPass({
        name: "present",
        reads: ["taa-history"],
        writes: [{ handle: "swapchain", attachment: "clear" }],
        commands: [],
      });
      return compileFrameGraph(graph);
    };

    // ---- frame 0 ----
    const frame0 = compileFrame();
    expect(frame0.ok).toBe(true);
    // dependency-driven order: the history producer (taa) runs after the scene
    // it reads and before the present that consumes it.
    expect(frame0.orderedNodes.map((node) => node.name)).toEqual([
      "scene",
      "taa",
      "present",
    ]);
    const current0 = pool.current(); // frame 0's history write target
    expect(pool.hasPrevious()).toBe(false); // nothing to read on the first frame
    expect(pool.current()).not.toBe(pool.previous());
    pool.swap(); // end-of-frame swap

    // ---- frame 1 ----
    const frame1 = compileFrame();
    expect(frame1.ok).toBe(true);
    expect(frame1.orderedNodes.map((node) => node.name)).toEqual([
      "scene",
      "taa",
      "present",
    ]);
    // the 'previous' read resolves to frame 0's 'current' write...
    expect(pool.previous()).toBe(current0);
    // ...and the 'current' write targets a DIFFERENT physical buffer (no
    // read-write aliasing of one texture within the frame).
    expect(pool.current()).not.toBe(pool.previous());
    expect(pool.current()).not.toBe(current0);

    // the history handle survives compilation as the taa node's write target
    const taaNode = frame1.orderedNodes.find((node) => node.name === "taa");
    expect(taaNode?.writes[0]?.handle).toBe("taa-history");
    // and the persistent history buffer is never aliased into the per-frame
    // transient pool (only transient handles alias), so it carries across frames
    const historyAlias = frame1.aliasing.find(
      (assignment) => assignment.handle === "taa-history",
    );
    expect(historyAlias?.aliasedFrom ?? null).toBeNull();
  });
});
