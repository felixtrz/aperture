import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ApertureReferenceModelContract } from "./contracts.js";
import { MODEL_CONTRACT_FILE } from "./paths.js";

export const REFERENCE_MODEL_REPO_ID = "jinaai/jina-embeddings-v2-base-code";
export const REFERENCE_MODEL_REVISION =
  "516f4baf13dec4ddddda8631e019b5737c8bc250";
export const REFERENCE_MODEL_DIMENSIONS = 768;

export const MODEL_CONTRACT: ApertureReferenceModelContract = {
  provider: "huggingface",
  format: "transformers-js",
  model: REFERENCE_MODEL_REPO_ID,
  revision: REFERENCE_MODEL_REVISION,
  dimensions: REFERENCE_MODEL_DIMENSIONS,
  dtype: "q8",
  pooling: "mean",
  normalize: true,
  textFormattingVersion: 2,
  expectedFiles: [
    MODEL_CONTRACT_FILE,
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "onnx/model_quantized.onnx",
  ],
  files: [
    {
      relativePath: "config.json",
      sourceUrl: "https://d1erq8v22udnml.cloudfront.net/rag/config.json",
    },
    {
      relativePath: "tokenizer.json",
      sourceUrl: "https://d1erq8v22udnml.cloudfront.net/rag/tokenizer.json",
    },
    {
      relativePath: "tokenizer_config.json",
      sourceUrl:
        "https://d1erq8v22udnml.cloudfront.net/rag/tokenizer_config.json",
    },
    {
      relativePath: "onnx/model_quantized.onnx",
      sourceUrl:
        "https://d1erq8v22udnml.cloudfront.net/rag/model_quantized.onnx",
    },
  ],
};

export const REFERENCE_MODEL_FILE_SOURCES = Object.freeze(
  MODEL_CONTRACT.files.map((file) => ({
    relativePath: file.relativePath,
    sourceUrl: file.sourceUrl,
  })),
);

export const REFERENCE_MODEL_ONNX_URL =
  REFERENCE_MODEL_FILE_SOURCES.find(
    (file) => file.relativePath === "onnx/model_quantized.onnx",
  )?.sourceUrl ?? "";

export const REQUIRED_MODEL_FILES = Object.freeze(
  REFERENCE_MODEL_FILE_SOURCES.map((file) => file.relativePath),
);

export function sameModelContract(
  a: ApertureReferenceModelContract,
  b: ApertureReferenceModelContract,
): boolean {
  return (
    a.provider === b.provider &&
    a.format === b.format &&
    a.model === b.model &&
    a.revision === b.revision &&
    a.dimensions === b.dimensions &&
    a.dtype === b.dtype &&
    a.pooling === b.pooling &&
    a.normalize === b.normalize &&
    a.textFormattingVersion === b.textFormattingVersion &&
    Array.isArray(a.expectedFiles) &&
    Array.isArray(b.expectedFiles) &&
    Array.isArray(a.files) &&
    Array.isArray(b.files) &&
    sameStringArray(a.expectedFiles, b.expectedFiles) &&
    sameModelFileSources(a.files, b.files)
  );
}

export function hasReferenceEmbeddingModelFiles(
  modelDir: string | null,
): boolean {
  if (!modelDir) {
    return false;
  }

  return REQUIRED_MODEL_FILES.every((relativePath) =>
    existsSync(path.join(modelDir, relativePath)),
  );
}

export async function installReferenceEmbeddingModel(
  modelDir: string,
): Promise<void> {
  if (await hasInstalledReferenceModel(modelDir)) {
    return;
  }

  await rm(modelDir, { force: true, recursive: true });
  await mkdir(modelDir, { recursive: true });

  for (const file of REFERENCE_MODEL_FILE_SOURCES) {
    await downloadPinnedModelFile(
      file.sourceUrl,
      path.join(modelDir, file.relativePath),
    );
  }

  await writeReferenceModelContract(modelDir);
}

export async function writeReferenceModelContract(
  modelDir: string,
): Promise<void> {
  await mkdir(modelDir, { recursive: true });
  await writeFile(
    path.join(modelDir, MODEL_CONTRACT_FILE),
    `${JSON.stringify(MODEL_CONTRACT, null, 2)}\n`,
    "utf8",
  );
}

async function hasInstalledReferenceModel(modelDir: string): Promise<boolean> {
  if (!hasReferenceEmbeddingModelFiles(modelDir)) {
    return false;
  }

  try {
    const parsed = JSON.parse(
      await readFile(path.join(modelDir, MODEL_CONTRACT_FILE), "utf8"),
    ) as ApertureReferenceModelContract;

    return sameModelContract(parsed, MODEL_CONTRACT);
  } catch {
    return false;
  }
}

async function downloadPinnedModelFile(
  sourceUrl: string,
  destination: string,
): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
    return;
  } catch (error) {
    await rm(destination, { force: true }).catch(() => {});
    const result = spawnSync(
      "curl",
      [
        "-L",
        "--fail",
        "--silent",
        "--show-error",
        sourceUrl,
        "--output",
        destination,
      ],
      { encoding: "utf8" },
    );

    if (result.status !== 0) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to fetch pinned Aperture reference embedding model file ${sourceUrl}: ${
          result.stderr.trim() || message
        }`,
        { cause: error },
      );
    }
  }
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameModelFileSources(
  a: ApertureReferenceModelContract["files"],
  b: ApertureReferenceModelContract["files"],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (file, index) =>
        file.relativePath === b[index]?.relativePath &&
        file.sourceUrl === b[index]?.sourceUrl,
    )
  );
}
