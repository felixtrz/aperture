export { buildApertureReferenceIndex } from "./build.js";
export type {
  ApertureReferenceChunk,
  ApertureReferenceChunkMetadata,
  ApertureReferenceChunkType,
  ApertureReferenceEntry,
  ApertureReferenceIndex,
  ApertureReferenceManifest,
  ApertureReferenceManifestFile,
  ApertureReferenceModelContract,
  ApertureReferenceSearchReport,
  ApertureReferenceSearchResult,
  ApertureReferenceSource,
  ApertureReferenceStatusDiagnostic,
  ApertureReferenceStatusReport,
  BuildApertureReferenceIndexOptions,
  BuildApertureReferenceIndexReport,
  SearchApertureReferencesOptions,
  WarmApertureReferenceOptions,
  WarmApertureReferenceReport,
} from "./contracts.js";
export { ensureApertureReferenceIndex } from "./index-io.js";
export {
  apertureReferenceArchiveFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceRuntimeDir,
  apertureReferenceStateFile,
} from "./paths.js";
export {
  findApertureReferenceDependents,
  searchApertureReferences,
} from "./query.js";
export {
  listApertureReferenceComponents,
  listApertureReferenceSystems,
  readApertureReferenceFile,
} from "./read.js";
export type { ApertureReferenceSourceCategory } from "./source-filter.js";
export { apertureReferenceSharedCacheDir } from "./state.js";
export {
  APERTURE_REFERENCE_TOOL_CONTRACT,
  type ApertureReferenceToolContract,
} from "./tools.js";
export { readApertureReferenceStatus } from "./status.js";
export { warmApertureReferences } from "./warm.js";
