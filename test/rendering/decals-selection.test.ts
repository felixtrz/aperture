import { describe, expect, it } from "vitest";

import { selectRenderedDecals } from "@aperture-engine/render";

// D4: the decal cap + eviction policy in isolation. Oldest-first (ring-buffer)
// eviction keyed on `sequence`, capacity floored at 1, deterministic ties.
describe("decal cap + eviction (selectRenderedDecals)", () => {
  it("keeps every decal when the count is at or below the cap", () => {
    const records = [
      { sequence: 1, id: "a" },
      { sequence: 2, id: "b" },
    ];

    const result = selectRenderedDecals(records, 6);

    expect(result.evicted).toBe(0);
    expect(result.rendered.map((record) => record.id)).toEqual(["a", "b"]);
  });

  it("evicts the oldest decals first when the cap is exceeded", () => {
    const records = Array.from({ length: 12 }, (_unused, index) => ({
      sequence: index + 1,
      id: `d${index + 1}`,
    }));

    const result = selectRenderedDecals(records, 6);

    // Newest 6 (sequences 7..12) survive; oldest 6 evicted.
    expect(result.evicted).toBe(6);
    expect(result.rendered.map((record) => record.sequence)).toEqual([
      7, 8, 9, 10, 11, 12,
    ]);
  });

  it("the Nth decal past a full ring evicts exactly the oldest", () => {
    const records = [
      { sequence: 10, id: "x" },
      { sequence: 20, id: "y" },
      { sequence: 30, id: "z" },
      { sequence: 40, id: "w" },
    ];

    const result = selectRenderedDecals(records, 3);

    expect(result.evicted).toBe(1);
    expect(result.rendered.map((record) => record.id)).toEqual(["y", "z", "w"]);
  });

  it("orders by sequence regardless of input order, breaking ties stably", () => {
    const records = [
      { sequence: 30, id: "c" },
      { sequence: 10, id: "a" },
      { sequence: 20, id: "b" },
      { sequence: 10, id: "a2" },
    ];

    const result = selectRenderedDecals(records, 2);

    // Sorted (sequence, input index): a, a2, b, c → newest 2 = b, c.
    expect(result.rendered.map((record) => record.id)).toEqual(["b", "c"]);
    expect(result.evicted).toBe(2);
  });

  it("floors a non-positive cap at 1", () => {
    const records = [
      { sequence: 1, id: "a" },
      { sequence: 2, id: "b" },
    ];

    const result = selectRenderedDecals(records, 0);

    expect(result.rendered.map((record) => record.id)).toEqual(["b"]);
    expect(result.evicted).toBe(1);
  });
});
