import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import {
  CORPUS_SCHEMA_VERSION,
  INDEX_VERSION,
  MANIFEST_SCHEMA_VERSION,
  type ApertureReferenceIndex,
  type ApertureReferenceManifest,
  type BuildApertureReferenceIndexOptions,
  type BuildApertureReferenceIndexReport,
} from "./contracts.js";
import {
  createEmbeddedReferenceChunks,
  ingestApertureReferenceCorpus,
} from "./corpus.js";
import { createReferenceEntries } from "./entries.js";
import { fileManifest, manifestFiles } from "./manifest.js";
import {
  installReferenceEmbeddingModel,
  MODEL_CONTRACT,
  writeReferenceModelContract,
} from "./model.js";
import {
  DATA_DIRECTORY,
  SOURCES_DIRECTORY,
  apertureReferenceArchiveFile,
  apertureReferenceDataDir,
  apertureReferenceEmbeddingsFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceModelDir,
  apertureReferenceRuntimeDir,
} from "./paths.js";
import { syncSharedReferenceCache, writeReferenceState } from "./state.js";

const DEFAULT_CORPUS_NAME = "aperture-developer-api";

export async function buildApertureReferenceIndex(
  options: BuildApertureReferenceIndexOptions,
): Promise<BuildApertureReferenceIndexReport> {
  const root = path.resolve(options.cwd);
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const dataDir = apertureReferenceDataDir(root);
  const modelDir = apertureReferenceModelDir(root);
  const sourcesDir = path.join(dataDir, SOURCES_DIRECTORY);
  const indexFile = apertureReferenceIndexFile(root);
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);

  await rm(dataDir, { force: true, recursive: true });
  await rm(archiveFile, { force: true });
  await mkdir(sourcesDir, { recursive: true });
  await mkdir(modelDir, { recursive: true });

  await installReferenceEmbeddingModel(modelDir);

  const { sources, chunks } = await ingestApertureReferenceCorpus(root);
  const embeddedChunks = await createEmbeddedReferenceChunks(chunks, {
    modelDir,
  });
  const entries = createReferenceEntries(sources, embeddedChunks);
  const createdAt = new Date().toISOString();
  const manifestBase: ApertureReferenceManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    indexVersion: INDEX_VERSION,
    corpus: {
      name: DEFAULT_CORPUS_NAME,
      root,
      generatedAt: createdAt,
      chunks: embeddedChunks.length,
      sources: sources.length,
    },
    model: MODEL_CONTRACT,
    files: [],
  };
  const indexWithoutManifestFiles: ApertureReferenceIndex = {
    version: INDEX_VERSION,
    schemaVersion: CORPUS_SCHEMA_VERSION,
    root,
    createdAt,
    model: MODEL_CONTRACT,
    manifest: manifestBase,
    entries,
    chunks: embeddedChunks,
    sources,
  };
  const embeddingsFile = apertureReferenceEmbeddingsFile(root);
  await writeFile(
    embeddingsFile,
    `${JSON.stringify(indexWithoutManifestFiles, null, 2)}\n`,
    "utf8",
  );
  await writeReferenceModelContract(modelDir);

  for (const source of sources) {
    const destination = path.join(sourcesDir, source.file);

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, source.text, "utf8");
  }

  const files = await manifestFiles(runtimeDir, [DATA_DIRECTORY]);
  const manifestWithoutArchive: ApertureReferenceManifest = {
    ...manifestBase,
    files,
  };

  await writeFile(
    manifestFile,
    `${JSON.stringify(manifestWithoutArchive, null, 2)}\n`,
    "utf8",
  );
  await tar.c(
    {
      cwd: runtimeDir,
      file: archiveFile,
      gzip: true,
      portable: true,
    },
    [DATA_DIRECTORY],
  );

  const archive = await fileManifest(runtimeDir, archiveFile);
  const manifest: ApertureReferenceManifest = {
    ...manifestBase,
    files,
    archive,
  };
  const index: ApertureReferenceIndex = {
    ...indexWithoutManifestFiles,
    manifest,
  };

  await writeFile(
    manifestFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await syncSharedReferenceCache(root);
  await writeReferenceState(root, {
    source: "workspace",
    status: "ready",
    updatedAt: createdAt,
    manifest,
  });

  return {
    indexFile,
    manifestFile,
    archiveFile,
    dataDir,
    modelDir,
    entries: entries.length,
    chunks: embeddedChunks.length,
    sources: sources.length,
    root,
  };
}
