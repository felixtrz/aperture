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

export interface ViewCullStats {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  readonly tested: number;
  readonly culled: number;
  readonly included: number;
}
