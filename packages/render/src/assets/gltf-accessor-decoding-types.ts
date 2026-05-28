import type {
  GltfAccessorSemantic,
  GltfAccessorValidationReport,
  GltfValidatedAccessorReference,
} from "./gltf-accessor-validation.js";

export type GltfDecodedArray =
  | Float32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;

export interface GltfAccessorDecodingDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly meshHandleKey?: string;
  readonly meshIndex?: number;
  readonly primitiveIndex?: number;
  readonly semantic?: GltfAccessorSemantic;
  readonly accessorIndex?: number;
  readonly bufferViewIndex?: number;
  readonly bufferIndex?: number;
  readonly byteOffset?: number;
  readonly byteLength?: number;
  readonly expectedFormat?: string;
  readonly arrayType?: string;
}

export interface GltfAccessorDecodingOptions {
  readonly validationReport: GltfAccessorValidationReport;
  readonly resolveBufferBytes: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
  readonly storageMode?: GltfAccessorStorageMode;
}

export type GltfAccessorStorageMode = "compact-copy" | "source-view";

export interface GltfDecodedAccessor {
  readonly semantic: GltfAccessorSemantic;
  readonly accessorIndex: number;
  readonly bufferIndex: number;
  readonly sourceByteOffset: number;
  readonly sourceByteLength: number;
  readonly sourceBufferViewIndex?: number;
  readonly sourceView?: Uint8Array;
  readonly sourceViewByteOffset?: number;
  readonly sourceByteStride?: number;
  readonly sourceElementByteSize?: number;
  readonly expectedFormat: GltfValidatedAccessorReference["expectedFormat"];
  readonly itemSize: number;
  readonly array: GltfDecodedArray;
}

export interface GltfDecodedPrimitiveAccessors {
  readonly meshHandleKey: string;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly vertexCount: number;
  readonly attributes: readonly GltfDecodedAccessor[];
  readonly indices: GltfDecodedAccessor | null;
}

export interface GltfAccessorDecodingReport {
  readonly valid: boolean;
  readonly primitives: readonly GltfDecodedPrimitiveAccessors[];
  readonly diagnostics: readonly GltfAccessorDecodingDiagnostic[];
}

export interface GltfDecodedAccessorJsonValue extends Omit<
  GltfDecodedAccessor,
  "array" | "sourceView"
> {
  readonly array: {
    readonly type:
      | "Float32Array"
      | "Uint8Array"
      | "Uint16Array"
      | "Uint32Array";
    readonly length: number;
  };
  readonly sourceView?: {
    readonly type: "Uint8Array";
    readonly length: number;
  };
}

export interface GltfDecodedPrimitiveAccessorsJsonValue extends Omit<
  GltfDecodedPrimitiveAccessors,
  "attributes" | "indices"
> {
  readonly attributes: readonly GltfDecodedAccessorJsonValue[];
  readonly indices: GltfDecodedAccessorJsonValue | null;
}

export interface GltfAccessorDecodingReportJsonValue extends Omit<
  GltfAccessorDecodingReport,
  "primitives"
> {
  readonly primitives: readonly GltfDecodedPrimitiveAccessorsJsonValue[];
}

export interface DecodeShape {
  readonly sourceItemSize: number;
  readonly outputItemSize: number;
  readonly sourceComponentBytes: 1 | 2 | 4;
  readonly output: "float32" | "uint8" | "uint16" | "uint32";
  readonly paddingComponentValue: number;
}
