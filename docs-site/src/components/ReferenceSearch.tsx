import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Badge, Input, MonoTag } from "lumin";

interface ReferenceModelFile {
  readonly relativePath: string;
  readonly sourceUrl: string;
}

interface ReferenceModelContract {
  readonly provider: string;
  readonly format: "transformers-js";
  readonly model: string;
  readonly revision: string;
  readonly dimensions: number;
  readonly dtype: "q8";
  readonly pooling: "mean";
  readonly normalize: boolean;
  readonly files: readonly ReferenceModelFile[];
}

interface ReferenceSearchChunk {
  readonly id: string;
  readonly file: string;
  readonly kind: string;
  readonly sourceCategory: string;
  readonly chunkType: string;
  readonly symbol: string;
  readonly exportedName: string;
  readonly packageName: string;
  readonly entrypoint: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly labels: readonly string[];
  readonly symbols: readonly string[];
  readonly components: readonly string[];
  readonly systems: readonly string[];
  readonly diagnostics: readonly string[];
  readonly imports: readonly string[];
  readonly calls: readonly string[];
  readonly usesTypes: readonly string[];
  readonly content: string;
}

interface ReferenceSearchAsset {
  readonly version: number;
  readonly corpus: {
    readonly name: string;
    readonly generatedAt: string;
    readonly chunks: number;
    readonly sources: number;
  };
  readonly model: ReferenceModelContract;
  readonly vectorEncoding: {
    readonly type: "int8-normalized";
    readonly dimensions: number;
    readonly scale: number;
    readonly order: "chunk-major";
  };
  readonly chunks: readonly ReferenceSearchChunk[];
  readonly vectorsBase64: string;
}

interface LoadedReferenceSearchAsset {
  readonly asset: ReferenceSearchAsset;
  readonly vectors: Int8Array;
  readonly vectorNorms: Float32Array;
}

interface ReferenceSearchResult {
  readonly chunk: ReferenceSearchChunk;
  readonly score: number;
  readonly semanticScore: number;
  readonly snippet: string;
}

interface ReferenceSearchProps {
  readonly assetsVersion: string;
}

type SearchStatus = "idle" | "loading" | "ready" | "error";

interface ModelLoadProgress {
  readonly label: string;
  readonly value: number | null;
}

type ModelProgressInfo =
  | {
      readonly status: "initiate" | "download" | "done";
      readonly file: string;
    }
  | {
      readonly status: "progress";
      readonly file: string;
      readonly progress: number;
      readonly loaded: number;
      readonly total: number;
    }
  | {
      readonly status: "ready";
      readonly task: string;
      readonly model: string;
    };

type ModelProgressCallback = (progressInfo: ModelProgressInfo) => void;

const base = import.meta.env.BASE_URL ?? "/";
const exampleQueries = [
  "create a system",
  "load a GLB model",
  "procedural sky uniforms",
  "spot light shadows",
  "aperture reference warmup",
];
const sourceFilters = [
  ["any", "All"],
  ["api", "API"],
  ["docs", "Docs"],
  ["example", "Examples"],
  ["diagnostic", "Diagnostics"],
  ["external", "External"],
] as const;

let loadedAssetPromise: Promise<LoadedReferenceSearchAsset> | null = null;
let embedderPromise: Promise<
  (text: string) => Promise<readonly number[]>
> | null = null;

export function ReferenceSearch({ assetsVersion }: ReferenceSearchProps) {
  const [query, setQuery] = useState("");
  const [sourceCategory, setSourceCategory] = useState("any");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [statusText, setStatusText] = useState("Ready");
  const [results, setResults] = useState<readonly ReferenceSearchResult[]>([]);
  const [activeAsset, setActiveAsset] =
    useState<LoadedReferenceSearchAsset | null>(null);
  const [modelProgress, setModelProgress] = useState<ModelLoadProgress | null>(
    null,
  );

  const filteredResultCount = useMemo(
    () =>
      sourceCategory === "any"
        ? results.length
        : results.filter(
            (result) => result.chunk.sourceCategory === sourceCategory,
          ).length,
    [results, sourceCategory],
  );

  async function runSearch(event?: FormEvent, queryOverride?: string) {
    event?.preventDefault();
    const normalizedQuery = (queryOverride ?? query).trim();

    if (normalizedQuery.length === 0) {
      setResults([]);
      setModelProgress(null);
      setStatus("idle");
      setStatusText("Ready");
      return;
    }

    try {
      setModelProgress(null);
      setStatus("loading");
      setStatusText("Loading reference corpus");
      const loaded = await loadReferenceSearchAsset(assetsVersion);
      setActiveAsset(loaded);
      setStatusText("Loading embedding model");
      const embed = await loadQueryEmbedder(loaded.asset.model, (progress) => {
        const nextProgress = formatModelLoadProgress(progress);

        setModelProgress(nextProgress);
        if (nextProgress !== null) {
          setStatusText(nextProgress.label);
        }
      });
      setModelProgress(null);
      setStatusText("Embedding query");
      const queryEmbedding = await embed(normalizedQuery);
      setStatusText("Ranking results");
      const nextResults = searchAsset(loaded, {
        query: normalizedQuery,
        queryEmbedding,
        sourceCategory,
        limit: 8,
      });

      setResults(nextResults);
      setStatus("ready");
      setStatusText(
        nextResults.length === 0
          ? "No matching references"
          : `${nextResults.length} references`,
      );
    } catch (error) {
      setModelProgress(null);
      setStatus("error");
      setStatusText(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section className="api-reference-search">
      <div className="api-reference-search-header">
        <div>
          <p className="docs-eyebrow">Reference Search</p>
          <h2>Ask the same indexed corpus agents use.</h2>
          <p>
            Search generated docs, public APIs, examples, diagnostics, and
            curated source chunks using the pinned local embedding contract.
          </p>
        </div>
        <div className="api-reference-search-meta">
          <strong>
            {activeAsset?.asset.corpus.chunks.toLocaleString() ?? "3,374"}{" "}
            chunks
          </strong>
          <span>
            {activeAsset?.asset.model.model ??
              "jinaai/jina-embeddings-v2-base-code"}
          </span>
        </div>
      </div>

      <form className="api-reference-search-form" onSubmit={runSearch}>
        <Input
          aria-label="Search Aperture references"
          placeholder="Search systems, diagnostics, examples, materials..."
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setQuery(event.currentTarget.value)
          }
        />
        <button className="api-reference-search-submit" type="submit">
          Search
        </button>
      </form>

      <div className="api-reference-search-controls">
        <div
          className="api-reference-filter-row"
          aria-label="Reference filters"
        >
          {sourceFilters.map(([value, label]) => (
            <button
              key={value}
              className="example-filter"
              data-active={String(sourceCategory === value)}
              type="button"
              onClick={() => setSourceCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="api-reference-example-row">
          {exampleQueries.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                void runSearch(undefined, example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <p className="api-reference-search-status" data-status={status}>
        {statusText}
        {results.length > 0 && sourceCategory !== "any"
          ? ` · ${filteredResultCount} visible in filter`
          : ""}
      </p>
      {modelProgress !== null ? (
        <div
          aria-label="Embedding model loading progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={modelProgress.value ?? undefined}
          className="api-reference-progress"
          role="progressbar"
        >
          <span
            style={{
              width: `${modelProgress.value ?? 10}%`,
            }}
          />
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="api-reference-results">
          {results
            .filter(
              (result) =>
                sourceCategory === "any" ||
                result.chunk.sourceCategory === sourceCategory,
            )
            .map((result) => (
              <article className="api-reference-result" key={result.chunk.id}>
                <div className="api-reference-result-title">
                  <div>
                    <h3>{result.chunk.symbol}</h3>
                    <p>
                      <code>
                        {result.chunk.file}:{result.chunk.startLine}
                      </code>
                    </p>
                  </div>
                  <Badge tone="accent">{result.chunk.sourceCategory}</Badge>
                </div>
                <p>{result.snippet}</p>
                <div className="api-reference-result-tags">
                  <MonoTag>{result.chunk.chunkType}</MonoTag>
                  <MonoTag>score {result.score.toFixed(3)}</MonoTag>
                  <MonoTag>semantic {result.semanticScore.toFixed(3)}</MonoTag>
                  {[
                    ...result.chunk.symbols,
                    ...result.chunk.components,
                    ...result.chunk.systems,
                    ...result.chunk.diagnostics,
                  ]
                    .slice(0, 8)
                    .map((tag) => (
                      <MonoTag key={`${result.chunk.id}:${tag}`}>{tag}</MonoTag>
                    ))}
                </div>
              </article>
            ))}
        </div>
      ) : null}
    </section>
  );
}

async function loadReferenceSearchAsset(
  assetsVersion: string,
): Promise<LoadedReferenceSearchAsset> {
  loadedAssetPromise ??= loadReferenceSearchAssetOnce(assetsVersion);
  return loadedAssetPromise;
}

async function loadReferenceSearchAssetOnce(
  assetsVersion: string,
): Promise<LoadedReferenceSearchAsset> {
  const urls = [
    withBase("reference-search/index.json"),
    `https://unpkg.com/@aperture-engine/reference-assets@${assetsVersion}/dist/browser-search.json`,
  ];
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const asset = (await response.json()) as ReferenceSearchAsset;
      const vectors = decodeBase64Int8(asset.vectorsBase64);
      const expectedLength =
        asset.chunks.length * asset.vectorEncoding.dimensions;

      if (vectors.length !== expectedLength) {
        throw new Error(
          `Reference vector payload has ${vectors.length} values; expected ${expectedLength}.`,
        );
      }

      return {
        asset,
        vectors,
        vectorNorms: computeVectorNorms(
          vectors,
          asset.chunks.length,
          asset.vectorEncoding.dimensions,
        ),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Unable to load Aperture reference search assets: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function loadQueryEmbedder(
  model: ReferenceModelContract,
  onProgress?: ModelProgressCallback,
): Promise<(text: string) => Promise<readonly number[]>> {
  embedderPromise ??= loadQueryEmbedderOnce(model, onProgress);
  return embedderPromise;
}

async function loadQueryEmbedderOnce(
  model: ReferenceModelContract,
  onProgress?: ModelProgressCallback,
): Promise<(text: string) => Promise<readonly number[]>> {
  const { env, pipeline } = await import("@huggingface/transformers");

  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.remoteHost = "https://huggingface.co/";
  env.remotePathTemplate = "{model}/resolve/{revision}/";
  env.useCustomCache = false;
  env.customCache = null;

  const extractor = await pipeline("feature-extraction", model.model, {
    revision: model.revision,
    dtype: model.dtype,
    ...(onProgress === undefined
      ? {}
      : {
          progress_callback: onProgress,
        }),
  });

  return async (text: string) => {
    const output = await extractor(text, {
      pooling: model.pooling,
      normalize: model.normalize,
    });
    const vector = Array.from(output.data as Float32Array | readonly number[]);

    if (vector.length !== model.dimensions) {
      throw new Error(
        `Query model returned ${vector.length} dimensions; expected ${model.dimensions}.`,
      );
    }

    return vector;
  };
}

function formatModelLoadProgress(
  progress: ModelProgressInfo,
): ModelLoadProgress | null {
  if (progress.status === "ready") {
    return {
      label: `Ready: ${progress.model}`,
      value: 100,
    };
  }

  const fileName = progress.file.split("/").at(-1) ?? progress.file;

  if (progress.status === "progress") {
    return {
      label: `Loading model: ${fileName} · ${Math.round(progress.progress)}%`,
      value: clampProgress(progress.progress),
    };
  }

  if (progress.status === "done") {
    return {
      label: `Loaded model file: ${fileName}`,
      value: 100,
    };
  }

  return {
    label:
      progress.status === "download"
        ? `Downloading model: ${fileName}`
        : `Preparing model: ${fileName}`,
    value: null,
  };
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function searchAsset(
  loaded: LoadedReferenceSearchAsset,
  options: {
    readonly query: string;
    readonly queryEmbedding: readonly number[];
    readonly sourceCategory: string;
    readonly limit: number;
  },
): readonly ReferenceSearchResult[] {
  const tokens = tokenizeReferenceText(options.query);

  if (tokens.length === 0) {
    return [];
  }

  const queryNorm = Math.sqrt(
    options.queryEmbedding.reduce((sum, value) => sum + value * value, 0),
  );
  const queryLower = options.query.toLowerCase();
  const dimensions = loaded.asset.vectorEncoding.dimensions;
  const candidates: ReferenceSearchResult[] = [];

  for (let index = 0; index < loaded.asset.chunks.length; index += 1) {
    const chunk = loaded.asset.chunks[index];

    if (
      chunk === undefined ||
      (options.sourceCategory !== "any" &&
        chunk.sourceCategory !== options.sourceCategory)
    ) {
      continue;
    }

    const vectorStart = index * dimensions;
    const semanticScore = quantizedCosineSimilarity(
      options.queryEmbedding,
      queryNorm,
      loaded.vectors,
      vectorStart,
      loaded.vectorNorms[index] ?? 0,
      dimensions,
    );
    const haystack = searchableText(chunk);
    const exactSymbolBoost = [chunk.symbol, chunk.exportedName]
      .map((value) => value.toLowerCase())
      .includes(queryLower)
      ? 0.75
      : 0;
    const exactDiagnosticBoost = chunk.diagnostics.some(
      (diagnostic) => diagnostic.toLowerCase() === queryLower,
    )
      ? 0.85
      : 0;
    const tokenCoverage =
      tokens.filter((token) => haystack.includes(token)).length / tokens.length;
    const tokenBoost = tokenCoverage * 0.3;
    const categoryBoost =
      chunk.sourceCategory === "api" || chunk.sourceCategory === "diagnostic"
        ? 0.08
        : 0;
    const score =
      semanticScore +
      exactSymbolBoost +
      exactDiagnosticBoost +
      tokenBoost +
      categoryBoost;

    if (score > 0) {
      candidates.push({
        chunk,
        score,
        semanticScore,
        snippet: snippetForQuery(chunk.content, tokens),
      });
    }
  }

  return candidates
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.chunk.file.localeCompare(right.chunk.file),
    )
    .slice(0, options.limit);
}

function quantizedCosineSimilarity(
  query: readonly number[],
  queryNorm: number,
  vectors: Int8Array,
  vectorStart: number,
  vectorNorm: number,
  dimensions: number,
): number {
  if (queryNorm === 0 || vectorNorm === 0) {
    return 0;
  }

  let dot = 0;

  for (let index = 0; index < dimensions; index += 1) {
    dot += (query[index] ?? 0) * (vectors[vectorStart + index] ?? 0);
  }

  return dot / (queryNorm * vectorNorm);
}

function computeVectorNorms(
  vectors: Int8Array,
  chunks: number,
  dimensions: number,
): Float32Array {
  const norms = new Float32Array(chunks);

  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex += 1) {
    let sum = 0;
    const start = chunkIndex * dimensions;

    for (let index = 0; index < dimensions; index += 1) {
      const value = vectors[start + index] ?? 0;
      sum += value * value;
    }

    norms[chunkIndex] = Math.sqrt(sum);
  }

  return norms;
}

function searchableText(chunk: ReferenceSearchChunk): string {
  return [
    chunk.file,
    chunk.symbol,
    chunk.exportedName,
    chunk.packageName,
    chunk.entrypoint,
    ...chunk.labels,
    ...chunk.symbols,
    ...chunk.components,
    ...chunk.systems,
    ...chunk.diagnostics,
    ...chunk.imports,
    ...chunk.calls,
    ...chunk.usesTypes,
    chunk.content,
  ]
    .join("\n")
    .toLowerCase();
}

function snippetForQuery(text: string, tokens: readonly string[]): string {
  const lower = text.toLowerCase();
  const firstMatch =
    tokens
      .map((token) => lower.indexOf(token))
      .filter((index) => index >= 0)
      .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, firstMatch - 140);
  const end = Math.min(text.length, firstMatch + 320);

  return text.slice(start, end).replace(/\s+/gu, " ").trim();
}

function tokenizeReferenceText(text: string): readonly string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9_.:/-]+/u)
    .flatMap((token) => tokenParts(token))
    .filter((token) => token.length > 0);
}

function tokenParts(token: string): readonly string[] {
  const parts = token.split(/[_.:/-]+/u).filter((part) => part.length > 0);

  return [...new Set([token, ...parts])].sort((a, b) => a.localeCompare(b));
}

function decodeBase64Int8(base64: string): Int8Array {
  const binary = atob(base64);
  const values = new Int8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    values[index] = (binary.charCodeAt(index) << 24) >> 24;
  }

  return values;
}

function withBase(path: string): string {
  return `${base}${path.replace(/^\//u, "")}`;
}
