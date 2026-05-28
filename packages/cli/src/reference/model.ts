import type { ApertureReferenceModelContract } from "./contracts.js";
import { EMBEDDING_DIMENSIONS } from "./embedding.js";
import { MODEL_CONTRACT_FILE } from "./paths.js";

export const MODEL_CONTRACT: ApertureReferenceModelContract = {
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

export function sameModelContract(
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
