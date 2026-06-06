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
  readonly spriteDraws?: number;
  readonly particleEmitters?: number;
  readonly quadInstances?: number;
  readonly quadBatches?: number;
  readonly uiNodes?: number;
  readonly uiHitRegions?: number;
  readonly skyboxes?: number;
  readonly fogs?: number;
  readonly lights: number;
  readonly environments: number;
  readonly shadowRequests: number;
  readonly bounds: number;
  readonly diagnostics: number;
  readonly cullStats?: readonly ViewCullStats[];
}

export interface ViewCullStats {
  readonly viewId: number;
  readonly camera: RenderEntityRef;
  readonly tested: number;
  readonly culled: number;
  readonly included: number;
}
