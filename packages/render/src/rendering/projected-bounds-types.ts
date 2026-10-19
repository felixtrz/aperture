import type { MaterialHandle, MeshHandle } from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/types.js";
import type { SourceMaterialAsset } from "../materials/types.js";
import type { RenderSnapshot } from "./snapshot-core-types.js";
import type { RenderEntityRef } from "./snapshot-packet-types.js";

export interface ProjectedBoundsScope {
  readonly all?: boolean;
  readonly meshIds?: readonly string[];
  readonly entities?: readonly RenderEntityRef[];
}
export interface ProjectedBoundsOptions {
  readonly scope: ProjectedBoundsScope;
  /** Exact retained view. Never choose the first camera implicitly. */
  readonly viewId: number;
  /** Pixel dimensions of the retained view's main output target. */
  readonly target: { readonly width: number; readonly height: number };
  readonly limits?: {
    readonly maxDraws?: number;
    /** References in active index/vertex sequences, including repeats. */
    readonly maxVertices?: number;
  };
}
export interface ProjectedBoundsInput extends ProjectedBoundsOptions {
  readonly snapshot: RenderSnapshot;
  readonly resolveMesh: (handle: MeshHandle) => MeshAsset | undefined;
  readonly resolveMaterial: (
    handle: MaterialHandle,
  ) => SourceMaterialAsset | undefined;
}
export interface ProjectedBoundsWitness {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
  readonly meshId: string;
  readonly materialId: string;
  readonly submesh: number;
  /** Original active index/vertex sequence offset, before any filtering. */
  readonly offset: number;
  readonly vertexIndex: number;
  readonly local: readonly [number, number, number];
  readonly world: readonly [number, number, number];
  readonly ndc: readonly [number, number, number];
  readonly pixel: readonly [number, number];
}
export interface ProjectedVertexBounds {
  readonly min: readonly [number, number];
  readonly max: readonly [number, number];
  readonly witnesses: {
    readonly minX: ProjectedBoundsWitness;
    readonly minY: ProjectedBoundsWitness;
    readonly maxX: ProjectedBoundsWitness;
    readonly maxY: ProjectedBoundsWitness;
  };
}
export interface ProjectedBoundsDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly renderId?: number;
}
export interface ProjectedBoundsDrawReport {
  readonly renderId: number;
  readonly entity: RenderEntityRef;
  readonly meshId: string;
  readonly materialId: string;
  readonly submesh: number;
  readonly materialSlot: number;
  readonly coverage: "complete" | "partial" | "empty";
  readonly range: {
    readonly unit: "index" | "vertex";
    readonly start: number;
    readonly count: number;
  } | null;
  readonly projectedReferences: number;
  readonly outsideViewportReferences: number;
  readonly beyondFarReferences: number;
  readonly maxPixelUncertainty: number | null;
  readonly bounds: ProjectedVertexBounds | null;
  readonly diagnostics: readonly ProjectedBoundsDiagnostic[];
}
export interface ProjectedBoundsReport {
  readonly schema: "aperture.projected-bounds.v1";
  readonly frame: number;
  readonly coverage: "complete" | "partial" | "empty";
  readonly scope: ProjectedBoundsScope;
  readonly viewId: number;
  readonly target: { readonly width: number; readonly height: number };
  readonly limits: { readonly maxDraws: number; readonly maxVertices: number };
  readonly precisionTolerancePixels: number;
  readonly semantics: "unclipped-static-draw-vertex-envelope";
  readonly visibility: "unknown";
  readonly counts: {
    readonly matchedDraws: number;
    readonly layerExcludedDraws: number;
    readonly selectedDraws: number;
    readonly inspectedDraws: number;
    readonly attemptedReferences: number;
    readonly projectedReferences: number;
  };
  /** Null if any selected data is unsupported, uncertain or unexamined. */
  readonly bounds: ProjectedVertexBounds | null;
  readonly draws: readonly ProjectedBoundsDrawReport[];
  readonly diagnostics: readonly ProjectedBoundsDiagnostic[];
}
