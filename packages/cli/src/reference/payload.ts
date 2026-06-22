import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import type {
  ApertureReferenceIndex,
  ApertureReferenceManifest,
  WarmApertureReferenceReport,
} from "./contracts.js";
import { fileExists } from "./files.js";
import { validateManifest } from "./manifest.js";
import { installReferenceEmbeddingModel } from "./model.js";
import {
  ARCHIVE_FILE,
  MANIFEST_FILE,
  apertureReferenceArchiveFile,
  apertureReferenceDataDir,
  apertureReferenceEmbeddingsFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceModelDir,
  apertureReferenceRuntimeDir,
  apertureReferenceStateFile,
} from "./paths.js";
import { syncSharedReferenceCache, writeReferenceState } from "./state.js";

export async function warmFromDirectory(
  root: string,
  sourceDir: string,
): Promise<void> {
  const manifestSource = path.join(sourceDir, MANIFEST_FILE);
  const archiveSource = path.join(sourceDir, ARCHIVE_FILE);

  if (
    !(await fileExists(manifestSource)) ||
    !(await fileExists(archiveSource))
  ) {
    throw new Error(
      `Reference asset directory '${sourceDir}' must contain ${MANIFEST_FILE} and ${ARCHIVE_FILE}.`,
    );
  }

  await installPayload(root, manifestSource, archiveSource, "directory");
}

export async function warmFromUrl(
  root: string,
  baseUrl: string,
): Promise<void> {
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const tempDir = path.join(runtimeDir, "download");

  await rm(tempDir, { force: true, recursive: true });
  await mkdir(tempDir, { recursive: true });

  const normalizedBaseUrl = baseUrl.replace(/\/$/u, "");
  const manifestFile = path.join(tempDir, MANIFEST_FILE);
  const archiveFile = path.join(tempDir, ARCHIVE_FILE);

  await downloadFile(`${normalizedBaseUrl}/${MANIFEST_FILE}`, manifestFile);
  await downloadFile(`${normalizedBaseUrl}/${ARCHIVE_FILE}`, archiveFile);
  await installPayload(root, manifestFile, archiveFile, "url");
  await rm(tempDir, { force: true, recursive: true });
}

export function warmupReportFromIndex(
  root: string,
  index: ApertureReferenceIndex,
  source: "directory" | "url",
): WarmApertureReferenceReport {
  return {
    indexFile: apertureReferenceIndexFile(root),
    manifestFile: apertureReferenceManifestFile(root),
    archiveFile: apertureReferenceArchiveFile(root),
    dataDir: apertureReferenceDataDir(root),
    modelDir: apertureReferenceModelDir(root),
    entries: index.entries.length,
    chunks: index.chunks.length,
    sources: index.sources.length,
    root,
    source,
    stateFile: apertureReferenceStateFile(root),
  };
}

async function installPayload(
  root: string,
  manifestSource: string,
  archiveSource: string,
  source: "directory" | "url",
): Promise<void> {
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const dataDir = apertureReferenceDataDir(root);
  const modelDir = apertureReferenceModelDir(root);
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);

  await mkdir(runtimeDir, { recursive: true });
  await rm(dataDir, { force: true, recursive: true });
  await rm(modelDir, { force: true, recursive: true });
  await copyFile(manifestSource, manifestFile);
  await copyFile(archiveSource, archiveFile);
  await tar.x({ cwd: runtimeDir, file: archiveFile });

  const indexSource = apertureReferenceEmbeddingsFile(root);
  const indexFile = apertureReferenceIndexFile(root);
  const index = JSON.parse(
    await readFile(indexSource, "utf8"),
  ) as ApertureReferenceIndex;
  const manifest = JSON.parse(
    await readFile(manifestFile, "utf8"),
  ) as ApertureReferenceManifest;
  const diagnostics = await validateManifest(root, manifest);

  if (diagnostics.length > 0) {
    throw new Error(
      `Reference payload validation failed: ${diagnostics
        .map((diagnostic) => diagnostic.message)
        .join("; ")}`,
    );
  }

  await installReferenceEmbeddingModel(modelDir);

  await writeFile(
    indexFile,
    `${JSON.stringify({ ...index, manifest }, null, 2)}\n`,
    "utf8",
  );
  await syncSharedReferenceCache(root);
  await writeReferenceState(root, {
    source,
    status: "ready",
    updatedAt: new Date().toISOString(),
    manifest,
  });
}

async function downloadFile(url: string, destination: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(destination, buffer);
}
