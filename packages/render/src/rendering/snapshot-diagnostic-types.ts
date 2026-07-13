import type {
  MaterialTextureTransform,
  TextureColorSpace,
  TextureSemantic,
} from "../materials/index.js";
import type { RenderEntityRef } from "./snapshot-packet-types.js";

export type RenderDiagnosticSeverity = "info" | "warning" | "error";

export interface RenderDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: RenderDiagnosticSeverity;
  readonly entity?: RenderEntityRef;
  readonly assetKey?: string;
  readonly materialKey?: string;
  readonly meshKey?: string;
  readonly textureKey?: string;
  readonly samplerKey?: string;
  readonly runtimeUniformKey?: string;
  readonly runtimeBufferKey?: string;
  readonly dependencyKind?: string;
  readonly status?: string;
  readonly field?: string;
  readonly expectedSemantic?: TextureSemantic;
  readonly actualSemantic?: TextureSemantic;
  readonly expectedColorSpaces?: readonly TextureColorSpace[];
  readonly actualColorSpace?: TextureColorSpace;
  readonly texCoord?: number;
  readonly supportedTexCoords?: readonly number[];
  readonly textureTransform?: MaterialTextureTransform;
}

export interface RenderSnapshotReport {
  readonly views: number;
  readonly meshDraws: number;
  readonly shadowCasterDraws?: number;
  readonly spriteDraws?: number;
  /**
   * Decal cap/eviction tally (D4). Absent when a frame carries no decals so a
   * decal-free report is byte-identical to a pre-D4 report.
   */
  readonly decals?: DecalSnapshotReport;
  /**
   * Fat-line tally (E1). Absent when a frame carries no lines so a line-free
   * report is byte-identical to a pre-E1 report.
   */
  readonly lines?: LineSnapshotReport;
  /** Point-cloud tally (E1). Absent when a frame carries no points. */
  readonly points?: PointsSnapshotReport;
  /**
   * Mesh-LOD selection tally (E2). Absent when a frame carries no LOD entities
   * so a LOD-free report is byte-identical to a pre-E2 report.
   */
  readonly lod?: LodSnapshotReport;
  readonly particleEmitters?: number;
  readonly audioEmitters?: number;
  readonly quadInstances?: number;
  readonly quadBatches?: number;
  readonly uiNodes?: number;
  readonly uiHitRegions?: number;
  readonly skyboxes?: number;
  readonly proceduralSkies?: number;
  readonly runtimeUniforms?: number;
  readonly runtimeBuffers?: number;
  readonly fogs?: number;
  readonly lights: number;
  readonly environments: number;
  readonly shadowRequests: number;
  readonly bounds: number;
  readonly diagnostics: number;
  readonly cullStats?: readonly ViewCullStats[];
}

/**
 * Decal cap + eviction counters (D4). `submitted` live decal entities were
 * gathered this frame; the newest `live` (== min(submitted, capacity)) survive
 * the oldest-first ring-buffer cap and are rendered; `evicted` (== submitted -
 * live) were dropped.
 */
export interface DecalSnapshotReport {
  readonly capacity: number;
  readonly live: number;
  readonly evicted: number;
  readonly submitted: number;
}

/** Fat-line extraction tally (E1): line entities, total segments, total vertices. */
export interface LineSnapshotReport {
  readonly lines: number;
  readonly segments: number;
  readonly vertices: number;
}

/** Point-cloud extraction tally (E1): clouds and total points. */
export interface PointsSnapshotReport {
  readonly clouds: number;
  readonly points: number;
}

/**
 * Mesh-LOD selection tally (E2). `entities` LOD entities selected a level this
 * frame; `levels[i]` counts how many of them are currently at level `i` (index
 * 0 = highest detail). The histogram length is the max level count across the
 * frame's LOD entities. Draw-count shifts with camera distance (near → level 0,
 * far → the last level) are asserted straight from this.
 */
export interface LodSnapshotReport {
  readonly entities: number;
  readonly levels: readonly number[];
}

export interface ViewCullStats {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  readonly tested: number;
  readonly culled: number;
  readonly included: number;
}
