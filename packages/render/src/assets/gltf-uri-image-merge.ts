import type {
  GltfDecodedImageData,
  GltfImageDataResolver,
  GltfImageDataResolverInput,
} from "../materials/gltf-texture-types.js";

export async function mapWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  mapper: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];

      if (item !== undefined) {
        results[index] = await mapper(item);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}

export function normalizeConcurrency(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

export function createMergedImageDataResolver(input: {
  readonly decodedImages: ReadonlyMap<number, GltfDecodedImageData>;
  readonly fallback: GltfImageDataResolver | undefined;
}): GltfImageDataResolver {
  return (resolverInput: GltfImageDataResolverInput) => {
    const decoded = input.decodedImages.get(resolverInput.imageIndex);
    if (decoded !== undefined) {
      return decoded;
    }

    return input.fallback?.(resolverInput) ?? null;
  };
}
