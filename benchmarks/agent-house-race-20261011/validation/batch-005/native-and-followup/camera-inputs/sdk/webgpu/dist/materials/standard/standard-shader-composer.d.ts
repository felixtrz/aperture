export declare const STANDARD_FRAGMENT_ASSEMBLY_BEGIN = "  // @aperture-standard-fragment-assembly:begin";
export declare const STANDARD_FRAGMENT_ASSEMBLY_END = "  // @aperture-standard-fragment-assembly:end";
export declare const STANDARD_FRAGMENT_HELPERS_BEGIN = "// @aperture-standard-fragment-helpers:begin";
export declare const STANDARD_FRAGMENT_HELPERS_END = "// @aperture-standard-fragment-helpers:end";
export declare const STANDARD_FRAGMENT_BASE_COLOR_ALPHA_BEGIN = "  // @aperture-standard-fragment-base-color-alpha:begin";
export declare const STANDARD_FRAGMENT_BASE_COLOR_ALPHA_END = "  // @aperture-standard-fragment-base-color-alpha:end";
export declare const STANDARD_FRAGMENT_NORMAL_SETUP_BEGIN = "  // @aperture-standard-fragment-normal-setup:begin";
export declare const STANDARD_FRAGMENT_NORMAL_SETUP_END = "  // @aperture-standard-fragment-normal-setup:end";
export declare const STANDARD_FRAGMENT_METALLIC_ROUGHNESS_BEGIN = "  // @aperture-standard-fragment-metallic-roughness:begin";
export declare const STANDARD_FRAGMENT_METALLIC_ROUGHNESS_END = "  // @aperture-standard-fragment-metallic-roughness:end";
export declare const STANDARD_AMBIENT_DIFFUSE_BRDF_EXPRESSION = "ambient * baseColor * (1.0 - metallic) * (1.0 / PI)";
export interface StandardFragmentTerm {
    readonly id: string;
    readonly expression: string;
}
export interface StandardFragmentCompositionContract {
    readonly helperFunctions: readonly string[];
    readonly baseColorAlphaStatements: readonly string[];
    readonly baseColorAlphaMutations: readonly string[];
    readonly baseColorExpression: string;
    readonly alphaExpression: string;
    readonly baseColorMutable: boolean;
    readonly alphaMutable: boolean;
    readonly normalExpression: string;
    readonly metallicRoughnessStatements: readonly string[];
    readonly metallicExpression: string;
    readonly roughnessExpression: string;
    readonly materialStatements: readonly string[];
    readonly indirectDiffuseTerms: readonly StandardFragmentTerm[];
    readonly indirectSpecularTerms: readonly StandardFragmentTerm[];
    readonly directTerms: readonly StandardFragmentTerm[];
    readonly emissiveTerm: StandardFragmentTerm;
    readonly colorMutationStatements: readonly string[];
    readonly outputColorExpression: string;
    readonly indirectOutputColorExpression: string;
}
export declare class StandardShaderComposerError extends Error {
    constructor(message: string);
}
export declare class StandardFragmentComposer {
    #private;
    constructor(options?: {
        readonly defaults?: boolean;
    });
    addMaterialStatement(statement: string): void;
    addHelperFunction(helper: string): void;
    addBaseColorAlphaStatement(statement: string): void;
    addBaseColorAlphaMutation(statement: string): void;
    setBaseColorExpression(expression: string): void;
    multiplyBaseColorExpression(factorExpression: string): void;
    setBaseColorMutable(): void;
    setAlphaExpression(expression: string): void;
    multiplyAlphaExpression(factorExpression: string): void;
    setAlphaMutable(): void;
    setNormalExpression(expression: string): void;
    addMetallicRoughnessStatement(statement: string): void;
    setMetallicExpression(expression: string): void;
    setRoughnessExpression(expression: string): void;
    addIndirectDiffuseTerm(id: string, expression: string, statement?: string): void;
    setIndirectDiffuseTerm(id: string, expression: string, statement?: string): void;
    addIndirectSpecularTerm(id: string, expression: string, statement?: string): void;
    addDirectTerm(id: string, expression: string): void;
    setDirectTerm(id: string, expression: string): void;
    setEmissiveTerm(id: string, expression: string): void;
    replaceEmissiveTerm(id: string, expression: string): void;
    addColorMutationStatement(statement: string): void;
    setOutputColorExpression(expression: string): void;
    setIndirectOutputColorExpression(expression: string): void;
    contract(): StandardFragmentCompositionContract;
    emitHelperFunctions(): string;
    emitBaseColorAlphaBlock(): string;
    emitNormalSetupBlock(): string;
    emitMetallicRoughnessBlock(): string;
    emit(): string;
}
export declare function createStandardFragmentComposer(): StandardFragmentComposer;
export declare function replaceStandardFragmentAssembly(code: string, composer: StandardFragmentComposer): string;
export declare function replaceStandardFragmentSlots(code: string, composer: StandardFragmentComposer): string;
//# sourceMappingURL=standard-shader-composer.d.ts.map