import type { LightPacket, TextureAsset } from "@aperture-engine/render";
import type { WebGpuAppTextureSamplerPreparationDiagnostic } from "../app/app-texture-sampler-resources.js";
import type { WebGpuBufferFailureReason } from "../gpu/buffer.js";
import type {
  SamplerGpuResource,
  TextureGpuResource,
} from "../resources/textures/texture-resources.js";
import type { LocalLightClusterSupportedCookieResource } from "./local-light-clusters.js";

export type LocalLightClusterCookieTextureViewDimension =
  | "2d"
  | "2d-array"
  | "cube";

export interface LocalLightClusterCookieMatrixResource {
  readonly resourceKey: string;
  readonly label: string;
  readonly buffer: unknown;
  readonly matrixCount: number;
  readonly entryLightIds: readonly number[];
}

export interface LocalLightClusterCookieResources {
  readonly matrixResource: LocalLightClusterCookieMatrixResource;
  readonly textureResource: TextureGpuResource;
  readonly samplerResource: SamplerGpuResource;
  readonly textureViewDimension: LocalLightClusterCookieTextureViewDimension;
  readonly textureLayout?: "single" | "array" | "atlas";
  readonly shadowMatrixCompatible?: boolean;
  readonly atlasUpdate?: LocalLightClusterCookieAtlasUpdateReport;
  readonly textureKey: string;
  readonly samplerKey: string;
  readonly supportedResources: readonly LocalLightClusterSupportedCookieResource[];
}

export interface LocalLightClusterCookieAtlasUpdateReport {
  readonly updateMode: "cache-hit" | "cpu-upload" | "gpu-blit";
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly requestedTileCount: number;
  readonly updatedTileCount: number;
  readonly gpuBlitTileCount: number;
  readonly cpuUploadTileCount: number;
  readonly cachedTileCount: number;
  readonly sourceTextureKeys: readonly string[];
}

export type LocalLightClusterCookieResourceDiagnostic =
  | WebGpuAppTextureSamplerPreparationDiagnostic
  | {
      readonly code:
        | "localLightClusterCookie.textureNot2d"
        | "localLightClusterCookie.textureNotCube"
        | "localLightClusterCookie.textureArrayIncompatible"
        | "localLightClusterCookie.textureArrayMissingSourceData"
        | "localLightClusterCookie.textureAtlasIncompatible"
        | "localLightClusterCookie.textureAtlasMissingSourceData"
        | "localLightClusterCookie.textureAtlasUploadUnavailable"
        | "localLightClusterCookie.textureAtlasUploadFailed";
      readonly message: string;
      readonly resourceKey: string;
    }
  | {
      readonly code:
        | "localLightClusterCookie.missingLightTransform"
        | "localLightClusterCookie.invalidLightDirection"
        | "localLightClusterCookie.bufferCreationFailed";
      readonly message: string;
      readonly lightId: number;
      readonly reason?: WebGpuBufferFailureReason;
    };

export interface PrepareLocalLightClusterCookieResourcesResult {
  readonly valid: boolean;
  readonly resources: LocalLightClusterCookieResources | null;
  readonly diagnostics: readonly LocalLightClusterCookieResourceDiagnostic[];
}

export interface CookieArrayCandidate {
  readonly light: LightPacket;
  readonly texture: TextureAsset & {
    readonly sourceData: NonNullable<TextureAsset["sourceData"]>;
  };
  readonly textureKey: string;
  readonly textureCacheKey: string;
  readonly samplerSignature: string;
  readonly layerByteLength: number;
  readonly rowsPerImage: number;
  readonly layerCount: number;
  readonly layerBaseIndex: number;
}

export interface CookieAtlasCandidate {
  readonly light: LightPacket;
  readonly texture: TextureAsset & {
    readonly sourceData: NonNullable<TextureAsset["sourceData"]>;
  };
  readonly textureKey: string;
  readonly textureCacheKey: string;
  readonly samplerSignature: string;
  readonly rowsPerImage: number;
  readonly layerByteLength: number;
  readonly originX: number;
  readonly originY: number;
  readonly atlasWidth: number;
  readonly atlasHeight: number;
  readonly atlasTileWidth: number;
  readonly atlasTileHeight: number;
  readonly matrixBaseIndex: number;
  readonly shadowMatrixCompatible?: boolean;
}

export interface PreparedCookieAtlasTextureResource {
  readonly cacheKey: string;
  readonly resource: TextureGpuResource;
  readonly atlasUpdate: LocalLightClusterCookieAtlasUpdateReport;
}
