import type { ComputedRect, LayoutStyle, MeasureFn } from "./types.js";

/**
 * Opaque handle to a node owned by a {@link LayoutEngine}. Callers treat it as a
 * token; the engine maps it back to its internal representation.
 */
export interface LayoutHandle {
  readonly id: number;
}

/**
 * Engine-neutral layout port. The default implementation is Yoga-backed
 * ({@link createYogaLayoutEngine}); the interface keeps a future Taffy adapter
 * swappable.
 *
 * Nodes are retained across frames — create them once, mutate style on change,
 * and call {@link LayoutEngine.calculate} only when something is dirty. This is
 * what enables incremental relayout and the freeze feature.
 */
export interface LayoutEngine {
  /** Create a detached node. */
  createNode(): LayoutHandle;
  /** Apply a complete style; unset fields reset to the engine defaults. */
  setStyle(handle: LayoutHandle, style: LayoutStyle): void;
  /** Attach (or clear) a leaf measure function (text, images, embedded 3D). */
  setMeasure(handle: LayoutHandle, measure: MeasureFn | null): void;
  /** Insert `child` into `parent` at `index`. */
  insertChild(parent: LayoutHandle, child: LayoutHandle, index: number): void;
  /** Detach `child` from `parent` (does not free it). */
  removeChild(parent: LayoutHandle, child: LayoutHandle): void;
  /** Number of children attached to `handle`. */
  childCount(handle: LayoutHandle): number;
  /** Mark a measure leaf dirty after its content changed. */
  markDirty(handle: LayoutHandle): void;
  /** Whether `handle` (or a descendant) needs relayout. */
  isDirty(handle: LayoutHandle): boolean;
  /**
   * Compute layout for the tree rooted at `handle` within the available space.
   * `undefined` leaves an axis unconstrained. A clean tree with unchanged
   * available space is an ~O(1) no-op.
   */
  calculate(
    handle: LayoutHandle,
    availableWidth: number | "auto" | undefined,
    availableHeight: number | "auto" | undefined,
  ): void;
  /** Read the computed layout of `handle`, relative to its parent border box. */
  getComputed(handle: LayoutHandle): ComputedRect;
  /** Free a single node's native memory. */
  free(handle: LayoutHandle): void;
  /** Free a node and all of its descendants. */
  freeRecursive(handle: LayoutHandle): void;
  /** Release engine-level resources (the shared config). */
  dispose(): void;
}

/** Options for {@link createYogaLayoutEngine}. */
export interface LayoutEngineOptions {
  /**
   * Pixel grid for rounding computed layout. `1` (default) rounds to whole
   * pixels for crisp, deterministic, integer hit rects. Use a higher factor
   * (e.g. `100`) for sub-pixel layout if needed.
   */
  readonly pointScaleFactor?: number;
}
