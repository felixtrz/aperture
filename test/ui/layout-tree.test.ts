import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  UiLayoutTree,
  type LayoutEngine,
  type LayoutStyle,
  type UiLayoutNodeInput,
} from "@aperture-engine/ui";
import { createTestLayoutEngine } from "@aperture-engine/ui/test-support";

let engine: LayoutEngine;

beforeEach(async () => {
  engine = await createTestLayoutEngine();
});

afterEach(() => {
  engine.dispose();
});

type NodeSpec = {
  style: LayoutStyle;
  children?: string[];
  frozen?: boolean;
  measureKey?: string | number;
  measure?: UiLayoutNodeInput<string>["measure"];
};

function makeResolver(
  nodes: Record<string, NodeSpec>,
): (key: string) => UiLayoutNodeInput<string> {
  return (key) => {
    const spec = nodes[key];
    if (spec === undefined) {
      throw new Error(`unknown node ${key}`);
    }
    return {
      style: spec.style,
      children: spec.children ?? [],
      ...(spec.frozen === undefined ? {} : { frozen: spec.frozen }),
      ...(spec.measureKey === undefined ? {} : { measureKey: spec.measureKey }),
      ...(spec.measure === undefined ? {} : { measure: spec.measure }),
    };
  };
}

describe("UiLayoutTree — reconcile & absolute rects", () => {
  it("computes absolute positions accumulated through ancestors", () => {
    const tree = new UiLayoutTree<string>(engine);
    const nodes: Record<string, NodeSpec> = {
      root: {
        style: { width: 300, height: 200, padding: 20 },
        children: ["a"],
      },
      a: {
        style: { flexDirection: "row", gap: 10, height: 40 },
        children: ["b", "c"],
      },
      b: { style: { width: 50, height: 40 } },
      c: { style: { width: 50, height: 40 } },
    };
    tree.reconcile(["root"], makeResolver(nodes));
    tree.calculate("root", undefined, undefined);

    // root content box starts at padding (20,20); row children flow from there.
    expect(tree.absoluteRect("a")).toMatchObject({ left: 20, top: 20 });
    expect(tree.absoluteRect("b")).toMatchObject({ left: 20, top: 20 });
    expect(tree.absoluteRect("c")).toMatchObject({ left: 80, top: 20 });
    tree.dispose();
  });

  it("honors an origin offset for the root", () => {
    const tree = new UiLayoutTree<string>(engine);
    tree.reconcile(
      ["root"],
      makeResolver({ root: { style: { width: 10, height: 10 } } }),
    );
    tree.calculate("root", undefined, undefined, 100, 50);
    expect(tree.absoluteRect("root")).toMatchObject({ left: 100, top: 50 });
    tree.dispose();
  });
});

describe("UiLayoutTree — pruning & reparenting", () => {
  it("frees nodes that disappear between frames", () => {
    const tree = new UiLayoutTree<string>(engine);
    tree.reconcile(
      ["root"],
      makeResolver({
        root: { style: { width: 100, height: 100 }, children: ["a", "b"] },
        a: { style: { height: 20 } },
        b: { style: { height: 20 } },
      }),
    );
    expect(tree.size).toBe(3);

    tree.reconcile(
      ["root"],
      makeResolver({
        root: { style: { width: 100, height: 100 }, children: ["a"] },
        a: { style: { height: 20 } },
      }),
    );
    expect(tree.size).toBe(2);
    expect(tree.has("b")).toBe(false);
    tree.dispose();
  });

  it("moves a child to a new parent", () => {
    const tree = new UiLayoutTree<string>(engine);
    const build = (childUnder: "a" | "b"): Record<string, NodeSpec> => ({
      root: {
        style: { flexDirection: "row", width: 200, height: 100 },
        children: ["a", "b"],
      },
      a: {
        style: { width: 100, height: 100 },
        children: childUnder === "a" ? ["x"] : [],
      },
      b: {
        style: { width: 100, height: 100 },
        children: childUnder === "b" ? ["x"] : [],
      },
      x: { style: { width: 10, height: 10 } },
    });

    tree.reconcile(["root"], makeResolver(build("a")));
    tree.calculate("root", undefined, undefined);
    expect(tree.absoluteRect("x").left).toBe(0);

    tree.reconcile(["root"], makeResolver(build("b")));
    tree.calculate("root", undefined, undefined);
    expect(tree.absoluteRect("x").left).toBe(100);
    tree.dispose();
  });
});

describe("UiLayoutTree — freeze", () => {
  it("preserves a frozen subtree's layout across reconciles", () => {
    const tree = new UiLayoutTree<string>(engine);
    tree.reconcile(
      ["root"],
      makeResolver({
        root: { style: { width: 200, height: 200 }, children: ["panel"] },
        panel: { style: { width: 80, height: 80 }, children: ["label"] },
        label: { style: { width: 40, height: 20 } },
      }),
    );
    tree.calculate("root", undefined, undefined);
    const frozenLabel = tree.absoluteRect("label");

    // Freeze the panel and feed wildly different child styles. They must be
    // ignored while frozen, and the subtree must remain alive (not pruned).
    tree.reconcile(
      ["root"],
      makeResolver({
        root: { style: { width: 200, height: 200 }, children: ["panel"] },
        panel: {
          style: { width: 999, height: 999 },
          children: ["label"],
          frozen: true,
        },
        label: { style: { width: 999, height: 999 } },
      }),
    );
    tree.calculate("root", undefined, undefined);
    expect(tree.has("label")).toBe(true);
    expect(tree.absoluteRect("label")).toEqual(frozenLabel);
    expect(tree.absoluteRect("panel")).toMatchObject({ width: 80, height: 80 });
    tree.dispose();
  });

  it("applies pending changes once unfrozen", () => {
    const tree = new UiLayoutTree<string>(engine);
    const frozen = (isFrozen: boolean): Record<string, NodeSpec> => ({
      root: { style: { width: 200, height: 200 }, children: ["panel"] },
      panel: { style: { width: 120, height: 60 }, frozen: isFrozen },
    });
    tree.reconcile(["root"], makeResolver(frozen(false)));
    tree.calculate("root", undefined, undefined);
    tree.reconcile(["root"], makeResolver(frozen(true)));
    tree.calculate("root", undefined, undefined);
    tree.reconcile(["root"], makeResolver(frozen(false)));
    tree.calculate("root", undefined, undefined);
    expect(tree.absoluteRect("panel")).toMatchObject({
      width: 120,
      height: 60,
    });
    tree.dispose();
  });
});

describe("UiLayoutTree — measure", () => {
  it("re-measures only when the measure key changes", () => {
    const tree = new UiLayoutTree<string>(engine);
    let measureCalls = 0;
    let measuredWidth = 30;
    const resolver = (
      key: string,
      measureKey: number,
    ): UiLayoutNodeInput<string> => {
      if (key === "root") {
        return { style: { width: 200, height: 200 }, children: ["text"] };
      }
      return {
        style: { alignSelf: "flex-start" },
        children: [],
        measureKey,
        measure: () => {
          measureCalls += 1;
          return { width: measuredWidth, height: 16 };
        },
      };
    };

    tree.reconcile(["root"], (k) => resolver(k, 1));
    tree.calculate("root", undefined, undefined);
    const firstCalls = measureCalls;
    expect(firstCalls).toBeGreaterThan(0);
    expect(tree.absoluteRect("text").width).toBe(30);

    // Same measure key → Yoga reuses the cached measurement (no recompute).
    tree.reconcile(["root"], (k) => resolver(k, 1));
    tree.calculate("root", undefined, undefined);
    expect(measureCalls).toBe(firstCalls);

    // Bumping the key forces a re-measure with the new content size.
    measuredWidth = 90;
    tree.reconcile(["root"], (k) => resolver(k, 2));
    tree.calculate("root", undefined, undefined);
    expect(measureCalls).toBeGreaterThan(firstCalls);
    expect(tree.absoluteRect("text").width).toBe(90);
    tree.dispose();
  });
});
