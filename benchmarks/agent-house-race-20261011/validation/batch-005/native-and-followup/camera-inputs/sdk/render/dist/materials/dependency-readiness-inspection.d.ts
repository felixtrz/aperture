import { type AssetHandle, type AssetRegistry } from "@aperture-engine/simulation";
import type { MaterialAssetDependencyReadinessDiagnostic, MaterialAssetDependencySlotReadiness, MaterialDependencyKind } from "./dependency-readiness-types.js";
export interface InspectMaterialDependencySlotInput {
    readonly registry: AssetRegistry;
    readonly materialKey: string;
    readonly field: string;
    readonly dependencyKind: MaterialDependencyKind;
    readonly handle: AssetHandle | null;
    readonly textureKey: string | undefined;
    readonly samplerKey: string | undefined;
    readonly slots: MaterialAssetDependencySlotReadiness[];
    readonly diagnostics: MaterialAssetDependencyReadinessDiagnostic[];
}
export declare function inspectMaterialDependencySlot(input: InspectMaterialDependencySlotInput): void;
//# sourceMappingURL=dependency-readiness-inspection.d.ts.map