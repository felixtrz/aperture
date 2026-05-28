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
import {
  Node,
  Project,
  ScriptTarget,
  SyntaxKind,
  type ClassDeclaration,
  type Node as MorphNode,
  type SourceFile,
} from "ts-morph";
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
  cosineSimilarity,
  embedReferenceText,
  tokenizeReferenceText,
} from "./reference-embedding.js";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
  type CandidateSource,
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
const DEFAULT_LIMIT = 10;
const MAX_INDEXED_FILE_BYTES = 420_000;
const MAX_WHOLE_FILE_CHUNK_BYTES = 18_000;
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

interface RawReferenceChunk {
  readonly content: string;
  readonly metadata: Omit<ApertureReferenceChunkMetadata, "semanticLabels"> & {
    readonly semanticLabels?: readonly string[];
  };
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
  const query = options.query.trim();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const sourceCategory = referenceSourceCategory(options);
  const queryEmbedding = embedReferenceText(query);
  const tokens = tokenizeReferenceText(query);
  const minScore = options.minScore ?? 0;
  const results = index.chunks
    .filter(
      (chunk) =>
        sourceCategory === "any" ||
        chunk.metadata.sourceCategory === sourceCategory,
    )
    .map((chunk) => scoreChunk(index, chunk, query, tokens, queryEmbedding))
    .filter(
      (result): result is ApertureReferenceSearchResult =>
        result !== null && result.score >= minScore,
    )
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, limit);

  return {
    indexFile: apertureReferenceIndexFile(path.resolve(options.cwd)),
    query,
    total: results.length,
    results,
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
  const symbol = options.symbol.trim();
  const symbolLower = symbol.toLowerCase();
  const limit = options.limit ?? DEFAULT_LIMIT;
  const results = index.chunks
    .map((chunk) => {
      const metadata = chunk.metadata;
      const relationshipValues = [
        ...metadata.imports,
        ...metadata.calls,
        ...metadata.extends,
        ...metadata.implements,
        ...metadata.usesTypes,
      ].map((value) => value.toLowerCase());

      if (!relationshipValues.some((value) => value.includes(symbolLower))) {
        return null;
      }

      const entry = entryForFile(index, metadata.file);

      return resultForChunk({
        chunk,
        entry,
        semanticScore: 1,
        score: 1.5,
        snippet: snippetForQuery(chunk.content, tokenizeReferenceText(symbol)),
      });
    })
    .filter(
      (result): result is ApertureReferenceSearchResult => result !== null,
    )
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, limit);

  return {
    indexFile: apertureReferenceIndexFile(path.resolve(options.cwd)),
    query: symbol,
    total: results.length,
    results,
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

    if (candidate.file.endsWith(".md")) {
      chunks.push(...chunkMarkdown(candidate, text));
      continue;
    }

    if (isTypeScriptLike(candidate.file)) {
      chunks.push(...chunkTypeScript(project, candidate, text));
      continue;
    }

    chunks.push(wholeFileChunk(candidate, text));
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

function chunkMarkdown(
  candidate: CandidateSource,
  text: string,
): readonly RawReferenceChunk[] {
  const lines = text.split(/\r?\n/u);
  const headingLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^#{1,6}\s+/u.test(line));

  if (headingLines.length === 0) {
    return [wholeFileChunk(candidate, text)];
  }

  return headingLines.map((heading, index) => {
    const nextHeading = headingLines[index + 1];
    const endLine = nextHeading?.index ?? lines.length;
    const content = lines.slice(heading.index, endLine).join("\n").trim();
    const name = heading.line.replace(/^#{1,6}\s+/u, "").trim();

    return {
      content,
      metadata: baseMetadata(candidate, {
        chunkType: "doc-section",
        name,
        startLine: heading.index + 1,
        endLine,
        exports: [],
        semanticLabels: ["docs", "markdown", ...labelWords(name)],
      }),
    };
  });
}

function chunkTypeScript(
  project: Project,
  candidate: CandidateSource,
  text: string,
): readonly RawReferenceChunk[] {
  let sourceFile: SourceFile;

  try {
    sourceFile =
      project.getSourceFile(candidate.absoluteFile) ??
      project.addSourceFileAtPath(candidate.absoluteFile);
  } catch {
    return [wholeFileChunk(candidate, text)];
  }

  const chunks: RawReferenceChunk[] = [];
  const exportedDeclarations = sourceFile.getExportedDeclarations();

  for (const [exportedName, declarations] of exportedDeclarations) {
    for (const declaration of declarations) {
      chunks.push(
        chunkDeclaration(candidate, sourceFile, declaration, exportedName),
      );
    }
  }

  if (chunks.length === 0 || isGeneratedSystemFile(candidate.file)) {
    chunks.push(...systemClassChunks(candidate, sourceFile));
  }

  for (const diagnostic of diagnosticChunks(candidate, text)) {
    chunks.push(diagnostic);
  }

  if (chunks.length === 0) {
    chunks.push(wholeFileChunk(candidate, text));
  }

  return dedupeChunks(chunks);
}

function chunkDeclaration(
  candidate: CandidateSource,
  sourceFile: SourceFile,
  declaration: MorphNode,
  exportedName: string,
): RawReferenceChunk {
  const content = declaration.getText();
  const name = declarationName(declaration, exportedName);
  const chunkType = chunkTypeForDeclaration(candidate, declaration, content);
  const metadata = metadataForNode(candidate, sourceFile, declaration, {
    chunkType,
    name,
    exportedName,
    content,
  });

  return { content, metadata };
}

function systemClassChunks(
  candidate: CandidateSource,
  sourceFile: SourceFile,
): readonly RawReferenceChunk[] {
  return sourceFile
    .getClasses()
    .filter(
      (declaration) =>
        declaration.getName()?.endsWith("System") === true ||
        declaration.getExtends()?.getText().includes("createSystem") === true ||
        candidate.file.endsWith(".system.ts"),
    )
    .map((declaration) => {
      const content = declaration.getText();
      const name =
        declaration.getName() ??
        path.basename(candidate.file, path.extname(candidate.file));

      return {
        content,
        metadata: metadataForNode(candidate, sourceFile, declaration, {
          chunkType: "system",
          name,
          exportedName: name,
          content,
        }),
      };
    });
}

function diagnosticChunks(
  candidate: CandidateSource,
  text: string,
): readonly RawReferenceChunk[] {
  const diagnostics = extractDiagnosticCodes(text);

  if (diagnostics.length === 0) {
    return [];
  }

  return diagnostics.map((code) => {
    const line = lineForOffset(text, text.indexOf(code));

    return {
      content: snippetAround(text, code, 900),
      metadata: baseMetadata(candidate, {
        chunkType: "diagnostic",
        name: code,
        startLine: line,
        endLine: line,
        diagnostics: [code],
        exports: [],
        semanticLabels: ["diagnostic", ...labelWords(code)],
      }),
    };
  });
}

function wholeFileChunk(
  candidate: CandidateSource,
  text: string,
): RawReferenceChunk {
  const content =
    Buffer.byteLength(text, "utf8") <= MAX_WHOLE_FILE_CHUNK_BYTES
      ? text
      : text.slice(0, MAX_WHOLE_FILE_CHUNK_BYTES);
  const chunkType: ApertureReferenceChunkType =
    candidate.sourceCategory === "example"
      ? "example"
      : candidate.sourceCategory === "template"
        ? "template"
        : candidate.sourceCategory === "docs"
          ? "doc-section"
          : "source";

  return {
    content,
    metadata: baseMetadata(candidate, {
      chunkType,
      name: path.basename(candidate.file),
      startLine: 1,
      endLine: content.split(/\r?\n/u).length,
      componentIds: extractComponentIds(text),
      systemNames: extractSystemNames(text, candidate.file),
      diagnostics: extractDiagnosticCodes(text),
      exports: extractExportNames(text),
      calls: extractCalls(text),
      semanticLabels: [
        candidate.sourceCategory,
        chunkType,
        ...labelWords(candidate.file),
      ],
    }),
  };
}

function metadataForNode(
  candidate: CandidateSource,
  sourceFile: SourceFile,
  node: MorphNode,
  input: {
    readonly chunkType: ApertureReferenceChunkType;
    readonly name: string;
    readonly exportedName: string;
    readonly content: string;
  },
): Omit<ApertureReferenceChunkMetadata, "semanticLabels"> & {
  readonly semanticLabels?: readonly string[];
} {
  const componentIds = extractComponentIds(input.content);
  const systemNames =
    input.chunkType === "system"
      ? uniqueSorted([
          input.name,
          ...extractSystemNames(input.content, candidate.file),
        ])
      : extractSystemNames(input.content, candidate.file);
  const diagnostics = extractDiagnosticCodes(input.content);
  const classContext = nearestClassName(node);
  const extendsValues = Node.isClassDeclaration(node)
    ? classExtends(node)
    : extractExtends(input.content);
  const implementsValues = Node.isClassDeclaration(node)
    ? classImplements(node)
    : [];
  const systemPriority = extractSystemPriority(input.content);

  return baseMetadata(candidate, {
    chunkType: input.chunkType,
    name: input.name,
    exportedName: input.exportedName,
    startLine: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
    ...(classContext === undefined ? {} : { classContext }),
    imports: sourceFile
      .getImportDeclarations()
      .flatMap((importDeclaration) => [
        importDeclaration.getModuleSpecifierValue(),
        ...importDeclaration
          .getNamedImports()
          .map((namedImport) => namedImport.getName()),
      ]),
    exports: [input.exportedName],
    calls: extractCalls(input.content),
    extends: extendsValues,
    implements: implementsValues,
    usesTypes: extractTypeLikeNames(input.content),
    componentIds,
    systemNames,
    ...(systemPriority === undefined ? {} : { systemPriority }),
    diagnostics,
    semanticLabels: uniqueSorted([
      candidate.sourceCategory,
      input.chunkType,
      input.name,
      input.exportedName,
      ...componentIds,
      ...systemNames,
      ...diagnostics,
      ...labelWords(candidate.file),
    ]),
  });
}

function baseMetadata(
  candidate: CandidateSource,
  input: {
    readonly chunkType: ApertureReferenceChunkType;
    readonly name: string;
    readonly exportedName?: string;
    readonly startLine: number;
    readonly endLine: number;
    readonly classContext?: string;
    readonly imports?: readonly string[];
    readonly exports?: readonly string[];
    readonly calls?: readonly string[];
    readonly extends?: readonly string[];
    readonly implements?: readonly string[];
    readonly usesTypes?: readonly string[];
    readonly componentIds?: readonly string[];
    readonly systemNames?: readonly string[];
    readonly systemPriority?: number;
    readonly diagnostics?: readonly string[];
    readonly semanticLabels?: readonly string[];
  },
): Omit<ApertureReferenceChunkMetadata, "semanticLabels"> & {
  readonly semanticLabels?: readonly string[];
} {
  return {
    sourceCategory:
      input.chunkType === "diagnostic"
        ? "diagnostic"
        : candidate.sourceCategory,
    ...(candidate.packageName === undefined
      ? {}
      : { packageName: candidate.packageName }),
    ...(candidate.entrypoint === undefined
      ? {}
      : { entrypoint: candidate.entrypoint }),
    file: candidate.file,
    chunkType: input.chunkType,
    name: input.name,
    ...(input.exportedName === undefined
      ? {}
      : { exportedName: input.exportedName }),
    startLine: input.startLine,
    endLine: input.endLine,
    ...(input.classContext === undefined
      ? {}
      : { classContext: input.classContext }),
    imports: uniqueSorted(input.imports ?? []),
    exports: uniqueSorted(input.exports ?? []),
    calls: uniqueSorted(input.calls ?? []),
    extends: uniqueSorted(input.extends ?? []),
    implements: uniqueSorted(input.implements ?? []),
    usesTypes: uniqueSorted(input.usesTypes ?? []),
    componentIds: uniqueSorted(input.componentIds ?? []),
    systemNames: uniqueSorted(input.systemNames ?? []),
    ...(input.systemPriority === undefined
      ? {}
      : { systemPriority: input.systemPriority }),
    diagnostics: uniqueSorted(input.diagnostics ?? []),
    ...(input.semanticLabels === undefined
      ? {}
      : { semanticLabels: uniqueSorted(input.semanticLabels) }),
  };
}

function chunkTypeForDeclaration(
  candidate: CandidateSource,
  declaration: MorphNode,
  content: string,
): ApertureReferenceChunkType {
  if (extractDiagnosticCodes(content).length > 0) {
    return "diagnostic";
  }

  if (extractComponentIds(content).length > 0) {
    return "component";
  }

  if (
    candidate.file.endsWith(".system.ts") ||
    content.includes("createSystem(") ||
    (Node.isClassDeclaration(declaration) &&
      declaration.getName()?.endsWith("System") === true)
  ) {
    return "system";
  }

  if (Node.isClassDeclaration(declaration)) {
    return "class";
  }

  if (Node.isFunctionDeclaration(declaration)) {
    return "function";
  }

  if (Node.isInterfaceDeclaration(declaration)) {
    return "interface";
  }

  if (Node.isTypeAliasDeclaration(declaration)) {
    return "type";
  }

  if (Node.isEnumDeclaration(declaration)) {
    return "enum";
  }

  if (Node.isVariableDeclaration(declaration)) {
    return "variable";
  }

  return "source";
}

function declarationName(declaration: MorphNode, exportedName: string): string {
  if (
    Node.isClassDeclaration(declaration) ||
    Node.isFunctionDeclaration(declaration) ||
    Node.isInterfaceDeclaration(declaration) ||
    Node.isTypeAliasDeclaration(declaration) ||
    Node.isEnumDeclaration(declaration) ||
    Node.isVariableDeclaration(declaration)
  ) {
    return declaration.getName() ?? exportedName;
  }

  return exportedName;
}

function nearestClassName(node: MorphNode): string | undefined {
  const parentClass = node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);

  if (parentClass !== undefined && Node.isClassDeclaration(parentClass)) {
    return parentClass.getName();
  }

  return undefined;
}

function classExtends(declaration: ClassDeclaration): readonly string[] {
  const extendsExpression = declaration.getExtends();

  return extendsExpression === undefined ? [] : [extendsExpression.getText()];
}

function classImplements(declaration: ClassDeclaration): readonly string[] {
  return declaration.getImplements().map((expression) => expression.getText());
}

function dedupeChunks(
  chunks: readonly RawReferenceChunk[],
): readonly RawReferenceChunk[] {
  const seen = new Set<string>();
  const deduped: RawReferenceChunk[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.metadata.file}:${chunk.metadata.startLine}:${chunk.metadata.endLine}:${chunk.metadata.name}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(chunk);
  }

  return deduped;
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

function scoreChunk(
  index: ApertureReferenceIndex,
  chunk: ApertureReferenceChunk,
  query: string,
  tokens: readonly string[],
  queryEmbedding: readonly number[],
): ApertureReferenceSearchResult | null {
  if (query.length === 0 || tokens.length === 0) {
    return null;
  }

  const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
  const metadata = chunk.metadata;
  const haystack = [
    metadata.file,
    metadata.name,
    metadata.exportedName ?? "",
    metadata.packageName ?? "",
    metadata.entrypoint ?? "",
    ...metadata.semanticLabels,
    ...metadata.componentIds,
    ...metadata.systemNames,
    ...metadata.diagnostics,
    ...metadata.imports,
    ...metadata.calls,
    ...metadata.usesTypes,
    chunk.content,
  ]
    .join("\n")
    .toLowerCase();
  const queryLower = query.toLowerCase();
  const exactSymbolBoost = [metadata.name, metadata.exportedName ?? ""]
    .map((value) => value.toLowerCase())
    .includes(queryLower)
    ? 0.75
    : 0;
  const exactDiagnosticBoost = metadata.diagnostics.some(
    (diagnostic) => diagnostic.toLowerCase() === queryLower,
  )
    ? 0.85
    : 0;
  const tokenCoverage =
    tokens.filter((token) => haystack.includes(token)).length / tokens.length;
  const tokenBoost = tokenCoverage * 0.3;
  const categoryBoost =
    metadata.sourceCategory === "api" ||
    metadata.sourceCategory === "diagnostic"
      ? 0.08
      : 0;
  const score =
    semanticScore +
    exactSymbolBoost +
    exactDiagnosticBoost +
    tokenBoost +
    categoryBoost;

  if (score <= 0) {
    return null;
  }

  return resultForChunk({
    chunk,
    entry: entryForFile(index, metadata.file),
    semanticScore,
    score,
    snippet: snippetForQuery(chunk.content, tokens),
  });
}

function resultForChunk(input: {
  readonly chunk: ApertureReferenceChunk;
  readonly entry: ApertureReferenceEntry;
  readonly semanticScore: number;
  readonly score: number;
  readonly snippet: string;
}): ApertureReferenceSearchResult {
  const metadata = input.chunk.metadata;

  return {
    chunkId: input.chunk.id,
    file: metadata.file,
    kind: input.entry.kind,
    sourceCategory: metadata.sourceCategory,
    chunkType: metadata.chunkType,
    score: roundScore(input.score),
    semanticScore: roundScore(input.semanticScore),
    symbol: metadata.name,
    startLine: metadata.startLine,
    endLine: metadata.endLine,
    symbols: input.entry.symbols.slice(0, 12),
    components: metadata.componentIds.slice(0, 12),
    systems: metadata.systemNames.slice(0, 12),
    diagnostics: metadata.diagnostics.slice(0, 12),
    snippet: input.snippet,
  };
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

function referenceSourceCategory(
  options: SearchApertureReferencesOptions,
): ApertureReferenceSourceCategory | "any" {
  if (options.sourceCategory !== undefined) {
    return options.sourceCategory;
  }

  switch (options.kind) {
    case "doc":
      return "docs";
    case "source":
      return "api";
    case "example":
      return "example";
    case "reference":
      return "external";
    case "other":
    case "test":
    case "any":
    case undefined:
      return "any";
  }

  return "any";
}

function entryForFile(
  index: ApertureReferenceIndex,
  file: string,
): ApertureReferenceEntry {
  const entry = index.entries.find((candidate) => candidate.file === file);

  if (entry === undefined) {
    throw new Error(`Reference entry '${file}' is missing from the index.`);
  }

  return entry;
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

function isTypeScriptLike(file: string): boolean {
  return [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"].includes(
    path.extname(file),
  );
}

function isGeneratedSystemFile(file: string): boolean {
  return file.endsWith(".system.ts") || file.includes("/systems/");
}

function extractComponentIds(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bid\s*:\s*["'`]([^"'`]+)["'`]/gu,
    /\bcreateComponent\s*\(\s*["'`]([^"'`]+)["'`]/gu,
    /\bdefineComponent\s*\(\s*["'`]([^"'`]+)["'`]/gu,
  ]).filter((value) => value.includes("."));
}

function extractSystemNames(text: string, file: string): readonly string[] {
  const systems = uniqueMatches(text, [
    /\bclass\s+([A-Za-z_$][\w$]*System)\b/gu,
    /\bexport\s+default\s+class\s+([A-Za-z_$][\w$]*)\b/gu,
  ]);

  if (file.endsWith(".system.ts") && systems.length === 0) {
    return [path.basename(file, ".system.ts")];
  }

  return systems;
}

function extractDiagnosticCodes(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bcode\s*:\s*["'`]([^"'`]+)["'`]/gu,
    /\bdiagnostic\.code\s*===\s*["'`]([^"'`]+)["'`]/gu,
  ]).filter((value) => value.includes("."));
}

function extractExportNames(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bexport\s+(?:async\s+)?(?:function|class|interface|type|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/gu,
    /\bexport\s*\{\s*([^}]+)\s*\}/gu,
  ]).flatMap((match) =>
    match.includes(",")
      ? match
          .split(",")
          .map((part) => part.trim().split(/\s+as\s+/u)[0] ?? "")
          .filter((part) => part.length > 0)
      : [match],
  );
}

function extractCalls(text: string): readonly string[] {
  return uniqueMatches(text, [/\b([A-Za-z_$][\w$]*)\s*\(/gu]).filter(
    (value) =>
      !["catch", "for", "function", "if", "return", "switch", "while"].includes(
        value,
      ),
  );
}

function extractExtends(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bextends\s+([A-Za-z_$][\w$]*(?:\([^)]*\))?)/gu,
  ]);
}

function extractSystemPriority(text: string): number | undefined {
  const match = /\bpriority\s*:\s*(-?\d+(?:\.\d+)?)/u.exec(text);

  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function extractTypeLikeNames(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\btype\s+([A-Za-z_$][\w$]*)/gu,
    /\binterface\s+([A-Za-z_$][\w$]*)/gu,
    /\bimplements\s+([A-Za-z_$][\w$]*)/gu,
    /\bextends\s+([A-Za-z_$][\w$]*)/gu,
  ]);
}

function uniqueMatches(text: string, patterns: readonly RegExp[]): string[] {
  const values = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1]?.trim();

      if (value !== undefined && value.length > 0) {
        values.add(value);
      }
    }
  }

  return uniqueSorted([...values]);
}

function labelWords(value: string): readonly string[] {
  return tokenizeReferenceText(value).filter((token) => token.length > 2);
}

function snippetForQuery(text: string, tokens: readonly string[]): string {
  const lower = text.toLowerCase();
  const index = Math.max(
    0,
    tokens
      .map((token) => lower.indexOf(token))
      .filter((position) => position >= 0)
      .sort((a, b) => a - b)[0] ?? 0,
  );
  const start = Math.max(0, index - 140);
  const end = Math.min(text.length, index + 320);

  return text.slice(start, end).replace(/\s+/gu, " ").trim();
}

function snippetAround(text: string, query: string, radius: number): string {
  const index = Math.max(0, text.indexOf(query));
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);

  return text.slice(start, end);
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

function lineForOffset(text: string, offset: number): number {
  if (offset <= 0) {
    return 1;
  }

  return text.slice(0, offset).split(/\r?\n/u).length;
}

function roundScore(value: number): number {
  return Number(value.toFixed(6));
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
