import type { MaterialHandle, MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/types.js";
import type {
  RenderStateDescriptor,
  SourceMaterialAsset,
} from "../materials/types.js";
import type { RenderSnapshot } from "./snapshot-core-types.js";
import type { RenderEntityRef } from "./snapshot-packet-types.js";

export interface CoplanarOverlapScope {
  /** Explicit opt-in; cannot be combined with selectors. */
  readonly all?: boolean;
  /** Exact asset IDs; selects every extracted draw using each asset. */
  readonly meshIds?: readonly string[];
  readonly entities?: readonly RenderEntityRef[];
}

export interface CoplanarOverlapTolerances {
  /** World units. Defaults to 1e-6. */
  readonly distance?: number;
  /** Multiplied by the larger triangle's longest edge. Defaults to 1e-7. */
  readonly relativeDistance?: number;
  /** Radians between planes, independent of winding. Defaults to 1e-5. */
  readonly angleRadians?: number;
  /** World units squared; a numerical area floor also applies. Defaults to 0. */
  readonly minArea?: number;
}

export interface CoplanarOverlapLimits {
  readonly maxDraws?: number;
  readonly maxTriangles?: number;
  /** Includes triangle AABB rejections, not just successful intersections. */
  readonly maxTrianglePairs?: number;
  readonly maxFindings?: number;
}

export interface CoplanarOverlapOptions {
  readonly scope: CoplanarOverlapScope;
  readonly tolerances?: CoplanarOverlapTolerances;
  readonly limits?: CoplanarOverlapLimits;
  /** Filters by camera layer mask only; visibility remains unknown. */
  readonly viewId?: number;
}

export interface CoplanarOverlapInput extends CoplanarOverlapOptions {
  readonly snapshot: RenderSnapshot;
  readonly resolveMesh: (handle: MeshHandle) => MeshAsset | undefined;
  readonly resolveMaterial: (
    handle: MaterialHandle,
  ) => SourceMaterialAsset | undefined;
}

export interface CoplanarOverlapDraw {
  readonly entity: RenderEntityRef;
  readonly renderId: number;
  readonly meshId: string;
  readonly materialId: string;
  readonly submesh: number;
  readonly renderState: RenderStateDescriptor;
}

export interface CoplanarOverlapFinding {
  readonly a: CoplanarOverlapDraw & { readonly triangleOffset: number };
  readonly b: CoplanarOverlapDraw & { readonly triangleOffset: number };
  /** Offset is in the original index or vertex sequence, not a BVH ordering. */
  readonly offsetUnit: "index-or-vertex";
  readonly area: number;
  readonly distanceTolerance: number;
  readonly maxPlaneSeparation: number;
  readonly normalDot: number;
  readonly polygonWorld: readonly (readonly [number, number, number])[];
  /** No culling, clipping, texture alpha, occlusion or rasterization is evaluated. */
  readonly visibility: "unknown";
}

export interface CoplanarOverlapDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly renderId?: number;
}

export interface CoplanarOverlapReport {
  readonly schema: "aperture.coplanar-overlaps.v1";
  readonly frame: number;
  /** Complete only for the selected, supported, extracted color-pass draws. */
  readonly coverage: "complete" | "partial" | "empty";
  readonly scope: CoplanarOverlapScope;
  readonly viewId: number | null;
  readonly tolerances: Required<CoplanarOverlapTolerances>;
  readonly limits: Required<CoplanarOverlapLimits>;
  readonly counts: {
    readonly selectedDraws: number;
    readonly inspectedDraws: number;
    readonly triangles: number;
    readonly drawPairs: number;
    readonly trianglePairs: number;
    readonly aabbRejectedPairs: number;
  };
  readonly findings: readonly CoplanarOverlapFinding[];
  readonly diagnostics: readonly CoplanarOverlapDiagnostic[];
}
