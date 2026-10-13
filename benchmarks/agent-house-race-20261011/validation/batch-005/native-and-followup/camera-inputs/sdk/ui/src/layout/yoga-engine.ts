import {
  Direction,
  Edge,
  MeasureMode as YogaMeasureMode,
} from "yoga-layout/load";
import type { Config, Node, Yoga } from "yoga-layout/load";
import {
  type LayoutEngine,
  type LayoutEngineOptions,
  type LayoutHandle,
} from "./engine.js";
import { applyStyleToYogaNode } from "./style-to-yoga.js";
import type {
  ComputedRect,
  LayoutStyle,
  MeasureFn,
  MeasureMode,
} from "./types.js";

class YogaHandle implements LayoutHandle {
  measure: MeasureFn | null = null;
  constructor(
    readonly id: number,
    readonly node: Node,
  ) {}
}

const MEASURE_MODE: Record<YogaMeasureMode, MeasureMode> = {
  [YogaMeasureMode.Undefined]: "undefined",
  [YogaMeasureMode.Exactly]: "exactly",
  [YogaMeasureMode.AtMost]: "at-most",
};

/**
 * Create a Yoga-backed {@link LayoutEngine}. Pass the module returned by
 * `loadLayoutModule()`. The engine owns one Yoga `Config`; call `dispose()` to
 * free it when the engine is discarded.
 */
export function createYogaLayoutEngine(
  yoga: Yoga,
  options: LayoutEngineOptions = {},
): LayoutEngine {
  const config: Config = yoga.Config.create();
  config.setPointScaleFactor(options.pointScaleFactor ?? 1);

  let nextId = 1;

  const asYoga = (handle: LayoutHandle): YogaHandle => handle as YogaHandle;

  return {
    createNode(): LayoutHandle {
      return new YogaHandle(nextId++, yoga.Node.createWithConfig(config));
    },

    setStyle(handle: LayoutHandle, style: LayoutStyle): void {
      applyStyleToYogaNode(asYoga(handle).node, style);
    },

    setMeasure(handle: LayoutHandle, measure: MeasureFn | null): void {
      const wrapped = asYoga(handle);
      wrapped.measure = measure;
      if (measure === null) {
        wrapped.node.setMeasureFunc(null);
        return;
      }
      wrapped.node.setMeasureFunc((width, widthMode, height, heightMode) =>
        measure(
          width,
          MEASURE_MODE[widthMode],
          height,
          MEASURE_MODE[heightMode],
        ),
      );
    },

    insertChild(
      parent: LayoutHandle,
      child: LayoutHandle,
      index: number,
    ): void {
      asYoga(parent).node.insertChild(asYoga(child).node, index);
    },

    removeChild(parent: LayoutHandle, child: LayoutHandle): void {
      asYoga(parent).node.removeChild(asYoga(child).node);
    },

    childCount(handle: LayoutHandle): number {
      return asYoga(handle).node.getChildCount();
    },

    markDirty(handle: LayoutHandle): void {
      asYoga(handle).node.markDirty();
    },

    isDirty(handle: LayoutHandle): boolean {
      return asYoga(handle).node.isDirty();
    },

    calculate(
      handle: LayoutHandle,
      availableWidth: number | "auto" | undefined,
      availableHeight: number | "auto" | undefined,
    ): void {
      asYoga(handle).node.calculateLayout(
        availableWidth,
        availableHeight,
        Direction.LTR,
      );
    },

    getComputed(handle: LayoutHandle): ComputedRect {
      const node = asYoga(handle).node;
      const layout = node.getComputedLayout();
      return {
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        paddingTop: node.getComputedPadding(Edge.Top),
        paddingRight: node.getComputedPadding(Edge.Right),
        paddingBottom: node.getComputedPadding(Edge.Bottom),
        paddingLeft: node.getComputedPadding(Edge.Left),
        borderTop: node.getComputedBorder(Edge.Top),
        borderRight: node.getComputedBorder(Edge.Right),
        borderBottom: node.getComputedBorder(Edge.Bottom),
        borderLeft: node.getComputedBorder(Edge.Left),
      };
    },

    free(handle: LayoutHandle): void {
      asYoga(handle).node.free();
    },

    freeRecursive(handle: LayoutHandle): void {
      asYoga(handle).node.freeRecursive();
    },

    dispose(): void {
      config.free();
    },
  };
}
