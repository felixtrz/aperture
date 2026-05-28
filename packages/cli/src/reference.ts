import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import { Project, ScriptTarget } from "ts-morph";
import {
  ARCHIVE_FILE,
  DATA_DIRECTORY,
  MANIFEST_FILE,
  MODEL_CONTRACT_FILE,
  MODEL_DIRECTORY,
  apertureReferenceArchiveFile,
  apertureReferenceDataDir,
  apertureReferenceEmbeddingsFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceModelDir,
  apertureReferenceRuntimeDir,
  apertureReferenceStateFile,
} from "./reference-paths.js";
export {
  APERTURE_REFERENCE_TOOL_CONTRACT,
  type ApertureReferenceToolContract,
} from "./reference-tools.js";
import {
  EMBEDDING_DIMENSIONS,
  embedReferenceText,
} from "./reference-embedding.js";
import {
  chunkReferenceSource,
  type RawReferenceChunk,
} from "./reference-chunking.js";
import {
  findReferenceDependentsInIndex,
  searchReferenceIndex,
} from "./reference-search.js";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
} from "./reference-source-collection.js";
import { type ApertureReferenceSourceCategory } from "./reference-source-filter.js";
export {
  apertureReferenceArchiveFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceRuntimeDir,
  apertureReferenceStateFile,
} from "./reference-paths.js";
export type { ApertureReferenceSourceCategory } from "./reference-source-filter.js";

const INDEX_VERSION = 2;
const CORPUS_SCHEMA_VERSION = 1;
const MANIFEST_SCHEMA_VERSION = 1;
const MAX_INDEXED_FILE_BYTES = 420_000;
const SOURCES_DIRECTORY = "sources";
const DEFAULT_CORPUS_NAME = "aperture-developer-api";

const MODEL_CONTRACT: ApertureReferenceModelContract = {
  provider: "aperture-local",
  model: "aperture-reference-hash-embedding",
  revision: "v1",
  dimensions: EMBEDDING_DIMENSIONS,
  dtype: "float32",
  pooling: "hashed-token-sum",
  normalize: true,
  textFormattingVersion: 1,
  expectedFiles: [MODEL_CONTRACT_FILE],
};

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
  readonly model: string;
  readonly revision: string;
  readonly dimensions: number;
  readonly dtype: "float32";
  readonly pooling: string;
  readonly normalize: boolean;
  readonly textFormattingVersion: number;
  readonly expectedFiles: readonly string[];
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

interface ReadIndexOptions {
  readonly allowBuild?: boolean;
}

export async function buildApertureReferenceIndex(
  options: BuildApertureReferenceIndexOptions,
): Promise<BuildApertureReferenceIndexReport> {
  const root = path.resolve(options.cwd);
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const dataDir = apertureReferenceDataDir(root);
  const modelDir = apertureReferenceModelDir(root);
  const sourcesDir = path.join(dataDir, SOURCES_DIRECTORY);
  const indexFile = apertureReferenceIndexFile(root);
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);

  await rm(dataDir, { force: true, recursive: true });
  await rm(modelDir, { force: true, recursive: true });
  await rm(archiveFile, { force: true });
  await mkdir(sourcesDir, { recursive: true });
  await mkdir(modelDir, { recursive: true });

  const { sources, chunks } = await ingestApertureReferenceCorpus(root);
  const embeddedChunks = chunks.map((chunk) => {
    const semanticLabels = createSemanticLabels(chunk);
    const metadata: ApertureReferenceChunkMetadata = {
      ...chunk.metadata,
      semanticLabels,
    };
    const embeddingText = embeddingTextForChunk(metadata, chunk.content);

    return {
      id: chunkId(metadata),
      content: chunk.content,
      embeddingText,
      embedding: embedReferenceText(embeddingText),
      metadata,
    };
  });
  const entries = createReferenceEntries(sources, embeddedChunks);
  const createdAt = new Date().toISOString();
  const manifestBase: ApertureReferenceManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    indexVersion: INDEX_VERSION,
    corpus: {
      name: DEFAULT_CORPUS_NAME,
      root,
      generatedAt: createdAt,
      chunks: embeddedChunks.length,
      sources: sources.length,
    },
    model: MODEL_CONTRACT,
    files: [],
  };
  const indexWithoutManifestFiles: ApertureReferenceIndex = {
    version: INDEX_VERSION,
    schemaVersion: CORPUS_SCHEMA_VERSION,
    root,
    createdAt,
    model: MODEL_CONTRACT,
    manifest: manifestBase,
    entries,
    chunks: embeddedChunks,
    sources,
  };
  const embeddingsFile = apertureReferenceEmbeddingsFile(root);
  const modelContractFile = path.join(modelDir, MODEL_CONTRACT_FILE);

  await writeFile(
    embeddingsFile,
    `${JSON.stringify(indexWithoutManifestFiles, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    modelContractFile,
    `${JSON.stringify(MODEL_CONTRACT, null, 2)}\n`,
    "utf8",
  );

  for (const source of sources) {
    const destination = path.join(sourcesDir, source.file);

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, source.text, "utf8");
  }

  const files = await manifestFiles(runtimeDir, [
    DATA_DIRECTORY,
    MODEL_DIRECTORY,
  ]);
  const manifestWithoutArchive: ApertureReferenceManifest = {
    ...manifestBase,
    files,
  };

  await writeFile(
    manifestFile,
    `${JSON.stringify(manifestWithoutArchive, null, 2)}\n`,
    "utf8",
  );
  await tar.c(
    {
      cwd: runtimeDir,
      file: archiveFile,
      gzip: true,
      portable: true,
    },
    [DATA_DIRECTORY, MODEL_DIRECTORY],
  );

  const archive = await fileManifest(runtimeDir, archiveFile);
  const manifest: ApertureReferenceManifest = {
    ...manifestBase,
    files,
    archive,
  };
  const index: ApertureReferenceIndex = {
    ...indexWithoutManifestFiles,
    manifest,
  };

  await writeFile(
    manifestFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await syncSharedReferenceCache(root);
  await writeReferenceState(root, {
    source: "workspace",
    status: "ready",
    updatedAt: createdAt,
    manifest,
  });

  return {
    indexFile,
    manifestFile,
    archiveFile,
    dataDir,
    modelDir,
    entries: entries.length,
    chunks: embeddedChunks.length,
    sources: sources.length,
    root,
  };
}

export async function warmApertureReferences(
  options: WarmApertureReferenceOptions,
): Promise<WarmApertureReferenceReport> {
  const root = path.resolve(options.cwd);

  if (options.from === undefined || options.from === "workspace") {
    const report = await buildApertureReferenceIndex({ cwd: root });

    return {
      ...report,
      source: "workspace",
      stateFile: apertureReferenceStateFile(root),
    };
  }

  if (isHttpUrl(options.from)) {
    await warmFromUrl(root, options.from);
    const index = await readApertureReferenceIndex(root);

    return warmupReportFromIndex(root, index, "url");
  }

  await warmFromDirectory(root, path.resolve(root, options.from));
  const index = await readApertureReferenceIndex(root);

  return warmupReportFromIndex(root, index, "directory");
}

export async function readApertureReferenceStatus(
  cwd: string,
): Promise<ApertureReferenceStatusReport> {
  const root = path.resolve(cwd);
  const indexFile = apertureReferenceIndexFile(root);
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);
  const stateFile = apertureReferenceStateFile(root);
  const diagnostics: ApertureReferenceStatusDiagnostic[] = [];
  let corruptIndex = false;

  let index: ApertureReferenceIndex | null = null;

  if (!(await fileExists(indexFile))) {
    diagnostics.push({
      code: "aperture.reference.indexMissing",
      message: `Aperture reference corpus is not warmed. Missing ${indexFile}.`,
      file: indexFile,
      suggestedFix: "Run 'aperture reference warmup'.",
    });
  } else {
    try {
      index = await readApertureReferenceIndex(root, { allowBuild: false });
    } catch (error: unknown) {
      corruptIndex = true;
      diagnostics.push({
        code: "aperture.reference.indexCorrupt",
        message: error instanceof Error ? error.message : String(error),
        file: indexFile,
        suggestedFix: "Run 'aperture reference warmup'.",
      });
    }
  }

  if (index !== null && !sameModelContract(index.model, MODEL_CONTRACT)) {
    diagnostics.push({
      code: "aperture.reference.modelMismatch",
      message:
        "The warmed reference corpus was produced with a different embedding model contract.",
      file: indexFile,
      suggestedFix: "Run 'aperture reference warmup' to rebuild the corpus.",
    });
  }

  if (index !== null) {
    diagnostics.push(...(await validateManifest(root, index.manifest)));
  }

  const modelMismatch = diagnostics.some(
    (diagnostic) => diagnostic.code === "aperture.reference.modelMismatch",
  );
  const ok = index !== null && diagnostics.length === 0;

  return {
    ok,
    status:
      index === null
        ? corruptIndex
          ? "corrupt"
          : "missing"
        : modelMismatch
          ? "model-mismatch"
          : ok
            ? "ready"
            : "corrupt",
    root,
    indexFile,
    manifestFile,
    archiveFile,
    stateFile,
    chunks: index?.chunks.length ?? 0,
    sources: index?.sources.length ?? 0,
    model: index?.model ?? MODEL_CONTRACT,
    diagnostics,
  };
}

export async function searchApertureReferences(
  options: SearchApertureReferencesOptions,
): Promise<ApertureReferenceSearchReport> {
  const index = await readApertureReferenceIndex(options.cwd);
  const report = searchReferenceIndex(index, options);

  return {
    indexFile: apertureReferenceIndexFile(path.resolve(options.cwd)),
    ...report,
  };
}

export async function readApertureReferenceFile(
  cwd: string,
  file: string,
  options: { readonly startLine?: number; readonly endLine?: number } = {},
): Promise<ApertureReferenceEntry | null> {
  const index = await readApertureReferenceIndex(cwd);
  const root = path.resolve(cwd);
  const normalized = normalizePath(file);
  const source = index.sources.find((entry) => entry.file === normalized);

  if (source === undefined) {
    return null;
  }

  const warmedText = await readWarmedSourceFile(root, normalized, source.text);
  const text =
    options.startLine === undefined && options.endLine === undefined
      ? warmedText
      : sliceLines(warmedText, options.startLine, options.endLine);
  const chunks = index.chunks.filter(
    (chunk) => chunk.metadata.file === normalized,
  );

  return {
    file: source.file,
    bytes: source.bytes,
    kind: entryKind(source.file, source.sourceCategory),
    sourceCategory: source.sourceCategory,
    symbols: uniqueSorted(chunks.map((chunk) => chunk.metadata.name)),
    components: uniqueSorted(
      chunks.flatMap((chunk) => chunk.metadata.componentIds),
    ),
    systems: uniqueSorted(
      chunks.flatMap((chunk) => chunk.metadata.systemNames),
    ),
    diagnostics: uniqueSorted(
      chunks.flatMap((chunk) => chunk.metadata.diagnostics),
    ),
    text,
    chunks: chunks.map((chunk) => chunk.id),
  };
}

export async function listApertureReferenceComponents(
  cwd: string,
): Promise<readonly string[]> {
  const index = await readApertureReferenceIndex(cwd);

  return uniqueSorted(
    index.chunks.flatMap((chunk) => chunk.metadata.componentIds),
  );
}

export async function listApertureReferenceSystems(
  cwd: string,
): Promise<readonly string[]> {
  const index = await readApertureReferenceIndex(cwd);

  return uniqueSorted(
    index.chunks.flatMap((chunk) => chunk.metadata.systemNames),
  );
}

export async function findApertureReferenceDependents(options: {
  readonly cwd: string;
  readonly symbol: string;
  readonly limit?: number;
}): Promise<ApertureReferenceSearchReport> {
  const index = await readApertureReferenceIndex(options.cwd);
  const report = findReferenceDependentsInIndex(index, options);

  return {
    indexFile: apertureReferenceIndexFile(path.resolve(options.cwd)),
    ...report,
  };
}

export async function ensureApertureReferenceIndex(
  cwd: string,
): Promise<ApertureReferenceIndex> {
  return readApertureReferenceIndex(cwd, { allowBuild: true });
}

async function ingestApertureReferenceCorpus(root: string): Promise<{
  readonly sources: readonly ApertureReferenceSource[];
  readonly chunks: readonly RawReferenceChunk[];
}> {
  const packageExports = await discoverPackageExportInfo(root);
  const candidates = await collectCandidateSources(root, packageExports);
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      target: ScriptTarget.ES2022,
    },
  });
  const sources: ApertureReferenceSource[] = [];
  const chunks: RawReferenceChunk[] = [];

  for (const candidate of candidates) {
    const fileStat = await stat(candidate.absoluteFile);

    if (fileStat.size > MAX_INDEXED_FILE_BYTES) {
      continue;
    }

    const text = await readFile(candidate.absoluteFile, "utf8");
    const source: ApertureReferenceSource = {
      file: candidate.file,
      bytes: Buffer.byteLength(text, "utf8"),
      sha256: sha256(text),
      text,
      sourceCategory: candidate.sourceCategory,
    };

    sources.push(source);

    chunks.push(...chunkReferenceSource(project, candidate, text));
  }

  return {
    sources: sources.sort((a, b) => a.file.localeCompare(b.file)),
    chunks: chunks.sort(
      (a, b) =>
        a.metadata.file.localeCompare(b.metadata.file) ||
        a.metadata.startLine - b.metadata.startLine,
    ),
  };
}

function createSemanticLabels(chunk: RawReferenceChunk): readonly string[] {
  return uniqueSorted([
    chunk.metadata.sourceCategory,
    chunk.metadata.chunkType,
    chunk.metadata.name,
    chunk.metadata.file,
    ...(chunk.metadata.semanticLabels ?? []),
    ...chunk.metadata.componentIds,
    ...chunk.metadata.systemNames,
    ...chunk.metadata.diagnostics,
  ]);
}

function createReferenceEntries(
  sources: readonly ApertureReferenceSource[],
  chunks: readonly ApertureReferenceChunk[],
): readonly ApertureReferenceEntry[] {
  return sources.map((source) => {
    const sourceChunks = chunks.filter(
      (chunk) => chunk.metadata.file === source.file,
    );

    return {
      file: source.file,
      bytes: source.bytes,
      kind: entryKind(source.file, source.sourceCategory),
      sourceCategory: source.sourceCategory,
      symbols: uniqueSorted(sourceChunks.map((chunk) => chunk.metadata.name)),
      components: uniqueSorted(
        sourceChunks.flatMap((chunk) => chunk.metadata.componentIds),
      ),
      systems: uniqueSorted(
        sourceChunks.flatMap((chunk) => chunk.metadata.systemNames),
      ),
      diagnostics: uniqueSorted(
        sourceChunks.flatMap((chunk) => chunk.metadata.diagnostics),
      ),
      text: source.text,
      chunks: sourceChunks.map((chunk) => chunk.id),
    };
  });
}

function embeddingTextForChunk(
  metadata: ApertureReferenceChunkMetadata,
  content: string,
): string {
  return [
    `# ${metadata.chunkType}: ${metadata.name}`,
    `source: ${metadata.sourceCategory}`,
    metadata.packageName === undefined
      ? ""
      : `package: ${metadata.packageName}`,
    metadata.entrypoint === undefined
      ? ""
      : `entrypoint: ${metadata.entrypoint}`,
    `file: ${metadata.file}`,
    `lines: ${metadata.startLine}-${metadata.endLine}`,
    metadata.classContext === undefined
      ? ""
      : `class: ${metadata.classContext}`,
    metadata.semanticLabels.length === 0
      ? ""
      : `labels: ${metadata.semanticLabels.join(", ")}`,
    metadata.imports.length === 0
      ? ""
      : `imports: ${metadata.imports.join(", ")}`,
    metadata.exports.length === 0
      ? ""
      : `exports: ${metadata.exports.join(", ")}`,
    metadata.calls.length === 0 ? "" : `calls: ${metadata.calls.join(", ")}`,
    metadata.extends.length === 0
      ? ""
      : `extends: ${metadata.extends.join(", ")}`,
    metadata.implements.length === 0
      ? ""
      : `implements: ${metadata.implements.join(", ")}`,
    metadata.componentIds.length === 0
      ? ""
      : `components: ${metadata.componentIds.join(", ")}`,
    metadata.systemNames.length === 0
      ? ""
      : `systems: ${metadata.systemNames.join(", ")}`,
    metadata.systemPriority === undefined
      ? ""
      : `system priority: ${metadata.systemPriority}`,
    metadata.diagnostics.length === 0
      ? ""
      : `diagnostics: ${metadata.diagnostics.join(", ")}`,
    "",
    content,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

async function readApertureReferenceIndex(
  cwd: string,
  options: ReadIndexOptions = { allowBuild: false },
): Promise<ApertureReferenceIndex> {
  const root = path.resolve(cwd);
  const indexFile = apertureReferenceIndexFile(root);

  try {
    const source = await readFile(indexFile, "utf8");
    const parsed = JSON.parse(source) as ApertureReferenceIndex;

    if (parsed.version !== INDEX_VERSION) {
      throw new Error(
        `Unsupported Aperture reference index version '${String(parsed.version)}'.`,
      );
    }

    return parsed;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT") && options.allowBuild === true) {
      await buildApertureReferenceIndex({ cwd: root });
      return readApertureReferenceIndex(root, { allowBuild: false });
    }

    if (isNodeErrorCode(error, "ENOENT")) {
      throw new Error(
        `Aperture reference corpus is not warmed. Run 'aperture reference warmup'. Missing ${indexFile}.`,
        { cause: error },
      );
    }

    throw error;
  }
}

async function warmFromDirectory(
  root: string,
  sourceDir: string,
): Promise<void> {
  const manifestSource = path.join(sourceDir, MANIFEST_FILE);
  const archiveSource = path.join(sourceDir, ARCHIVE_FILE);

  if (
    !(await fileExists(manifestSource)) ||
    !(await fileExists(archiveSource))
  ) {
    throw new Error(
      `Reference asset directory '${sourceDir}' must contain ${MANIFEST_FILE} and ${ARCHIVE_FILE}.`,
    );
  }

  await installPayload(root, manifestSource, archiveSource, "directory");
}

async function warmFromUrl(root: string, baseUrl: string): Promise<void> {
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const tempDir = path.join(runtimeDir, "download");

  await rm(tempDir, { force: true, recursive: true });
  await mkdir(tempDir, { recursive: true });

  const normalizedBaseUrl = baseUrl.replace(/\/$/u, "");
  const manifestFile = path.join(tempDir, MANIFEST_FILE);
  const archiveFile = path.join(tempDir, ARCHIVE_FILE);

  await downloadFile(`${normalizedBaseUrl}/${MANIFEST_FILE}`, manifestFile);
  await downloadFile(`${normalizedBaseUrl}/${ARCHIVE_FILE}`, archiveFile);
  await installPayload(root, manifestFile, archiveFile, "url");
  await rm(tempDir, { force: true, recursive: true });
}

async function installPayload(
  root: string,
  manifestSource: string,
  archiveSource: string,
  source: "directory" | "url",
): Promise<void> {
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const dataDir = apertureReferenceDataDir(root);
  const modelDir = apertureReferenceModelDir(root);
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);

  await mkdir(runtimeDir, { recursive: true });
  await rm(dataDir, { force: true, recursive: true });
  await rm(modelDir, { force: true, recursive: true });
  await copyFile(manifestSource, manifestFile);
  await copyFile(archiveSource, archiveFile);
  await tar.x({ cwd: runtimeDir, file: archiveFile });

  const indexSource = apertureReferenceEmbeddingsFile(root);
  const indexFile = apertureReferenceIndexFile(root);
  const index = JSON.parse(
    await readFile(indexSource, "utf8"),
  ) as ApertureReferenceIndex;
  const manifest = JSON.parse(
    await readFile(manifestFile, "utf8"),
  ) as ApertureReferenceManifest;
  const diagnostics = await validateManifest(root, manifest);

  if (diagnostics.length > 0) {
    throw new Error(
      `Reference payload validation failed: ${diagnostics
        .map((diagnostic) => diagnostic.message)
        .join("; ")}`,
    );
  }

  await writeFile(
    indexFile,
    `${JSON.stringify({ ...index, manifest }, null, 2)}\n`,
    "utf8",
  );
  await syncSharedReferenceCache(root);
  await writeReferenceState(root, {
    source,
    status: "ready",
    updatedAt: new Date().toISOString(),
    manifest,
  });
}

async function writeReferenceState(
  root: string,
  state: {
    readonly source: "workspace" | "directory" | "url";
    readonly status: "ready";
    readonly updatedAt: string;
    readonly manifest: ApertureReferenceManifest;
  },
): Promise<void> {
  const stateFile = apertureReferenceStateFile(root);

  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function syncSharedReferenceCache(root: string): Promise<void> {
  const sharedDir = apertureReferenceSharedCacheDir();
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);

  await mkdir(sharedDir, { recursive: true });

  if (await fileExists(manifestFile)) {
    await copyFile(manifestFile, path.join(sharedDir, MANIFEST_FILE));
  }

  if (await fileExists(archiveFile)) {
    await copyFile(archiveFile, path.join(sharedDir, ARCHIVE_FILE));
  }
}

async function validateManifest(
  root: string,
  manifest: ApertureReferenceManifest,
): Promise<readonly ApertureReferenceStatusDiagnostic[]> {
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const diagnostics: ApertureReferenceStatusDiagnostic[] = [];

  if (!sameModelContract(manifest.model, MODEL_CONTRACT)) {
    diagnostics.push({
      code: "aperture.reference.modelMismatch",
      message:
        "The manifest model contract does not match the CLI query model contract.",
      suggestedFix: "Run 'aperture reference warmup' with a matching payload.",
    });
  }

  for (const file of manifest.files) {
    const absoluteFile = path.join(runtimeDir, file.path);

    if (!(await fileExists(absoluteFile))) {
      diagnostics.push({
        code: "aperture.reference.fileMissing",
        message: `Reference payload file '${file.path}' is missing.`,
        file: absoluteFile,
        suggestedFix: "Run 'aperture reference warmup' to repair the cache.",
      });
      continue;
    }

    const actual = await fileManifest(runtimeDir, absoluteFile);

    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) {
      diagnostics.push({
        code: "aperture.reference.fileCorrupt",
        message: `Reference payload file '${file.path}' does not match the manifest hash.`,
        file: absoluteFile,
        suggestedFix: "Run 'aperture reference warmup' to repair the cache.",
      });
    }
  }

  return diagnostics;
}

async function manifestFiles(
  runtimeDir: string,
  relativeRoots: readonly string[],
): Promise<readonly ApertureReferenceManifestFile[]> {
  const files: ApertureReferenceManifestFile[] = [];

  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.join(runtimeDir, relativeRoot);

    for (const file of await collectManifestFiles(absoluteRoot)) {
      files.push(await fileManifest(runtimeDir, file));
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function collectManifestFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }

  await visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

async function fileManifest(
  root: string,
  file: string,
): Promise<ApertureReferenceManifestFile> {
  const buffer = await readFile(file);

  return {
    path: normalizePath(path.relative(root, file)),
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

function warmupReportFromIndex(
  root: string,
  index: ApertureReferenceIndex,
  source: "directory" | "url",
): WarmApertureReferenceReport {
  return {
    indexFile: apertureReferenceIndexFile(root),
    manifestFile: apertureReferenceManifestFile(root),
    archiveFile: apertureReferenceArchiveFile(root),
    dataDir: apertureReferenceDataDir(root),
    modelDir: apertureReferenceModelDir(root),
    entries: index.entries.length,
    chunks: index.chunks.length,
    sources: index.sources.length,
    root,
    source,
    stateFile: apertureReferenceStateFile(root),
  };
}

async function downloadFile(url: string, destination: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(destination, buffer);
}

function chunkId(metadata: ApertureReferenceChunkMetadata): string {
  return sha256(
    [
      metadata.sourceCategory,
      metadata.file,
      metadata.startLine,
      metadata.endLine,
      metadata.chunkType,
      metadata.name,
    ].join(":"),
  ).slice(0, 24);
}

function entryKind(
  file: string,
  sourceCategory: ApertureReferenceSourceCategory,
): ApertureReferenceEntry["kind"] {
  switch (sourceCategory) {
    case "docs":
      return "doc";
    case "example":
      return "example";
    case "external":
      return "reference";
    case "api":
    case "diagnostic":
      return "source";
    case "template":
      return file.endsWith(".ts") ? "source" : "other";
  }
}

function sliceLines(
  text: string,
  startLine: number | undefined,
  endLine: number | undefined,
): string {
  const lines = text.split(/\r?\n/u);
  const start = Math.max(1, startLine ?? 1);
  const end = Math.min(lines.length, endLine ?? lines.length);

  return lines.slice(start - 1, end).join("\n");
}

async function readWarmedSourceFile(
  root: string,
  file: string,
  fallback: string,
): Promise<string> {
  const sourceFile = path.join(
    apertureReferenceDataDir(root),
    SOURCES_DIRECTORY,
    file,
  );

  try {
    return await readFile(sourceFile, "utf8");
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return fallback;
    }

    throw error;
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameModelContract(
  a: ApertureReferenceModelContract,
  b: ApertureReferenceModelContract,
): boolean {
  return (
    a.provider === b.provider &&
    a.model === b.model &&
    a.revision === b.revision &&
    a.dimensions === b.dimensions &&
    a.dtype === b.dtype &&
    a.pooling === b.pooling &&
    a.normalize === b.normalize &&
    a.textFormattingVersion === b.textFormattingVersion
  );
}

function normalizePath(file: string): string {
  return file.split(path.sep).join("/");
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}

async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function apertureReferenceSharedCacheDir(): string {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Caches",
      "aperture",
      "reference",
    );
  }

  if (process.platform === "win32") {
    return path.join(
      process.env["LOCALAPPDATA"] ?? os.tmpdir(),
      "aperture",
      "reference",
    );
  }

  return path.join(
    process.env["XDG_CACHE_HOME"] ?? path.join(os.homedir(), ".cache"),
    "aperture",
    "reference",
  );
}
