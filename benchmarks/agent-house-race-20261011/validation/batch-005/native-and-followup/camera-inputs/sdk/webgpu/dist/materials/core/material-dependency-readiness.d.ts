import type { UnlitMaterialResourceDependencies } from "@aperture-engine/render";
export type MaterialDependencyReadinessDiagnosticCode = "materialDependency.missingTextureResource" | "materialDependency.missingSamplerResource";
export interface MaterialDependencyReadinessDiagnostic {
    readonly code: MaterialDependencyReadinessDiagnosticCode;
    readonly message: string;
    readonly resourceKey: string;
}
export interface MaterialDependencyReadinessInput {
    readonly dependencies: UnlitMaterialResourceDependencies;
    readonly availableTextureKeys: ReadonlySet<string>;
    readonly availableSamplerKeys: ReadonlySet<string>;
}
export interface MaterialDependencyReadinessReport {
    readonly ready: boolean;
    readonly diagnostics: readonly MaterialDependencyReadinessDiagnostic[];
}
export declare function checkMaterialDependencyReadiness(input: MaterialDependencyReadinessInput): MaterialDependencyReadinessReport;
//# sourceMappingURL=material-dependency-readiness.d.ts.map