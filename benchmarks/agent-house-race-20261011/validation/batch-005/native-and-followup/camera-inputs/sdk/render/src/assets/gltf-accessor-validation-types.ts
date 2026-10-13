import type {
  GltfMeshPrimitiveAttributeSemantic,
  GltfMeshPrimitiveMappingReport,
} from "./gltf-mesh-primitive.js";

export type GltfAccessorValidationDiagnosticSeverity = "error" | "warning";

export type GltfAccessorSemantic =
  | GltfMeshPrimitiveAttributeSemantic
  | "INDICES";

export interface GltfAccessorValidationDiagnostic {
  readonly code: string;
  readonly severity: GltfAccessorValidationDiagnosticSeverity;
  readonly message: string;
  readonly meshHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly semantic?: GltfAccessorSemantic;
  readonly accessorIndex?: number;
  readonly bufferViewIndex?: number;
  readonly bufferIndex?: number;
  readonly field?: string;
  readonly value?: string | number | boolean | null;
  readonly byteOffset?: number;
  readonly byteLength?: number;
  readonly requiredByteLength?: number;
}

export interface GltfAccessorValidationOptions {
  readonly root: unknown;
  readonly primitiveReport: GltfMeshPrimitiveMappingReport;
  readonly binaryChunkByteLength?: number;
  readonly externalBufferByteLengths?: ReadonlyMap<number, number>;
}

export interface GltfValidatedAccessorReference {
  readonly semantic: GltfAccessorSemantic;
  readonly accessorIndex: number;
  readonly bufferViewIndex: number;
  readonly bufferIndex: number;
  readonly bufferViewByteOffset: number;
  readonly bufferViewByteLength: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly componentType: number;
  readonly accessorType: string;
  readonly count: number;
  readonly byteStride: number;
  readonly normalized: boolean;
  readonly expectedFormat:
    | "float32x2"
    | "float32x3"
    | "float32x4"
    | "unorm8x4"
    | "unorm16x4"
    | "uint8x4"
    | "uint16x4"
    | "uint8-to-uint16"
    | "uint16"
    | "uint32";
}

export interface GltfPrimitiveAccessorPlan {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly vertexCount: number | null;
  readonly attributes: readonly GltfValidatedAccessorReference[];
  readonly indices: GltfValidatedAccessorReference | null;
}

export interface GltfAccessorValidationReport {
  readonly valid: boolean;
  readonly primitives: readonly GltfPrimitiveAccessorPlan[];
  readonly diagnostics: readonly GltfAccessorValidationDiagnostic[];
}

export type GltfAccessorValidationReportJsonValue =
  GltfAccessorValidationReport;

export interface GltfAccessorValidationContext {
  readonly root: Record<string, unknown>;
  readonly options: GltfAccessorValidationOptions;
  readonly diagnostics: GltfAccessorValidationDiagnostic[];
}

export interface GltfAccessorExpectation {
  readonly type: string;
  readonly componentTypes: readonly number[];
  readonly expectedFormat: GltfValidatedAccessorReference["expectedFormat"];
}

export interface GltfAccessorValidationInput {
  readonly semantic: GltfAccessorSemantic;
  readonly accessorIndex: number;
}

export interface GltfValidatedBufferView {
  readonly bufferIndex: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly byteStride: number | null;
}
