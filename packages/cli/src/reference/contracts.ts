import type { ApertureReferenceSourceCategory } from "./source-filter.js";

export const INDEX_VERSION = 2;
export const CORPUS_SCHEMA_VERSION = 1;
export const MANIFEST_SCHEMA_VERSION = 1;

export type ApertureReferenceEmbeddingDType =
  | "auto"
  | "fp32"
  | "fp16"
  | "q8"
  | "int8"
  | "uint8"
  | "q4"
  | "bnb4"
  | "q4f16";

export interface ApertureReferenceModelFileSource {
  readonly relativePath: string;
  readonly sourceUrl: string;
}

export type ApertureReferenceChunkType =
  | "class"
  | "component"
  | "config"
  | "diagnostic"
  | "doc-section"
  | "enum"
  | "example"
  | "function"
  | "interface"
  | "source"
  | "system"
  | "template"
  | "type"
  | "variable";

export interface ApertureReferenceModelContract {
  readonly provider: string;
  readonly format: "transformers-js";
  readonly model: string;
  readonly revision: string;
  readonly dimensions: number;
  readonly dtype: ApertureReferenceEmbeddingDType;
  readonly pooling: "mean";
  readonly normalize: boolean;
  readonly textFormattingVersion: number;
  readonly expectedFiles: readonly string[];
  readonly files: readonly ApertureReferenceModelFileSource[];
}

export interface ApertureReferenceChunkMetadata {
  readonly sourceCategory: ApertureReferenceSourceCategory;
  readonly packageName?: string;
  readonly entrypoint?: string;
  readonly file: string;
  readonly chunkType: ApertureReferenceChunkType;
  readonly name: string;
  readonly exportedName?: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly classContext?: string;
  readonly semanticLabels: readonly string[];
  readonly imports: readonly string[];
  readonly exports: readonly string[];
  readonly calls: readonly string[];
  readonly extends: readonly string[];
  readonly implements: readonly string[];
  readonly usesTypes: readonly string[];
  readonly componentIds: readonly string[];
  readonly systemNames: readonly string[];
  readonly systemPriority?: number;
  readonly diagnostics: readonly string[];
}

export interface ApertureReferenceChunk {
  readonly id: string;
  readonly content: string;
  readonly embeddingText: string;
  readonly embedding: readonly number[];
  readonly metadata: ApertureReferenceChunkMetadata;
}

export interface ApertureReferenceSource {
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly text: string;
  readonly sourceCategory: ApertureReferenceSourceCategory;
}

export interface ApertureReferenceManifestFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ApertureReferenceManifest {
  readonly schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  readonly indexVersion: typeof INDEX_VERSION;
  readonly corpus: {
    readonly name: string;
    readonly root: string;
    readonly generatedAt: string;
    readonly chunks: number;
    readonly sources: number;
  };
  readonly model: ApertureReferenceModelContract;
  readonly files: readonly ApertureReferenceManifestFile[];
  readonly archive?: ApertureReferenceManifestFile;
}

export interface ApertureReferenceIndex {
  readonly version: typeof INDEX_VERSION;
  readonly schemaVersion: typeof CORPUS_SCHEMA_VERSION;
  readonly root: string;
  readonly createdAt: string;
  readonly model: ApertureReferenceModelContract;
  readonly manifest: ApertureReferenceManifest;
  readonly entries: readonly ApertureReferenceEntry[];
  readonly chunks: readonly ApertureReferenceChunk[];
  readonly sources: readonly ApertureReferenceSource[];
}

export interface ApertureReferenceEntry {
  readonly file: string;
  readonly bytes: number;
  readonly kind: "doc" | "source" | "example" | "test" | "reference" | "other";
  readonly sourceCategory: ApertureReferenceSourceCategory;
  readonly symbols: readonly string[];
  readonly components: readonly string[];
  readonly systems: readonly string[];
  readonly diagnostics: readonly string[];
  readonly text: string;
  readonly chunks: readonly string[];
}

export interface BuildApertureReferenceIndexOptions {
  readonly cwd: string;
}

export interface BuildApertureReferenceIndexReport {
  readonly indexFile: string;
  readonly manifestFile: string;
  readonly archiveFile: string;
  readonly dataDir: string;
  readonly modelDir: string;
  readonly entries: number;
  readonly chunks: number;
  readonly sources: number;
  readonly root: string;
}

export interface WarmApertureReferenceOptions {
  readonly cwd: string;
  readonly from?: string;
}

export interface WarmApertureReferenceReport extends BuildApertureReferenceIndexReport {
  readonly source: "workspace" | "directory" | "url";
  readonly stateFile: string;
}

export interface ApertureReferenceStatusReport {
  readonly ok: boolean;
  readonly status: "missing" | "ready" | "corrupt" | "model-mismatch";
  readonly root: string;
  readonly indexFile: string;
  readonly manifestFile: string;
  readonly archiveFile: string;
  readonly stateFile: string;
  readonly chunks: number;
  readonly sources: number;
  readonly model: ApertureReferenceModelContract;
  readonly diagnostics: readonly ApertureReferenceStatusDiagnostic[];
}

export interface ApertureReferenceStatusDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly suggestedFix: string;
}

export interface SearchApertureReferencesOptions {
  readonly cwd: string;
  readonly query: string;
  readonly limit?: number;
  readonly kind?: ApertureReferenceEntry["kind"] | "any";
  readonly sourceCategory?: ApertureReferenceSourceCategory | "any";
  readonly minScore?: number;
}

export interface ApertureReferenceSearchResult {
  readonly chunkId: string;
  readonly file: string;
  readonly kind: ApertureReferenceEntry["kind"];
  readonly sourceCategory: ApertureReferenceSourceCategory;
  readonly chunkType: ApertureReferenceChunkType;
  readonly score: number;
  readonly semanticScore: number;
  readonly symbol: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly symbols: readonly string[];
  readonly components: readonly string[];
  readonly systems: readonly string[];
  readonly diagnostics: readonly string[];
  readonly snippet: string;
}

export interface ApertureReferenceSearchReport {
  readonly indexFile: string;
  readonly query: string;
  readonly total: number;
  readonly results: readonly ApertureReferenceSearchResult[];
}
