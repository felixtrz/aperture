import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type LayoutEngine,
  type LayoutHandle,
  type LayoutStyle,
  type MeasureFn,
} from "@aperture-engine/ui";
import { createTestLayoutEngine } from "@aperture-engine/ui/test-support";

let engine: LayoutEngine;

beforeEach(async () => {
  engine = await createTestLayoutEngine();
});

afterEach(() => {
  engine.dispose();
});

function node(style: LayoutStyle, measure?: MeasureFn): LayoutHandle {
  const handle = engine.createNode();
  engine.setStyle(handle, style);
  if (measure) {
    engine.setMeasure(handle, measure);
  }
  return handle;
}

function tree(
  root: LayoutHandle,
  children: readonly LayoutHandle[],
): LayoutHandle {
  children.forEach((child, index) => engine.insertChild(root, child, index));
  return root;
}

function rect(handle: LayoutHandle): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const r = engine.getComputed(handle);
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

describe("Yoga LayoutEngine — sizing", () => {
  it("uses explicit width/height", () => {
    const root = node({ width: 200, height: 100 });
    engine.calculate(root, undefined, undefined);
    expect(rect(root)).toEqual({ left: 0, top: 0, width: 200, height: 100 });
  });

  it("resolves percentage sizing against the parent", () => {
    const child = node({ width: "50%", height: "25%" });
    const root = tree(node({ width: 400, height: 200 }), [child]);
    engine.calculate(root, undefined, undefined);
    expect(rect(child)).toMatchObject({ width: 200, height: 50 });
  });

  it("applies an aspect ratio", () => {
    const child = node({ width: 120, aspectRatio: 2 });
    const root = tree(node({ width: 400, height: 400 }), [child]);
    engine.calculate(root, undefined, undefined);
    expect(rect(child)).toMatchObject({ width: 120, height: 60 });
  });

  it("clamps to min/max width", () => {
    const child = node({ width: "100%", maxWidth: 150, minHeight: 40 });
    const root = tree(node({ width: 400, height: 400 }), [child]);
    engine.calculate(root, undefined, undefined);
    expect(rect(child)).toMatchObject({ width: 150, height: 40 });
  });
});

describe("Yoga LayoutEngine — flow & flex", () => {
  it("stacks children in a column by default", () => {
    const a = node({ height: 30 });
    const b = node({ height: 30 });
    const root = tree(node({ width: 100, height: 200 }), [a, b]);
    engine.calculate(root, undefined, undefined);
    expect(rect(a).top).toBe(0);
    expect(rect(b).top).toBe(30);
  });

  it("lays out a row with a gap", () => {
    const a = node({ width: 40, height: 20 });
    const b = node({ width: 40, height: 20 });
    const root = tree(
      node({ flexDirection: "row", gap: 10, width: 200, height: 50 }),
      [a, b],
    );
    engine.calculate(root, undefined, undefined);
    expect(rect(a).left).toBe(0);
    expect(rect(b).left).toBe(50);
  });

  it("distributes remaining space with flexGrow", () => {
    const a = node({ flexGrow: 1, height: 20 });
    const b = node({ flexGrow: 2, height: 20 });
    const root = tree(node({ flexDirection: "row", width: 300, height: 50 }), [
      a,
      b,
    ]);
    engine.calculate(root, undefined, undefined);
    expect(rect(a).width).toBe(100);
    expect(rect(b).width).toBe(200);
  });

  it("shrinks over-sized children with flexShrink", () => {
    const a = node({ width: 200, flexShrink: 1, height: 20 });
    const b = node({ width: 200, flexShrink: 1, height: 20 });
    const root = tree(node({ flexDirection: "row", width: 200, height: 50 }), [
      a,
      b,
    ]);
    engine.calculate(root, undefined, undefined);
    expect(rect(a).width).toBe(100);
    expect(rect(b).width).toBe(100);
  });

  it("centers with justifyContent + alignItems", () => {
    const child = node({ width: 40, height: 40 });
    const root = tree(
      node({
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        width: 200,
        height: 200,
      }),
      [child],
    );
    engine.calculate(root, undefined, undefined);
    expect(rect(child)).toMatchObject({ left: 80, top: 80 });
  });

  it("wraps children onto multiple lines", () => {
    const children = [40, 40, 40].map((w) => node({ width: w, height: 20 }));
    const root = tree(
      node({ flexDirection: "row", flexWrap: "wrap", width: 100, height: 100 }),
      children,
    );
    engine.calculate(root, undefined, undefined);
    // Two fit on the first line (0, 40); the third wraps to the next row.
    expect(rect(children[2]!).top).toBe(20);
    expect(rect(children[2]!).left).toBe(0);
  });
});

describe("Yoga LayoutEngine — box model", () => {
  it("insets children by padding", () => {
    const child = node({ flexGrow: 1, alignSelf: "stretch" });
    const root = tree(node({ width: 100, height: 100, padding: 10 }), [child]);
    engine.calculate(root, undefined, undefined);
    expect(rect(child)).toMatchObject({
      left: 10,
      top: 10,
      width: 80,
      height: 80,
    });
    const computed = engine.getComputed(root);
    expect(computed.paddingLeft).toBe(10);
    expect(computed.paddingTop).toBe(10);
  });

  it("offsets siblings by margin", () => {
    const a = node({ height: 20, marginTop: 15 });
    const root = tree(node({ width: 100, height: 200 }), [a]);
    engine.calculate(root, undefined, undefined);
    expect(rect(a).top).toBe(15);
  });

  it("positions absolute children by inset", () => {
    const child = node({
      positionType: "absolute",
      top: 25,
      left: 35,
      width: 10,
      height: 10,
    });
    const root = tree(node({ width: 200, height: 200 }), [child]);
    engine.calculate(root, undefined, undefined);
    expect(rect(child)).toMatchObject({ left: 35, top: 25 });
  });

  it("exposes computed border insets", () => {
    const root = node({ width: 100, height: 100, border: 4 });
    engine.calculate(root, undefined, undefined);
    const computed = engine.getComputed(root);
    expect(computed.borderLeft).toBe(4);
    expect(computed.borderBottom).toBe(4);
  });
});

describe("Yoga LayoutEngine — measure functions", () => {
  it("sizes a leaf from its measure function", () => {
    const measured = node({}, () => ({ width: 64, height: 18 }));
    const root = tree(
      node({ width: 200, height: 200, alignItems: "flex-start" }),
      [measured],
    );
    engine.calculate(root, undefined, undefined);
    expect(rect(measured)).toMatchObject({ width: 64, height: 18 });
  });

  it("passes available width and constraint mode to the measure function", () => {
    const seen: { width: number; mode: string }[] = [];
    const measured = node({ alignSelf: "stretch" }, (width, widthMode) => {
      seen.push({ width, mode: widthMode });
      return { width: Math.min(width, 50), height: 10 };
    });
    const root = tree(node({ width: 120, height: 100 }), [measured]);
    engine.calculate(root, undefined, undefined);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((s) => s.width === 120)).toBe(true);
  });
});
