import { type Signal } from "@preact/signals-core";
import { type DracoMeshDecoder, type GltfAnimationImportReport, type GltfImageBytesDecoder, type GltfEcsAuthoringCommandPlan, type GltfMeshSourceAssetRegistrationReport, type GltfPrimitiveMaterialResolutionReport, type GltfReportDrivenImportReport, type GltfSkinImportReport, type GltfSourceAssetRegistrationReport, type Ktx2BasisTranscoder, type Ktx2TextureCompressionSupport, type MeshoptBufferDecoder, type TextureColorSpace, type TextureSemantic } from "@aperture-engine/render";
import { type AnimationClip, type AnimationClipHandle, type AudioClipHandle, type EnvironmentMapHandle, type AssetRegistry, type ParticleEffectHandle, type SamplerHandle, type SceneHandle, type ShaderHandle, type TextureHandle } from "@aperture-engine/simulation";
import type { ApertureConfig, ApertureParticleEffectAssetDescriptor, AssetPreloadPolicy, ConfigAssetKind } from "../config.js";
import { type ApertureSystemDiagnostic, type SystemDiagnostics } from "./diagnostics.js";
export type SystemAssetKind = ConfigAssetKind;
export interface SystemAssetHandle<TKind extends SystemAssetKind> {
    readonly id: string;
    readonly kind: TKind;
    readonly url?: string;
    readonly label?: string;
    readonly preload: AssetPreloadPolicy;
    readonly ready: Signal<boolean>;
    readonly error: Signal<ApertureSystemDiagnostic | null>;
    readonly renderHandle: TKind extends "gltf" ? SceneHandle : TKind extends "shader" ? ShaderHandle : TKind extends "audio" ? AudioClipHandle : TKind extends "texture" ? TextureHandle : TKind extends "hdr" ? EnvironmentMapHandle : TKind extends "particle-effect" ? ParticleEffectHandle : unknown;
}
export type SystemGltfAssetHandle = SystemAssetHandle<"gltf"> & {
    readonly url: string;
    readonly renderHandle: SceneHandle;
    readonly scene: Signal<SystemGltfLoadedScene | null>;
};
export type SystemShaderAssetHandle = SystemAssetHandle<"shader"> & {
    readonly url: string;
    readonly renderHandle: ShaderHandle;
};
export type SystemAudioAssetHandle = SystemAssetHandle<"audio"> & {
    readonly url: string;
    readonly renderHandle: AudioClipHandle;
    readonly streaming: boolean;
    readonly durationHint?: number;
    readonly channels?: number;
    readonly captionTrackId?: string;
};
export type SystemTextureAssetHandle = SystemAssetHandle<"texture"> & {
    readonly url: string;
    readonly renderHandle: TextureHandle;
    readonly colorSpace: TextureColorSpace;
    readonly semantic: TextureSemantic;
    readonly mimeType?: string;
};
export type SystemParticleEffectAssetHandle = SystemAssetHandle<"particle-effect"> & {
    readonly renderHandle: ParticleEffectHandle;
    readonly descriptor: ApertureParticleEffectAssetDescriptor;
    readonly texture?: TextureHandle | null;
    readonly sampler?: SamplerHandle | null;
};
/** A glTF animation clip registered in the AssetRegistry under a handle. */
export interface SystemGltfAnimationClip {
    readonly animationIndex: number;
    readonly name: string;
    readonly handle: AnimationClipHandle;
    readonly clip: AnimationClip;
}
export interface SystemGltfLoadedScene {
    readonly assetId: string;
    readonly url: string;
    readonly sourceKind: "glb" | "gltf";
    readonly byteLength: number | null;
    /** Counts from the authored glTF root, retained for bounded inspection tools. */
    readonly sourceSummary: {
        readonly nodeCount: number;
        readonly meshCount: number;
        readonly primitiveCount: number;
        readonly materialCount: number;
        readonly textureCount: number;
        readonly imageCount: number;
    };
    readonly importReport: GltfReportDrivenImportReport;
    readonly sourceRegistration: GltfSourceAssetRegistrationReport;
    readonly meshRegistration: GltfMeshSourceAssetRegistrationReport;
    readonly primitiveMaterials: GltfPrimitiveMaterialResolutionReport;
    readonly commandPlan: GltfEcsAuthoringCommandPlan;
    readonly defaultMaterialHandleKey: string;
    /** Engine-owned skeletons parsed from gltf.skins (M2-T3). */
    readonly skin: GltfSkinImportReport;
    /** Engine AnimationClips registered under AnimationClipHandles (M2-T4). */
    readonly clips: readonly SystemGltfAnimationClip[];
    readonly animationReport: GltfAnimationImportReport;
}
export interface SystemAssetAccess {
    gltf(id: string): SystemGltfAssetHandle;
    texture(id: string): SystemTextureAssetHandle;
    hdr(id: string): SystemAssetHandle<"hdr">;
    shader(id: string): SystemShaderAssetHandle;
    audio(id: string): SystemAudioAssetHandle;
    particleEffect(id: string): SystemParticleEffectAssetHandle;
    request(idOrHandle: string | SystemAssetHandle<SystemAssetKind>): Promise<void>;
    readiness(id: string): Signal<boolean>;
    error(id: string): Signal<ApertureSystemDiagnostic | null>;
    list(): readonly SystemAssetHandle<SystemAssetKind>[];
}
export interface ApertureAssetLoadResult {
    /** Return false to let the built-in asset loader handle this asset. */
    readonly handled?: boolean;
    /** The loader fulfilled the asset with a structural placeholder, not real bytes. */
    readonly placeholder?: boolean;
}
export interface ApertureAssetLoadContext {
    readonly registry: AssetRegistry;
}
export interface ApertureAssetLoader {
    load(asset: SystemAssetHandle<SystemAssetKind>, context: ApertureAssetLoadContext): Promise<void | ApertureAssetLoadResult>;
}
export interface SystemGltfAssetDecoderProvider {
    /** Optional image decoder used by headless/non-browser glTF loads. */
    readonly decodeImageData?: GltfImageBytesDecoder;
    readonly createDracoDecoder?: () => PromiseLike<DracoMeshDecoder>;
    readonly createMeshoptDecoder?: () => PromiseLike<MeshoptBufferDecoder>;
    readonly createBasisKtx2Transcoder?: () => PromiseLike<Ktx2BasisTranscoder>;
    readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
}
export interface SystemGltfAssetDecoderProviderOptions {
    readonly baseUrl?: string;
    readonly ktx2TextureCompression?: Ktx2TextureCompressionSupport;
}
export declare function createDefaultSystemGltfAssetDecoderProvider(options?: SystemGltfAssetDecoderProviderOptions): SystemGltfAssetDecoderProvider;
export declare function createSystemAssetAccess(options: {
    readonly config: ApertureConfig | undefined;
    readonly registry: AssetRegistry;
    readonly diagnostics: SystemDiagnostics;
    readonly loader: ApertureAssetLoader | undefined;
    readonly gltfAssetDecoders?: SystemGltfAssetDecoderProvider;
}): SystemAssetAccess;
export declare function systemAssetReadyMetadata(handle: SystemAssetHandle<SystemAssetKind>): Record<string, unknown>;
//# sourceMappingURL=assets.d.ts.map