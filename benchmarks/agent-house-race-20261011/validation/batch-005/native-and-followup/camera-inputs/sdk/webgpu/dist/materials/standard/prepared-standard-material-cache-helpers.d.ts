import type { createStandardMaterialBindGroupDescriptorPlan } from "./standard-bind-group.js";
export declare function preparedScalarStandardMaterialCacheKey(input: {
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
}): string;
export declare function preparedTexturedStandardMaterialCacheKey(input: {
    readonly sourceMaterialKey: string;
    readonly sourceVersion: number;
    readonly pipelineKey: string;
    readonly layoutKey: string;
    readonly dependencyCacheKeySegments: readonly string[];
}): string;
export declare function emptyStandardMaterialDependencies(): Parameters<typeof createStandardMaterialBindGroupDescriptorPlan>[0]["dependencies"];
//# sourceMappingURL=prepared-standard-material-cache-helpers.d.ts.map