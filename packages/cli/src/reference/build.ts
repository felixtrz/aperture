import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
import { readReusableReferenceIndex } from "./embedding-cache.js";
import { disposeReferenceEmbeddingService } from "./embedding.js";
import { isNodeErrorCode } from "./files.js";
import { publishReferenceDirectory } from "./publication.js";
import { withReferenceBuildLock } from "./build-lock.js";
import { fileManifest, manifestFiles } from "./manifest.js";
import {
  installReferenceEmbeddingModel,
  MODEL_CONTRACT,
  writeReferenceModelContract,
} from "./model.js";
import {
  DATA_DIRECTORY,
  SOURCES_DIRECTORY,
  MODEL_DIRECTORY,
  apertureReferenceArchiveFile,
  apertureReferenceDataDir,
  apertureReferenceEmbeddingsFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceModelDir,
  apertureReferenceRuntimeDir,
  apertureReferenceStateFile,
} from "./paths.js";
import { syncSharedReferenceCache } from "./state.js";

const DEFAULT_CORPUS_NAME = "aperture-developer-api";

export async function buildApertureReferenceIndex(
  options: BuildApertureReferenceIndexOptions,
): Promise<BuildApertureReferenceIndexReport> {
  const root = path.resolve(options.cwd);
  return withReferenceBuildLock(apertureReferenceRuntimeDir(root), () =>
    buildLockedReferenceIndex(root),
  );
}

async function buildLockedReferenceIndex(
  root: string,
): Promise<BuildApertureReferenceIndexReport> {
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const previousIndex = await readReusableReferenceIndex(root);
  await mkdir(path.dirname(runtimeDir), { recursive: true });
  const stagedRuntimeDir = await mkdtemp(
    path.join(path.dirname(runtimeDir), ".reference-build-"),
  );
  const dataDir = path.join(stagedRuntimeDir, DATA_DIRECTORY);
  const modelDir = path.join(stagedRuntimeDir, MODEL_DIRECTORY);
  const sourcesDir = path.join(dataDir, SOURCES_DIRECTORY);
  const indexFile = path.join(
    stagedRuntimeDir,
    path.basename(apertureReferenceIndexFile(root)),
  );
  const manifestFile = path.join(
    stagedRuntimeDir,
    path.basename(apertureReferenceManifestFile(root)),
  );
  const archiveFile = path.join(
    stagedRuntimeDir,
    path.basename(apertureReferenceArchiveFile(root)),
  );

  try {
    await mkdir(sourcesDir, { recursive: true });
    try {
      await cp(apertureReferenceModelDir(root), modelDir, { recursive: true });
    } catch (error) {
      if (!isNodeErrorCode(error, "ENOENT")) throw error;
    }

    await installReferenceEmbeddingModel(modelDir);

    const { sources, chunks } = await ingestApertureReferenceCorpus(root);
    const embedded = await createEmbeddedReferenceChunks(chunks, {
      modelDir,
      ...(previousIndex === undefined ? {} : { previousIndex }),
    });
    const embeddedChunks = embedded.chunks;
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
    const embeddingsFile = path.join(
      dataDir,
      path.basename(apertureReferenceEmbeddingsFile(root)),
    );
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

    const files = await manifestFiles(stagedRuntimeDir, [DATA_DIRECTORY]);
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
        cwd: stagedRuntimeDir,
        file: archiveFile,
        gzip: true,
        portable: true,
      },
      [DATA_DIRECTORY],
    );

    const archive = await fileManifest(stagedRuntimeDir, archiveFile);
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
    await writeFile(
      path.join(
        stagedRuntimeDir,
        path.basename(apertureReferenceStateFile(root)),
      ),
      `${JSON.stringify(
        {
          source: "workspace",
          status: "ready",
          updatedAt: createdAt,
          manifest,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await disposeReferenceEmbeddingService(modelDir);
    // A completed corpus, archive, model and state move together. An embedding or
    // archive failure never removes the previously published reference snapshot.
    await publishReferenceDirectory(stagedRuntimeDir, runtimeDir, () =>
      syncSharedReferenceCache(root),
    );

    return {
      indexFile: apertureReferenceIndexFile(root),
      manifestFile: apertureReferenceManifestFile(root),
      archiveFile: apertureReferenceArchiveFile(root),
      dataDir: apertureReferenceDataDir(root),
      modelDir: apertureReferenceModelDir(root),
      entries: entries.length,
      chunks: embeddedChunks.length,
      sources: sources.length,
      root,
      embeddingsReused: embedded.reused,
      embeddingsGenerated: embedded.generated,
    };
  } finally {
    try {
      await disposeReferenceEmbeddingService(modelDir);
    } finally {
      await rm(stagedRuntimeDir, { force: true, recursive: true });
    }
  }
}
