export declare function applyStandardShadowMapSampling(code: string, options?: {
    readonly cascaded?: boolean;
    readonly arrayShadows?: boolean;
    readonly spotReceiver?: boolean;
    readonly directionalPointOwner?: boolean;
}): string;
export declare function applyStandardPointShadowMapSampling(code: string, options?: {
    readonly pointArrayShadows?: boolean;
    readonly directionalHelpersPresent?: boolean;
}): string;
export declare function applyStandardMultiShadowMapSampling(code: string, options?: {
    readonly compactClusteredLocalShadows?: boolean;
    readonly arrayShadows?: boolean;
    readonly pointArrayShadows?: boolean;
}): string;
//# sourceMappingURL=standard-shader-shadow-sampling.d.ts.map