import {
  cosineSimilarity,
  embedReferenceText,
  tokenizeReferenceText,
} from "./reference-embedding.js";
import type {
  ApertureReferenceChunk,
  ApertureReferenceEntry,
  ApertureReferenceIndex,
  ApertureReferenceSearchReport,
  ApertureReferenceSearchResult,
  SearchApertureReferencesOptions,
} from "./reference.js";
import type { ApertureReferenceSourceCategory } from "./reference-source-filter.js";

const DEFAULT_LIMIT = 10;

export function searchReferenceIndex(
  index: ApertureReferenceIndex,
  options: SearchApertureReferencesOptions,
): Omit<ApertureReferenceSearchReport, "indexFile"> {
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
    query,
    total: results.length,
    results,
  };
}

export function findReferenceDependentsInIndex(
  index: ApertureReferenceIndex,
  options: {
    readonly symbol: string;
    readonly limit?: number;
  },
): Omit<ApertureReferenceSearchReport, "indexFile"> {
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
    query: symbol,
    total: results.length,
    results,
  };
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

function roundScore(value: number): number {
  return Number(value.toFixed(6));
}
