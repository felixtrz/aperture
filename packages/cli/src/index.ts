export {
  ApertureCliError,
  createApertureProject,
  runApertureCli,
  syncApertureAdapters,
  type ApertureCliIo,
  type CreateApertureProjectOptions,
  type CreateApertureProjectReport,
  type RunApertureCliOptions,
  type SyncApertureAdapterConflict,
  type SyncApertureAdaptersOptions,
  type SyncApertureAdaptersReport,
} from "./cli.js";
export {
  ApertureDevSessionError,
  openApertureDevSession,
  parseApertureGpuMode,
  readApertureDevLogs,
  readApertureDevStatus,
  resolveApertureDevServerPort,
  resolveApertureGpu,
  runApertureDevSessionDaemon,
  startApertureDevSession,
  stopApertureDevSession,
  swiftShaderArgs,
  type ApertureDevDaemonOptions,
  type ApertureDevDownOptions,
  type ApertureDevDownReport,
  type ApertureDevLogsOptions,
  type ApertureDevLogsReport,
  type ApertureDevUpOptions,
  type ApertureDevUpReport,
  type ApertureGpuMode,
  type ResolveApertureGpuOptions,
  type ResolvedApertureGpu,
  type ResolveApertureDevServerPortOptions,
} from "./dev-session.js";
export {
  callApertureTool,
  type ApertureToolCallOptions,
} from "./devtools-client.js";
export {
  loadApertureHeadlessApp,
  type LoadApertureHeadlessAppOptions,
  type LoadedApertureHeadlessApp,
} from "./headless/config-loader.js";
export {
  createNodeApertureAssetLoader,
  type NodeAssetLoaderMode,
} from "./headless/node-asset-loader.js";
export {
  applyApertureHeadlessInjectStep,
  parseApertureHeadlessInject,
  type ApertureHeadlessInjectStep,
} from "./headless/inject.js";
export {
  APERTURE_SNAPSHOT_BUNDLE_FORMAT,
  APERTURE_SNAPSHOT_BUNDLE_VERSION,
  createApertureSnapshotBundle,
  type ApertureAssetProvenance,
  type ApertureSnapshotBundle,
} from "./headless/bundle.js";
export { runHeadlessCommand } from "./commands/headless.js";
export { runHeadlessServeCommand } from "./commands/headless-serve.js";
export { runRenderCommand } from "./commands/render.js";
export {
  renderBundleToPng,
  renderHarnessHtml,
  type RenderBundleResult,
} from "./render/driver.js";
export {
  resolveEnginePackages,
  type EngineMount,
  type ResolvedEnginePackages,
} from "./render/resolve-engine-packages.js";
export {
  startApertureStaticServer,
  type ApertureStaticServer,
  type StaticMount,
} from "./render/static-server.js";
export {
  isPngBlank,
  summarizePngLuma,
  type PngLumaSummary,
} from "./tools/png-readback.js";
export {
  runApertureMcpServer,
  type RunApertureMcpServerOptions,
} from "./mcp.js";
export {
  APERTURE_REFERENCE_TOOL_CONTRACT,
  APERTURE_REFERENCE_ASSETS_BASE_URL_ENV,
  APERTURE_REFERENCE_ASSETS_PACKAGE,
  APERTURE_REFERENCE_ASSETS_VERSION_ENV,
  apertureReferenceArchiveFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceSharedCacheDir,
  apertureReferenceStateFile,
  buildApertureReferenceIndex,
  disposeReferenceEmbeddingServices,
  ensureApertureReferenceIndex,
  findApertureReferenceDependents,
  getApertureReferenceAssetsBaseUrls,
  getApertureReferenceAssetsPackageVersion,
  listApertureReferenceComponents,
  listApertureReferenceSystems,
  readApertureReferenceFile,
  readApertureReferenceStatus,
  searchApertureReferences,
  warmApertureReferences,
  type ApertureReferenceChunk,
  type ApertureReferenceChunkMetadata,
  type ApertureReferenceChunkType,
  type ApertureReferenceEntry,
  type ApertureReferenceIndex,
  type ApertureReferenceManifest,
  type ApertureReferenceModelContract,
  type ApertureReferenceSearchReport,
  type ApertureReferenceSearchResult,
  type ApertureReferenceSource,
  type ApertureReferenceSourceCategory,
  type ApertureReferenceStatusReport,
  type BuildApertureReferenceIndexOptions,
  type BuildApertureReferenceIndexReport,
  type SearchApertureReferencesOptions,
  type WarmApertureReferenceOptions,
  type WarmApertureReferenceReport,
} from "./reference.js";
export {
  APERTURE_DEVTOOLS_PROTOCOL_VERSION,
  APERTURE_RUNTIME_DIRECTORY,
  APERTURE_SESSION_FILE,
  apertureRuntimeDir,
  apertureSessionFile,
  clearApertureDevSession,
  createApertureDevSession,
  isProcessAlive,
  readApertureDevSession,
  readApertureDevSessionStatus,
  writeApertureDevSession,
  type ApertureDevSession,
  type ApertureDevSessionBrowser,
  type ApertureDevSessionBridge,
  type ApertureDevSessionLogFiles,
  type ApertureDevSessionProcess,
  type ApertureDevSessionStatus,
  type ApertureProcessState,
} from "./session.js";
