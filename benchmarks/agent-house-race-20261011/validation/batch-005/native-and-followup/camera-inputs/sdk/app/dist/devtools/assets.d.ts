import type { AssetRegistry } from "@aperture-engine/simulation";
import { type SystemAssetHandle, type SystemAssetKind, type SystemGltfAssetHandle } from "../systems.js";
export interface GltfTextureSlotInspection {
    readonly authored: boolean;
    readonly status: "not-authored" | "missing-handle" | "missing" | "registered" | "loading" | "ready" | "failed";
    readonly textureKey: string | null;
}
export interface GltfMaterialInspection {
    readonly name: string;
    readonly handleKey: string;
    readonly sourceMaterialKey: string | null;
    readonly kind: string;
    readonly baseColorFactor?: readonly number[];
    readonly metallicFactor?: number;
    readonly roughnessFactor?: number;
    readonly emissiveFactor?: readonly number[];
    readonly textures: {
        readonly baseColor: boolean;
        readonly metallicRoughness: boolean;
        readonly normal: boolean;
        readonly emissive: boolean;
    };
    readonly textureStatus: {
        readonly baseColor: GltfTextureSlotInspection;
        readonly metallicRoughness: GltfTextureSlotInspection;
        readonly normal: GltfTextureSlotInspection;
        readonly emissive: GltfTextureSlotInspection;
    };
}
export interface GltfAssetInspectionReport {
    readonly asset: string;
    readonly ready: boolean;
    readonly meshes: number;
    readonly nodes: number;
    readonly primitives: number;
    readonly meshPrimitives: readonly {
        readonly handleKey: string;
        readonly meshIndex: number;
        readonly primitiveIndex: number;
        readonly normals: boolean;
        readonly tangents: boolean;
        readonly uvSets: readonly number[];
    }[];
    readonly materials: readonly GltfMaterialInspection[];
    readonly spawnPatchedMaterials: readonly GltfMaterialInspection[];
    readonly summary: {
        readonly imageCount: number;
        readonly textureCount: number;
        readonly highMetallicMaterialCount: number;
        readonly patchedMaterialCount: number;
        readonly truncatedMaterialCount: number;
        readonly truncatedMeshPrimitiveCount: number;
    };
    readonly diagnostics: readonly {
        readonly code: string;
        readonly severity: "warning";
        readonly message: string;
    }[];
}
export declare function createAssetSummary(handles: readonly SystemAssetHandle<SystemAssetKind>[]): readonly Record<string, unknown>[];
/** Inspect imported and spawn-patched glTF material facts without a GPU. */
export declare function inspectGltfAsset(handle: SystemGltfAssetHandle, registry: AssetRegistry): GltfAssetInspectionReport;
//# sourceMappingURL=assets.d.ts.map