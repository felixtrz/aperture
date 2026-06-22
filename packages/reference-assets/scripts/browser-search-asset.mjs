#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const BROWSER_SEARCH_VERSION = 1;
const VECTOR_SCALE = 127;

export async function writeBrowserSearchAsset({
  embeddingsFile = path.join(packageRoot, "data", "embeddings.json"),
  outputFile = path.join(packageRoot, "dist", "browser-search.json"),
} = {}) {
  const index = JSON.parse(await readFile(embeddingsFile, "utf8"));
  const dimensions = index.model?.dimensions;

  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error("Reference embeddings index is missing model dimensions.");
  }

  const entriesByFile = new Map(
    index.entries.map((entry) => [entry.file, entry]),
  );
  const vectors = new Int8Array(index.chunks.length * dimensions);
  const chunks = index.chunks.map((chunk, chunkIndex) => {
    if (
      !Array.isArray(chunk.embedding) ||
      chunk.embedding.length !== dimensions
    ) {
      throw new Error(
        `Chunk ${chunk.id} has ${chunk.embedding?.length ?? 0} embedding dimensions; expected ${dimensions}.`,
      );
    }

    for (let index = 0; index < dimensions; index += 1) {
      vectors[chunkIndex * dimensions + index] = quantizeEmbeddingValue(
        chunk.embedding[index] ?? 0,
      );
    }

    const metadata = chunk.metadata;
    const entry = entriesByFile.get(metadata.file);

    if (entry === undefined) {
      throw new Error(
        `Chunk ${chunk.id} references missing entry ${metadata.file}.`,
      );
    }

    return {
      id: chunk.id,
      file: metadata.file,
      kind: entry.kind,
      sourceCategory: metadata.sourceCategory,
      chunkType: metadata.chunkType,
      symbol: metadata.name,
      exportedName: metadata.exportedName ?? "",
      packageName: metadata.packageName ?? "",
      entrypoint: metadata.entrypoint ?? "",
      startLine: metadata.startLine,
      endLine: metadata.endLine,
      labels: metadata.semanticLabels,
      symbols: entry.symbols.slice(0, 12),
      components: metadata.componentIds.slice(0, 12),
      systems: metadata.systemNames.slice(0, 12),
      diagnostics: metadata.diagnostics.slice(0, 12),
      imports: metadata.imports.slice(0, 24),
      calls: metadata.calls.slice(0, 24),
      usesTypes: metadata.usesTypes.slice(0, 24),
      content: chunk.content,
    };
  });

  const payload = {
    version: BROWSER_SEARCH_VERSION,
    generatedAt: new Date().toISOString(),
    corpus: {
      name: index.manifest?.corpus?.name ?? "aperture-developer-api",
      root: index.root ?? "@aperture-engine/reference-assets",
      generatedAt: index.createdAt,
      chunks: chunks.length,
      sources: index.sources?.length ?? 0,
    },
    model: index.model,
    vectorEncoding: {
      type: "int8-normalized",
      dimensions,
      scale: VECTOR_SCALE,
      order: "chunk-major",
    },
    chunks,
    vectorsBase64: Buffer.from(vectors.buffer).toString("base64"),
  };

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload)}\n`, "utf8");

  return {
    outputFile,
    chunks: chunks.length,
    dimensions,
    bytes: Buffer.byteLength(JSON.stringify(payload), "utf8") + 1,
  };
}

function quantizeEmbeddingValue(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    -VECTOR_SCALE,
    Math.min(VECTOR_SCALE, Math.round(value * VECTOR_SCALE)),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  writeBrowserSearchAsset().catch((error) => {
    process.stderr.write(
      `Failed to build browser reference search asset: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exit(1);
  });
}
