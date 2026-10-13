export interface WgslFunctionParameter {
    readonly name: string;
    /** Attribute-free type tokens; comments and entry IO attributes are omitted. */
    readonly type: string;
}
export interface WgslFunctionDeclaration {
    readonly start: number;
    readonly bodyStart: number;
    readonly attributes: readonly string[];
    readonly attributesSource: string;
    readonly helperAttributesSource: string;
    readonly parametersSource: string;
    readonly parameters: readonly WgslFunctionParameter[];
    readonly returnType: string;
    readonly returnAttributes: readonly string[];
}
/** Reads a function signature without splitting nested attributes or types. */
export declare function findWgslFunctionDeclaration(source: string, name: string): WgslFunctionDeclaration | null;
//# sourceMappingURL=wgsl-function-declaration.d.ts.map