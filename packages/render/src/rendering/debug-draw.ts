import type {
  EcsWorld,
  Mat4,
  Vec3Like,
  Vec4Like,
} from "@aperture-engine/simulation";
import {
  tessellateAabb,
  tessellateAxes,
  tessellateBones,
  tessellateBox,
  tessellateFrustum,
  tessellateGrid,
  tessellateLightGizmo,
  tessellateSphere,
  type DebugBoneLink,
  type DebugGridOptions,
  type DebugLightGizmoOptions,
  type DebugSegment,
} from "./debug-draw-geometry.js";
import type { DebugLinesSnapshot } from "./snapshot-packet-types.js";
import type {
  DebugDrawSnapshotReport,
  RenderDiagnostic,
} from "./snapshot-diagnostic-types.js";

/**
 * World-globals key under which the per-frame debug-draw accumulator is
 * installed. Both the immediate-mode `this.debugDraw` system accessor and the
 * render extraction read the same accumulator through this key, so accumulated
 * primitives drain into exactly one snapshot family per frame.
 */
export const DEBUG_DRAW_WORLD_GLOBALS_KEY = "aperture.debugDraw";

/** Default screen-space debug line width, in pixels. */
export const DEBUG_DRAW_DEFAULT_WIDTH = 2;

/**
 * Hard per-frame segment cap. Immediate-mode draw is accumulated every frame, so
 * a runaway loop must be bounded rather than growing the buffer without limit.
 * On overflow extra segments are dropped, the `capped` report flag is set, and a
 * single structured diagnostic is emitted (never an unhandled error).
 */
export const DEBUG_DRAW_SEGMENT_CAP = 200_000;

/** Minimal physics-debug geometry shape (matches `PhysicsDebugGeometry`). */
export interface DebugDrawPhysicsGeometry {
  readonly lines: readonly {
    readonly from: Vec3Like;
    readonly to: Vec3Like;
    readonly color: Vec4Like;
  }[];
}

/**
 * Immediate-mode debug-draw API (E3). A system calls these every frame; each
 * primitive lasts exactly one frame (accumulated during the worker frame and
 * cleared after extraction). Every primitive tessellates into world-space line
 * segments rendered through the shared E1 fat-line overlay. When debug draw is
 * disabled the bound instance is a shared no-op, so every call accumulates
 * nothing and the frame stays byte-identical to one without debug draw.
 */
export interface DebugDrawApi {
  /**
   * False for the shared no-op API bound when debug draw is disabled. Systems
   * can gate expensive debug tessellation behind `if (this.debugDraw.enabled)`.
   */
  readonly enabled: boolean;
  /** A single world-space line segment. */
  line(from: Vec3Like, to: Vec3Like, color?: Vec4Like, width?: number): void;
  /** An axis-aligned box from world min/max corners (12 edges). */
  aabb(min: Vec3Like, max: Vec3Like, color?: Vec4Like, width?: number): void;
  /** An axis-aligned box from a center + half-extents (12 edges). */
  box(
    center: Vec3Like,
    halfExtents: Vec3Like,
    color?: Vec4Like,
    width?: number,
  ): void;
  /** A wireframe sphere as three great-circle rings. */
  sphere(
    center: Vec3Like,
    radius: number,
    color?: Vec4Like,
    options?: { readonly segments?: number; readonly width?: number },
  ): void;
  /** A coordinate frame (X red, Y green, Z blue) — 3 segments. */
  axes(origin: Vec3Like, size?: number, width?: number): void;
  /** A ground grid on the XZ plane. */
  grid(options?: DebugGridOptions & { readonly width?: number }): void;
  /** A camera frustum from an inverse view-projection matrix (12 edges). */
  frustum(inverseViewProjection: Mat4, color?: Vec4Like, width?: number): void;
  /** Skeleton bones — one segment per parent→child joint link. */
  bones(
    links: readonly DebugBoneLink[],
    color?: Vec4Like,
    width?: number,
  ): void;
  /** A light gizmo (coordinate frame + optional aim ray). */
  light(options: DebugLightGizmoOptions & { readonly width?: number }): void;
  /**
   * Physics debug geometry, re-plumbed onto the debug-draw overlay (AC2). Feeds
   * a `PhysicsDebugGeometry`-shaped line list through the SAME overlay route as
   * every other debug primitive — one segment per physics debug line.
   */
  physics(geometry: DebugDrawPhysicsGeometry, width?: number): void;
  /** Low-level: push already-tessellated world-space segments. */
  pushSegments(segments: readonly DebugSegment[], width?: number): void;
}

/** The per-frame drained debug-draw payload folded into the render snapshot. */
export interface DebugDrawFrame {
  readonly debugLines?: DebugLinesSnapshot;
  readonly report: DebugDrawSnapshotReport;
  readonly diagnostics: readonly RenderDiagnostic[];
}

/**
 * The immediate-mode API plus lifecycle hooks the extraction path uses to drain
 * one frame's accumulated primitives into a snapshot family.
 */
export interface DebugDrawAccumulator extends DebugDrawApi {
  /** Number of high-level primitives accumulated so far this frame. */
  readonly primitiveCount: number;
  /** Number of line segments accumulated so far this frame. */
  readonly segmentCount: number;
  /**
   * Take this frame's accumulated primitives as a snapshot family + report and
   * reset the accumulator. Returns `null` when nothing was drawn so a debug-free
   * frame emits no family, no report, and no diagnostics (byte-identity).
   */
  drain(): DebugDrawFrame | null;
  /** Discard the accumulated primitives without producing a frame. */
  clear(): void;
}

class RealDebugDrawAccumulator implements DebugDrawAccumulator {
  readonly enabled = true;

  #positions: number[] = [];
  #colors: number[] = [];
  #widths: number[] = [];
  #primitives = 0;
  #segments = 0;
  #capped = false;
  #diagnostics: RenderDiagnostic[] = [];

  get primitiveCount(): number {
    return this.#primitives;
  }

  get segmentCount(): number {
    return this.#segments;
  }

  line(from: Vec3Like, to: Vec3Like, color?: Vec4Like, width?: number): void {
    this.#emit(
      [{ from: vec3(from), to: vec3(to), color: rgba(color) }],
      width,
      "line",
    );
  }

  aabb(min: Vec3Like, max: Vec3Like, color?: Vec4Like, width?: number): void {
    this.#emit(tessellateAabb(min, max, color), width, "aabb");
  }

  box(
    center: Vec3Like,
    halfExtents: Vec3Like,
    color?: Vec4Like,
    width?: number,
  ): void {
    this.#emit(tessellateBox(center, halfExtents, color), width, "box");
  }

  sphere(
    center: Vec3Like,
    radius: number,
    color?: Vec4Like,
    options?: { readonly segments?: number; readonly width?: number },
  ): void {
    this.#emit(
      tessellateSphere(center, radius, color, options?.segments),
      options?.width,
      "sphere",
    );
  }

  axes(origin: Vec3Like, size?: number, width?: number): void {
    this.#emit(tessellateAxes(origin, size), width, "axes");
  }

  grid(options: DebugGridOptions & { readonly width?: number } = {}): void {
    this.#emit(tessellateGrid(options), options.width, "grid");
  }

  frustum(inverseViewProjection: Mat4, color?: Vec4Like, width?: number): void {
    this.#emit(
      tessellateFrustum(inverseViewProjection, color),
      width,
      "frustum",
    );
  }

  bones(
    links: readonly DebugBoneLink[],
    color?: Vec4Like,
    width?: number,
  ): void {
    this.#emit(tessellateBones(links, color), width, "bones");
  }

  light(options: DebugLightGizmoOptions & { readonly width?: number }): void {
    this.#emit(tessellateLightGizmo(options), options.width, "light");
  }

  physics(geometry: DebugDrawPhysicsGeometry, width?: number): void {
    const segments = geometry.lines.map((line) => ({
      from: vec3(line.from),
      to: vec3(line.to),
      color: rgba(line.color),
    }));
    this.#emit(segments, width, "physics");
  }

  pushSegments(segments: readonly DebugSegment[], width?: number): void {
    this.#emit(segments, width, "segments");
  }

  #emit(
    segments: readonly DebugSegment[],
    width: number | undefined,
    kind: string,
  ): void {
    const lineWidth = Math.max(0, width ?? DEBUG_DRAW_DEFAULT_WIDTH);
    this.#primitives += 1;
    let degenerate = false;

    for (const segment of segments) {
      if (!isFiniteSegment(segment)) {
        degenerate = true;
        continue;
      }

      if (this.#segments >= DEBUG_DRAW_SEGMENT_CAP) {
        if (!this.#capped) {
          this.#capped = true;
          this.#diagnostics.push({
            code: "render.debugDraw.segmentCapExceeded",
            message: `Debug-draw segment cap (${DEBUG_DRAW_SEGMENT_CAP}) exceeded; extra segments were dropped this frame.`,
            severity: "warning",
          });
        }
        return;
      }

      this.#positions.push(
        segment.from[0],
        segment.from[1],
        segment.from[2],
        segment.to[0],
        segment.to[1],
        segment.to[2],
      );
      this.#colors.push(
        segment.color[0],
        segment.color[1],
        segment.color[2],
        segment.color[3],
      );
      this.#widths.push(lineWidth);
      this.#segments += 1;
    }

    if (degenerate) {
      this.#diagnostics.push({
        code: "render.debugDraw.degeneratePrimitive",
        message: `Debug-draw '${kind}' primitive had non-finite coordinates or color; the affected segments were skipped.`,
        severity: "warning",
      });
    }
  }

  drain(): DebugDrawFrame | null {
    if (this.#primitives === 0 && this.#diagnostics.length === 0) {
      this.clear();
      return null;
    }

    const report: DebugDrawSnapshotReport = {
      primitives: this.#primitives,
      segments: this.#segments,
      vertices: this.#segments * 2,
      ...(this.#capped ? { capped: true } : {}),
    };
    const diagnostics = this.#diagnostics;
    const debugLines: DebugLinesSnapshot | undefined =
      this.#segments === 0
        ? undefined
        : {
            segmentCount: this.#segments,
            positions: new Float32Array(this.#positions),
            colors: new Float32Array(this.#colors),
            widths: new Float32Array(this.#widths),
          };

    this.clear();

    return {
      ...(debugLines === undefined ? {} : { debugLines }),
      report,
      diagnostics,
    };
  }

  clear(): void {
    this.#positions = [];
    this.#colors = [];
    this.#widths = [];
    this.#primitives = 0;
    this.#segments = 0;
    this.#capped = false;
    this.#diagnostics = [];
  }
}

class NoopDebugDrawAccumulator implements DebugDrawAccumulator {
  readonly enabled = false;
  readonly primitiveCount = 0;
  readonly segmentCount = 0;

  line(): void {}
  aabb(): void {}
  box(): void {}
  sphere(): void {}
  axes(): void {}
  grid(): void {}
  frustum(): void {}
  bones(): void {}
  light(): void {}
  physics(): void {}
  pushSegments(): void {}

  drain(): DebugDrawFrame | null {
    return null;
  }

  clear(): void {}
}

/**
 * Shared no-op accumulator used whenever debug draw is disabled. A single frozen
 * instance so `this.debugDraw.*` calls are as cheap as possible and provably
 * accumulate nothing (the "compiled out in production" contract).
 */
export const NOOP_DEBUG_DRAW: DebugDrawAccumulator =
  new NoopDebugDrawAccumulator();

/** Create a fresh, enabled immediate-mode debug-draw accumulator. */
export function createDebugDrawAccumulator(): DebugDrawAccumulator {
  return new RealDebugDrawAccumulator();
}

/**
 * Resolve an accumulator for a debug-draw config flag: the shared no-op when
 * disabled, a fresh real accumulator when enabled.
 */
export function createConfiguredDebugDrawAccumulator(
  enabled: boolean,
): DebugDrawAccumulator {
  return enabled ? createDebugDrawAccumulator() : NOOP_DEBUG_DRAW;
}

type DebugDrawWorldGlobals = {
  globals?: Record<string, unknown>;
};

/** Install the per-frame debug-draw accumulator on the ECS world globals. */
export function installDebugDrawAccumulator(
  world: EcsWorld,
  accumulator: DebugDrawAccumulator,
): DebugDrawAccumulator {
  const globals = (world as DebugDrawWorldGlobals).globals;

  if (globals !== undefined) {
    globals[DEBUG_DRAW_WORLD_GLOBALS_KEY] = accumulator;
  }

  return accumulator;
}

/** Read the debug-draw accumulator installed on the ECS world, if any. */
export function getDebugDrawAccumulator(
  world: EcsWorld,
): DebugDrawAccumulator | undefined {
  const globals = (world as DebugDrawWorldGlobals).globals;
  const value = globals?.[DEBUG_DRAW_WORLD_GLOBALS_KEY];

  return isDebugDrawAccumulator(value) ? value : undefined;
}

function isDebugDrawAccumulator(value: unknown): value is DebugDrawAccumulator {
  return (
    typeof value === "object" &&
    value !== null &&
    "drain" in value &&
    typeof (value as DebugDrawAccumulator).drain === "function"
  );
}

function vec3(value: Vec3Like): [number, number, number] {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

function rgba(value: Vec4Like | undefined): [number, number, number, number] {
  if (value === undefined) {
    return [1, 1, 1, 1];
  }

  return [value[0] ?? 1, value[1] ?? 1, value[2] ?? 1, value[3] ?? 1];
}

function isFiniteSegment(segment: DebugSegment): boolean {
  return (
    Number.isFinite(segment.from[0]) &&
    Number.isFinite(segment.from[1]) &&
    Number.isFinite(segment.from[2]) &&
    Number.isFinite(segment.to[0]) &&
    Number.isFinite(segment.to[1]) &&
    Number.isFinite(segment.to[2]) &&
    Number.isFinite(segment.color[0]) &&
    Number.isFinite(segment.color[1]) &&
    Number.isFinite(segment.color[2]) &&
    Number.isFinite(segment.color[3])
  );
}
