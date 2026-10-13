export declare const STANDARD_VERTEX_BINDINGS_BEGIN = "// @aperture-standard-vertex-bindings:begin";
export declare const STANDARD_VERTEX_BINDINGS_END = "// @aperture-standard-vertex-bindings:end";
export declare const STANDARD_VERTEX_INPUT_FIELDS_BEGIN = "  // @aperture-standard-vertex-input-fields:begin";
export declare const STANDARD_VERTEX_INPUT_FIELDS_END = "  // @aperture-standard-vertex-input-fields:end";
export declare const STANDARD_VERTEX_OUTPUT_FIELDS_BEGIN = "  // @aperture-standard-vertex-output-fields:begin";
export declare const STANDARD_VERTEX_OUTPUT_FIELDS_END = "  // @aperture-standard-vertex-output-fields:end";
export declare const STANDARD_VERTEX_HELPERS_BEGIN = "// @aperture-standard-vertex-helpers:begin";
export declare const STANDARD_VERTEX_HELPERS_END = "// @aperture-standard-vertex-helpers:end";
export declare const STANDARD_VERTEX_LOCAL_TRANSFORM_BEGIN = "  // @aperture-standard-vertex-local-transform:begin";
export declare const STANDARD_VERTEX_LOCAL_TRANSFORM_END = "  // @aperture-standard-vertex-local-transform:end";
export declare const STANDARD_VERTEX_NORMAL_OUTPUT_BEGIN = "  // @aperture-standard-vertex-normal-output:begin";
export declare const STANDARD_VERTEX_NORMAL_OUTPUT_END = "  // @aperture-standard-vertex-normal-output:end";
export declare const STANDARD_VERTEX_PRE_UV_OUTPUT_BEGIN = "  // @aperture-standard-vertex-pre-uv-output:begin";
export declare const STANDARD_VERTEX_PRE_UV_OUTPUT_END = "  // @aperture-standard-vertex-pre-uv-output:end";
export declare const STANDARD_VERTEX_POST_UV_OUTPUT_BEGIN = "  // @aperture-standard-vertex-post-uv-output:begin";
export declare const STANDARD_VERTEX_POST_UV_OUTPUT_END = "  // @aperture-standard-vertex-post-uv-output:end";
export interface StandardVertexSlotContribution {
    readonly id: string;
    readonly code: string;
}
export interface StandardVertexCompositionContract {
    readonly bindings: readonly StandardVertexSlotContribution[];
    readonly inputFields: readonly StandardVertexSlotContribution[];
    readonly outputFields: readonly StandardVertexSlotContribution[];
    readonly helperFunctions: readonly StandardVertexSlotContribution[];
    readonly localStatements: readonly string[];
    readonly localPositionExpression: string;
    readonly localNormalExpression: string;
    readonly localTangentExpression: string;
    readonly tangentOutputEnabled: boolean;
    readonly preUvOutputAssignments: readonly string[];
    readonly postUvOutputAssignments: readonly string[];
}
export declare class StandardVertexComposerError extends Error {
    constructor(message: string);
}
export declare class StandardVertexComposer {
    #private;
    addBinding(id: string, code: string): void;
    addInputField(id: string, code: string): void;
    addOutputField(id: string, code: string): void;
    addHelperFunction(id: string, code: string): void;
    addLocalStatement(statement: string): void;
    setLocalPositionExpression(expression: string): void;
    setLocalNormalExpression(expression: string): void;
    setLocalTangentExpression(expression: string): void;
    enableTangentOutput(): void;
    addPreUvOutputAssignment(statement: string): void;
    addPostUvOutputAssignment(statement: string): void;
    contract(): StandardVertexCompositionContract;
    emitBindings(): string;
    emitInputFields(): string;
    emitOutputFields(): string;
    emitHelperFunctions(): string;
    emitLocalTransformBlock(): string;
    emitNormalOutputBlock(): string;
    emitPreUvOutputAssignments(): string;
    emitPostUvOutputAssignments(): string;
}
export declare function createStandardVertexComposer(): StandardVertexComposer;
export declare function replaceStandardVertexSlots(code: string, composer: StandardVertexComposer): string;
//# sourceMappingURL=standard-vertex-composer.d.ts.map