import { hasReferenceEmbeddingModelFiles, MODEL_CONTRACT } from "./model.js";

export const EMBEDDING_DIMENSIONS = MODEL_CONTRACT.dimensions;

type FeatureExtractionOutput = {
  readonly data: Float32Array | readonly number[];
};

type FeatureExtractionPipeline = {
  (
    text: string | readonly string[],
    options: {
      readonly pooling: typeof MODEL_CONTRACT.pooling;
      readonly normalize: typeof MODEL_CONTRACT.normalize;
    },
  ): Promise<FeatureExtractionOutput>;
  readonly dispose?: () => Promise<void>;
};

type TransformersModule = {
  readonly env: {
    allowLocalModels?: boolean;
    allowRemoteModels?: boolean;
  };
  readonly pipeline: (
    task: "feature-extraction",
    model: string,
    options: {
      readonly dtype: typeof MODEL_CONTRACT.dtype;
      readonly local_files_only: true;
    },
  ) => Promise<unknown>;
};

const TRANSFORMERS_LOADER_GLOBAL = "__APERTURE_REFERENCE_TRANSFORMERS_LOADER__";
const serviceCache = new Map<string, ReferenceEmbeddingService>();

export class ReferenceEmbeddingService {
  #extractor: FeatureExtractionPipeline | null = null;

  async initialize(modelDir: string): Promise<void> {
    if (this.#extractor !== null) {
      return;
    }

    if (!hasReferenceEmbeddingModelFiles(modelDir)) {
      throw new Error(
        `Aperture reference embedding model files are missing from ${modelDir}. Run 'aperture reference warmup' to refresh the pinned model files.`,
      );
    }

    const { env, pipeline } = await loadTransformers();

    env.allowLocalModels = true;
    (env as { allowRemoteModels?: boolean }).allowRemoteModels = false;

    this.#extractor = (await pipeline("feature-extraction", modelDir, {
      dtype: MODEL_CONTRACT.dtype,
      local_files_only: true,
    })) as unknown as FeatureExtractionPipeline;
  }

  async embed(text: string): Promise<readonly number[]> {
    return (await this.embedMany([text]))[0] ?? [];
  }

  async embedMany(texts: readonly string[]): Promise<readonly number[][]> {
    if (this.#extractor === null) {
      throw new Error(
        "Aperture reference embedding service is not initialized.",
      );
    }

    if (texts.length === 0) {
      return [];
    }

    const output = await this.#extractor([...texts], {
      pooling: MODEL_CONTRACT.pooling,
      normalize: MODEL_CONTRACT.normalize,
    });
    const vector = Array.from(output.data);

    if (vector.length !== texts.length * MODEL_CONTRACT.dimensions) {
      throw new Error(
        `Aperture reference embedding model returned ${vector.length} values for ${texts.length} inputs; expected ${
          texts.length * MODEL_CONTRACT.dimensions
        }.`,
      );
    }

    return texts.map((_, index) =>
      vector.slice(
        index * MODEL_CONTRACT.dimensions,
        (index + 1) * MODEL_CONTRACT.dimensions,
      ),
    );
  }

  async dispose(): Promise<void> {
    const extractor = this.#extractor;

    this.#extractor = null;
    await extractor?.dispose?.();
  }
}

async function loadTransformers(): Promise<TransformersModule> {
  // Private test hook: keeps unit tests off the native ONNX runtime.
  const globalLoader = (globalThis as Record<string, unknown>)[
    TRANSFORMERS_LOADER_GLOBAL
  ];

  if (typeof globalLoader === "function") {
    return (await (
      globalLoader as () => Promise<TransformersModule>
    )()) as TransformersModule;
  }

  return (await import("@huggingface/transformers")) as TransformersModule;
}

export async function referenceEmbeddingService(
  modelDir: string,
): Promise<ReferenceEmbeddingService> {
  let service = serviceCache.get(modelDir);

  if (service === undefined) {
    service = new ReferenceEmbeddingService();
    serviceCache.set(modelDir, service);
  }

  await service.initialize(modelDir);
  return service;
}

export async function embedReferenceText(
  text: string,
  modelDir: string,
): Promise<readonly number[]> {
  const service = await referenceEmbeddingService(modelDir);

  return service.embed(text);
}

export async function disposeReferenceEmbeddingServices(): Promise<void> {
  const services = [...serviceCache.values()];

  serviceCache.clear();
  await Promise.all(services.map((service) => service.dispose()));
}

export function tokenizeReferenceText(text: string): readonly string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9_.:/-]+/u)
    .flatMap((token) => tokenParts(token))
    .filter((token) => token.length > 0);
}

export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;

    dot += aValue * bValue;
    normA += aValue * aValue;
    normB += bValue * bValue;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tokenParts(token: string): readonly string[] {
  const parts = token.split(/[_.:/-]+/u).filter((part) => part.length > 0);

  return uniqueSorted([token, ...parts]);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
