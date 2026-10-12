import { readFile } from "node:fs/promises";
import {
  CORPUS_SCHEMA_VERSION,
  INDEX_VERSION,
  MANIFEST_SCHEMA_VERSION,
  type ApertureReferenceIndex,
  type ApertureReferenceManifest,
} from "./contracts.js";
import { sha256 } from "./files.js";
import { MODEL_CONTRACT, sameModelContract } from "./model.js";
import {
  apertureReferenceEmbeddingsFile,
  apertureReferenceManifestFile,
} from "./paths.js";

/** Only a checksum-verified local producer/payload snapshot is a reuse input. */
export async function readReusableReferenceIndex(
  root: string,
): Promise<ApertureReferenceIndex | undefined> {
  try {
    const manifest = JSON.parse(
      await readFile(apertureReferenceManifestFile(root), "utf8"),
    ) as ApertureReferenceManifest;
    if (
      manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION ||
      manifest.indexVersion !== INDEX_VERSION ||
      !sameModelContract(manifest.model, MODEL_CONTRACT)
    ) {
      return undefined;
    }
    const record = manifest.files.find(
      (file) => file.path === "data/embeddings.json",
    );
    if (record === undefined) return undefined;
    const source = await readFile(apertureReferenceEmbeddingsFile(root));
    if (source.byteLength !== record.bytes || sha256(source) !== record.sha256)
      return undefined;
    const index = JSON.parse(source.toString("utf8")) as ApertureReferenceIndex;
    return compatibleReferenceIndex(index) ? index : undefined;
  } catch {
    // An optimization must never stop a repair of a missing or corrupt cache.
    return undefined;
  }
}

export function reusableReferenceEmbeddings(
  index: ApertureReferenceIndex | undefined,
): ReadonlyMap<string, readonly number[]> {
  const embeddings = new Map<string, readonly number[]>();
  if (!compatibleReferenceIndex(index)) return embeddings;
  const conflicts = new Set<string>();
  for (const chunk of index!.chunks) {
    if (
      typeof chunk?.embeddingText !== "string" ||
      !validReferenceEmbedding(chunk.embedding)
    )
      continue;
    const previous = embeddings.get(chunk.embeddingText);
    if (
      previous !== undefined &&
      previous.some((value, offset) => value !== chunk.embedding[offset])
    ) {
      conflicts.add(chunk.embeddingText);
    } else {
      embeddings.set(chunk.embeddingText, chunk.embedding);
    }
  }
  for (const text of conflicts) embeddings.delete(text);
  return embeddings;
}

export function validReferenceEmbedding(
  value: unknown,
): value is readonly number[] {
  if (!Array.isArray(value) || value.length !== MODEL_CONTRACT.dimensions)
    return false;
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) return false;
  }
  return true;
}

function compatibleReferenceIndex(
  index: ApertureReferenceIndex | undefined,
): boolean {
  try {
    return (
      index !== undefined &&
      index.version === INDEX_VERSION &&
      index.schemaVersion === CORPUS_SCHEMA_VERSION &&
      sameModelContract(index.model, MODEL_CONTRACT) &&
      sameModelContract(index.manifest.model, MODEL_CONTRACT) &&
      Array.isArray(index.chunks)
    );
  } catch {
    return false;
  }
}
