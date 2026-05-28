import type {
  GltfLoaderOrchestrationReport,
  GltfLoaderOrchestrationReportJsonValue,
  GltfLoaderOrchestrationReportOptions,
} from "./gltf-loader-orchestration.js";
import type {
  GltfAssetMappingReport,
  GltfAssetMappingReportJsonValue,
} from "./gltf-asset-mapping.js";
import type {
  GltfAccessorDecodingReport,
  GltfAccessorDecodingReportJsonValue,
  GltfAccessorStorageMode,
} from "./gltf-accessor-decoding.js";
import type {
  GltfAccessorValidationReport,
  GltfAccessorValidationReportJsonValue,
} from "./gltf-accessor-validation.js";
import type {
  GltfRootValidationReport,
  GltfRootValidationReportJsonValue,
} from "./gltf-root.js";
import type {
  GltfSceneTraversalReport,
  GltfSceneTraversalReportJsonValue,
} from "./gltf-scene-traversal.js";
import type {
  GltfMeshPrimitiveMappingReport,
  GltfMeshPrimitiveMappingReportJsonValue,
} from "./gltf-mesh-primitive.js";
import type { DracoMeshDecoder } from "./draco-decoder.js";
import type { MeshoptBufferDecoder } from "./meshopt-decoder.js";
import type {
  GltfMeshAssetConstructionReport,
  GltfMeshAssetConstructionReportJsonValue,
} from "./gltf-mesh-asset-construction.js";
import type {
  GlbContainerParseResult,
  GlbContainerSource,
} from "./glb-container.js";
import type { GltfImageDataResolver } from "../materials/gltf-texture.js";

export type GltfReportDrivenImportDiagnosticCode =
  | "gltfImport.providedRootReport"
  | "gltfImport.providedSceneTraversalReport"
  | "gltfImport.assetMappingConflict"
  | "gltfImport.meshConstructionConflict";

export type GltfReportDrivenGlbImportDiagnosticCode =
  | "glbImport.missingBinaryChunk"
  | "glbImport.externalBufferUnsupported";

export interface GltfReportDrivenImportDiagnostic {
  readonly code: GltfReportDrivenImportDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
}

export interface GltfReportDrivenGlbImportDiagnostic {
  readonly code: GltfReportDrivenGlbImportDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly bufferIndex?: number;
  readonly uri?: string;
}

export interface GltfReportDrivenImportOptions {
  readonly root: unknown;
  readonly sceneIndex?: number;
  readonly keyPrefix?: string;
  readonly createAssetMapping?: boolean;
  readonly resolveImageData?: GltfImageDataResolver;
  readonly createMeshAssets?: boolean;
  readonly resolveBufferBytes?: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
  readonly dracoDecoder?: DracoMeshDecoder;
  readonly meshoptDecoder?: MeshoptBufferDecoder;
  readonly accessorStorageMode?: GltfAccessorStorageMode;
  readonly provided?: Partial<GltfLoaderOrchestrationReportOptions>;
}

export interface GltfReportDrivenGlbImportOptions extends Omit<
  GltfReportDrivenImportOptions,
  "root" | "resolveBufferBytes"
> {
  readonly source: GlbContainerSource;
  readonly resolveBufferBytes?: (
    bufferIndex: number,
  ) => ArrayBuffer | ArrayBufferView | null | undefined;
}

export interface GltfReportDrivenImportReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReport;
  readonly assetMapping: GltfAssetMappingReport | null;
  readonly meshPrimitive: GltfMeshPrimitiveMappingReport | null;
  readonly accessorValidation: GltfAccessorValidationReport | null;
  readonly accessorDecoding: GltfAccessorDecodingReport | null;
  readonly meshConstruction: GltfMeshAssetConstructionReport | null;
  readonly sceneTraversal: GltfSceneTraversalReport;
  readonly orchestration: GltfLoaderOrchestrationReport;
  readonly diagnostics: readonly GltfReportDrivenImportDiagnostic[];
}

export interface GltfReportDrivenGlbImportReport {
  readonly valid: boolean;
  readonly container: GlbContainerParseResult;
  readonly importReport: GltfReportDrivenImportReport | null;
  readonly diagnostics: readonly GltfReportDrivenGlbImportDiagnostic[];
}

export interface GltfReportDrivenGlbImportReportJsonValue {
  readonly valid: boolean;
  readonly container: {
    readonly ok: boolean;
    readonly byteLength: number | null;
    readonly chunks: readonly {
      readonly type: string;
      readonly typeCode: number;
      readonly byteOffset: number;
      readonly byteLength: number;
    }[];
    readonly diagnostics: readonly GlbContainerParseResult["diagnostics"][number][];
  };
  readonly importReport: GltfReportDrivenImportReportJsonValue | null;
  readonly diagnostics: readonly GltfReportDrivenGlbImportDiagnostic[];
}

export interface GltfReportDrivenGlbSourceStatusJsonValue {
  readonly valid: boolean;
  readonly byteLength: number | null;
  readonly chunks: readonly {
    readonly type: string;
    readonly byteLength: number;
  }[];
  readonly diagnostics: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
  }[];
  readonly importStages: readonly {
    readonly stage: string;
    readonly status: string;
  }[];
}

export interface GltfReportDrivenImportReportJsonValue extends Omit<
  GltfReportDrivenImportReport,
  | "root"
  | "assetMapping"
  | "meshPrimitive"
  | "accessorValidation"
  | "accessorDecoding"
  | "meshConstruction"
  | "sceneTraversal"
  | "orchestration"
> {
  readonly root: GltfRootValidationReportJsonValue;
  readonly assetMapping: GltfAssetMappingReportJsonValue | null;
  readonly meshPrimitive: GltfMeshPrimitiveMappingReportJsonValue | null;
  readonly accessorValidation: GltfAccessorValidationReportJsonValue | null;
  readonly accessorDecoding: GltfAccessorDecodingReportJsonValue | null;
  readonly meshConstruction: GltfMeshAssetConstructionReportJsonValue | null;
  readonly sceneTraversal: GltfSceneTraversalReportJsonValue;
  readonly orchestration: GltfLoaderOrchestrationReportJsonValue;
}
