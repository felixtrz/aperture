import path from "node:path";
import { apertureRuntimeDir } from "./session.js";

export const ARCHIVE_FILE = "data.tgz";
export const INDEX_FILE = "index.json";
export const STATE_FILE = "state.json";
export const MANIFEST_FILE = "manifest.json";
export const DATA_DIRECTORY = "data";
export const MODEL_DIRECTORY = "model";
export const EMBEDDINGS_FILE = "embeddings.json";
export const MODEL_CONTRACT_FILE = "model-contract.json";

export function apertureReferenceIndexFile(root: string): string {
  return path.join(apertureReferenceRuntimeDir(root), INDEX_FILE);
}

export function apertureReferenceManifestFile(root: string): string {
  return path.join(apertureReferenceRuntimeDir(root), MANIFEST_FILE);
}

export function apertureReferenceArchiveFile(root: string): string {
  return path.join(apertureReferenceRuntimeDir(root), ARCHIVE_FILE);
}

export function apertureReferenceStateFile(root: string): string {
  return path.join(apertureReferenceRuntimeDir(root), STATE_FILE);
}

export function apertureReferenceRuntimeDir(root: string): string {
  return path.join(apertureRuntimeDir(root), "reference");
}

export function apertureReferenceDataDir(root: string): string {
  return path.join(apertureReferenceRuntimeDir(root), DATA_DIRECTORY);
}

export function apertureReferenceModelDir(root: string): string {
  return path.join(apertureReferenceRuntimeDir(root), MODEL_DIRECTORY);
}

export function apertureReferenceEmbeddingsFile(root: string): string {
  return path.join(apertureReferenceDataDir(root), EMBEDDINGS_FILE);
}
