export const EMBEDDING_DIMENSIONS = 384;

export function embedReferenceText(text: string): readonly number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenizeReferenceText(text);

  for (const token of tokens) {
    const hash = hashString(token);
    const index = hash % EMBEDDING_DIMENSIONS;
    const sign = hash & 1 ? 1 : -1;
    const weight = token.length > 3 ? 1.2 : 0.8;

    vector[index] = (vector[index] ?? 0) + sign * weight;

    for (const alias of tokenAliases(token)) {
      const aliasHash = hashString(alias);
      const aliasIndex = aliasHash % EMBEDDING_DIMENSIONS;
      const aliasSign = aliasHash & 1 ? 1 : -1;

      vector[aliasIndex] = (vector[aliasIndex] ?? 0) + aliasSign * 0.35;
    }
  }

  return normalizeVector(vector);
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
  const length = Math.min(a.length, b.length);
  let dot = 0;

  for (let index = 0; index < length; index += 1) {
    dot += (a[index] ?? 0) * (b[index] ?? 0);
  }

  return dot;
}

function tokenParts(token: string): readonly string[] {
  const parts = token.split(/[_.:/-]+/u).filter((part) => part.length > 0);

  return uniqueSorted([token, ...parts]);
}

function tokenAliases(token: string): readonly string[] {
  switch (token) {
    case "system":
    case "systems":
      return ["createsystem", "scheduler", "priority", "worker"];
    case "component":
    case "components":
      return ["createcomponent", "definecomponent", "schema", "ecs"];
    case "config":
    case "configuration":
      return ["aperture.config.ts", "signals", "vite"];
    case "diagnostic":
    case "diagnostics":
      return ["code", "suggestedfix", "error"];
    case "example":
    case "examples":
      return ["template", "scaffold", "starter"];
    case "camera":
      return ["view", "projection", "agentcamera"];
    case "asset":
    case "assets":
      return ["handle", "registry", "preload"];
    default:
      return [];
  }
}

function normalizeVector(vector: readonly number[]): readonly number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0),
  );

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function hashString(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
