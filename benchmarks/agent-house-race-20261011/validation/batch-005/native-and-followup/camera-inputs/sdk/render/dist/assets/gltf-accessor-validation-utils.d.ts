export declare const GLTF_COMPONENT_BYTE = 5120;
export declare const GLTF_COMPONENT_UNSIGNED_BYTE = 5121;
export declare const GLTF_COMPONENT_SHORT = 5122;
export declare const GLTF_COMPONENT_UNSIGNED_SHORT = 5123;
export declare const GLTF_COMPONENT_UNSIGNED_INT = 5125;
export declare const GLTF_COMPONENT_FLOAT = 5126;
export declare const COMPONENT_BYTE_SIZE: Map<number, number>;
export declare const ACCESSOR_COMPONENTS: Map<string, number>;
export declare function arrayField(root: Record<string, unknown>, field: "accessors" | "bufferViews" | "buffers"): readonly unknown[] | null;
export declare function integerField(value: unknown): number | null;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function toDiagnosticValue(value: unknown): string | number | boolean | null;
//# sourceMappingURL=gltf-accessor-validation-utils.d.ts.map