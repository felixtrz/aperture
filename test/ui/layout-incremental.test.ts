import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type LayoutEngine,
  type LayoutHandle,
  type LayoutStyle,
} from "@aperture-engine/ui";
import { createTestLayoutEngine } from "@aperture-engine/ui/test-support";

let engine: LayoutEngine;

beforeEach(async () => {
  engine = await createTestLayoutEngine();
});

afterEach(() => {
  engine.dispose();
});

function node(style: LayoutStyle): LayoutHandle {
  const handle = engine.createNode();
  engine.setStyle(handle, style);
  return handle;
}

describe("incremental layout / dirty tracking", () => {
  it("reports a fresh tree as dirty and a calculated tree as clean", () => {
    const child = node({ width: 50, height: 50 });
    const root = node({ width: 100, height: 100 });
    engine.insertChild(root, child, 0);
    expect(engine.isDirty(root)).toBe(true);
    engine.calculate(root, undefined, undefined);
    expect(engine.isDirty(root)).toBe(false);
  });

  it("re-dirties when a style actually changes", () => {
    const child = node({ width: 50, height: 50 });
    const root = node({ width: 100, height: 100 });
    engine.insertChild(root, child, 0);
    engine.calculate(root, undefined, undefined);
    expect(engine.isDirty(root)).toBe(false);

    engine.setStyle(child, { width: 70, height: 50 });
    expect(engine.isDirty(root)).toBe(true);
    engine.calculate(root, undefined, undefined);
    expect(engine.getComputed(child).width).toBe(70);
  });

  it("stays clean when a style is re-applied with identical values", () => {
    const child = node({ width: 50, height: 50 });
    const root = node({ width: 100, height: 100 });
    engine.insertChild(root, child, 0);
    engine.calculate(root, undefined, undefined);
    expect(engine.isDirty(root)).toBe(false);

    // Re-applying the same values must not dirty the tree (no-op writes).
    engine.setStyle(child, { width: 50, height: 50 });
    expect(engine.isDirty(root)).toBe(false);
  });
});

describe("freeze (skip recalculation)", () => {
  it("preserves computed rects when calculate is not called after a change", () => {
    const child = node({ width: 50, height: 50 });
    const root = node({ width: 100, height: 100 });
    engine.insertChild(root, child, 0);
    engine.calculate(root, undefined, undefined);
    const frozen = engine.getComputed(child);

    // Simulate a frozen subtree: the style changes but the host skips
    // calculate(). Stored layout must persist (a pure field read).
    engine.setStyle(child, { width: 999, height: 999 });
    expect(engine.getComputed(child).width).toBe(frozen.width);
    expect(engine.getComputed(child).height).toBe(frozen.height);

    // Unfreezing (running calculate) applies the pending change.
    engine.calculate(root, undefined, undefined);
    expect(engine.getComputed(child).width).toBe(999);
  });
});

describe("determinism", () => {
  it("produces identical rects across repeated calculations", () => {
    const build = (): {
      root: LayoutHandle;
      a: LayoutHandle;
      b: LayoutHandle;
    } => {
      const a = node({ flexGrow: 1, height: 20 });
      const b = node({ flexGrow: 2, height: 20 });
      const root = node({ flexDirection: "row", width: 300, height: 50 });
      engine.insertChild(root, a, 0);
      engine.insertChild(root, b, 1);
      return { root, a, b };
    };

    const first = build();
    engine.calculate(first.root, undefined, undefined);
    const a1 = engine.getComputed(first.a);
    const b1 = engine.getComputed(first.b);

    const second = build();
    engine.calculate(second.root, undefined, undefined);
    const a2 = engine.getComputed(second.a);
    const b2 = engine.getComputed(second.b);

    expect(a2).toEqual(a1);
    expect(b2).toEqual(b1);
  });
});
