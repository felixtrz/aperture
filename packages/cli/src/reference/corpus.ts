import { readFile, stat } from "node:fs/promises";
import { Project, ScriptTarget } from "ts-morph";
import { chunkReferenceSource, type RawReferenceChunk } from "./chunking.js";
import type {
  ApertureReferenceChunk,
  ApertureReferenceChunkMetadata,
  ApertureReferenceSource,
} from "./contracts.js";
import { referenceEmbeddingService } from "./embedding.js";
import { sha256, uniqueSorted } from "./files.js";
import {
  collectCandidateSources,
  discoverPackageExportInfo,
} from "./source-collection.js";

const MAX_INDEXED_FILE_BYTES = 420_000;
const MAX_EMBEDDING_CONTENT_CHARS = 2_000;
const EMBEDDING_BATCH_SIZE = 8;

export async function ingestApertureReferenceCorpus(root: string): Promise<{
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

export async function createEmbeddedReferenceChunks(
  chunks: readonly RawReferenceChunk[],
  options: {
    readonly modelDir: string;
  },
): Promise<readonly ApertureReferenceChunk[]> {
  const embedder = await referenceEmbeddingService(options.modelDir);
  const embeddedChunks: ApertureReferenceChunk[] = [];
  const preparedChunks = chunks.map((chunk) => {
    const semanticLabels = createSemanticLabels(chunk);
    const metadata: ApertureReferenceChunkMetadata = {
      ...chunk.metadata,
      semanticLabels,
    };

    return {
      content: chunk.content,
      metadata,
      embeddingText: embeddingTextForChunk(metadata, chunk.content),
    };
  });

  for (
    let offset = 0;
    offset < preparedChunks.length;
    offset += EMBEDDING_BATCH_SIZE
  ) {
    const batch = preparedChunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
    const embeddings = await embedder.embedMany(
      batch.map((chunk) => chunk.embeddingText),
    );

    for (let index = 0; index < batch.length; index += 1) {
      const chunk = batch[index];
      const embedding = embeddings[index];

      if (chunk === undefined || embedding === undefined) {
        continue;
      }

      embeddedChunks.push({
        id: chunkId(chunk.metadata),
        content: chunk.content,
        embeddingText: chunk.embeddingText,
        embedding,
        metadata: chunk.metadata,
      });
    }
  }

  return embeddedChunks;
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

function embeddingTextForChunk(
  metadata: ApertureReferenceChunkMetadata,
  content: string,
): string {
  const embeddingContent = truncateEmbeddingContent(content);

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
    embeddingContent,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function truncateEmbeddingContent(content: string): string {
  if (content.length <= MAX_EMBEDDING_CONTENT_CHARS) {
    return content;
  }

  return `${content.slice(
    0,
    MAX_EMBEDDING_CONTENT_CHARS,
  )}\n\n[reference embedding content truncated: ${
    content.length - MAX_EMBEDDING_CONTENT_CHARS
  } chars omitted]`;
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
