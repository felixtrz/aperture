import { describe, expect, it } from "vitest";

import {
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
});
