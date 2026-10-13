import { type AssetDiagnostic, type AssetProvenance, type AssetRegistry, type AssetStatus, type SerializedAssetHandle } from "@aperture-engine/simulation";
interface SerializedSourceAssetEntry {
    readonly handle: SerializedAssetHandle;
    readonly label: string;
    readonly status: AssetStatus;
    readonly version: number;
    readonly asset: unknown;
    readonly dependencies: readonly SerializedAssetHandle[];
    readonly diagnostics: readonly AssetDiagnostic[];
    readonly provenance?: AssetProvenance;
}
export interface SerializedSourceAssetRegistry {
    readonly entries: readonly SerializedSourceAssetEntry[];
}
export interface SourceAssetMirrorReport {
    readonly mirrored: number;
    readonly skipped: number;
}
export interface SourceAssetSerializationState {
    readonly versionsByHandle: Map<string, number>;
    readonly meshLayoutKeysByHandle: Map<string, string>;
}
export declare function createSourceAssetSerializationState(): SourceAssetSerializationState;
/** Producer versions of successfully applied entries, without copying asset bytes. */
export declare function readMirroredSourceAssetVersions(registry: AssetRegistry): readonly (readonly [string, number])[];
export declare function serializeSourceAssetRegistry(registry: AssetRegistry, options?: {
    readonly state?: SourceAssetSerializationState;
}): SerializedSourceAssetRegistry;
/**
 * Record the serialized entry versions as successfully delivered. Callers must
 * invoke this only after the message containing the entries was posted; if
 * posting throws (for example a structured-clone failure on an asset payload),
 * skipping the commit keeps the entries eligible for the next snapshot instead
 * of silently dropping them from the mirror forever.
 */
export declare function commitSerializedSourceAssets(state: SourceAssetSerializationState, serialized: SerializedSourceAssetRegistry): void;
export declare function mirrorSourceAssetRegistryFromMessage(registry: AssetRegistry, message: unknown): SourceAssetMirrorReport;
export {};
//# sourceMappingURL=asset-mirror.d.ts.map