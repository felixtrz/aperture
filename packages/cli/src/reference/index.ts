export { buildApertureReferenceIndex } from "./build.js";
export {
  APERTURE_REFERENCE_ASSETS_BASE_URL_ENV,
  APERTURE_REFERENCE_ASSETS_PACKAGE,
  APERTURE_REFERENCE_ASSETS_VERSION_ENV,
  getApertureReferenceAssetsBaseUrls,
  getApertureReferenceAssetsPackageVersion,
} from "./assets.js";
export type {
  ApertureReferenceChunk,
  ApertureReferenceChunkMetadata,
  ApertureReferenceChunkType,
  ApertureReferenceEntry,
  ApertureReferenceIndex,
  ApertureReferenceManifest,
  ApertureReferenceModelContract,
  ApertureReferenceSearchReport,
  ApertureReferenceSearchResult,
  ApertureReferenceSource,
  ApertureReferenceStatusReport,
  BuildApertureReferenceIndexOptions,
  BuildApertureReferenceIndexReport,
  SearchApertureReferencesOptions,
  WarmApertureReferenceOptions,
  WarmApertureReferenceReport,
} from "./contracts.js";
export { ensureApertureReferenceIndex } from "./index-io.js";
export { disposeReferenceEmbeddingServices } from "./embedding.js";
export {
  apertureReferenceArchiveFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
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
export { APERTURE_REFERENCE_TOOL_CONTRACT } from "./tools.js";
export { readApertureReferenceStatus } from "./status.js";
export { warmApertureReferences } from "./warm.js";
