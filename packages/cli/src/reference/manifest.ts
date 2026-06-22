import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ApertureReferenceManifest,
  ApertureReferenceManifestFile,
  ApertureReferenceStatusDiagnostic,
} from "./contracts.js";
import { apertureReferenceRuntimeDir } from "./paths.js";
import { fileExists, normalizePath, sha256 } from "./files.js";
import { MODEL_CONTRACT, sameModelContract } from "./model.js";

export async function validateManifest(
  root: string,
  manifest: ApertureReferenceManifest,
): Promise<readonly ApertureReferenceStatusDiagnostic[]> {
  const runtimeDir = apertureReferenceRuntimeDir(root);
  const diagnostics: ApertureReferenceStatusDiagnostic[] = [];

  if (!sameModelContract(manifest.model, MODEL_CONTRACT)) {
    diagnostics.push({
      code: "aperture.reference.modelMismatch",
      message:
        "The manifest model contract does not match the CLI query model contract.",
      suggestedFix: "Run 'aperture reference warmup' with a matching payload.",
    });
  }

  for (const file of manifest.files) {
    const absoluteFile = path.join(runtimeDir, file.path);

    if (!(await fileExists(absoluteFile))) {
      diagnostics.push({
        code: "aperture.reference.fileMissing",
        message: `Reference payload file '${file.path}' is missing.`,
        file: absoluteFile,
        suggestedFix: "Run 'aperture reference warmup' to repair the cache.",
      });
      continue;
    }

    const actual = await fileManifest(runtimeDir, absoluteFile);

    if (actual.bytes !== file.bytes || actual.sha256 !== file.sha256) {
      diagnostics.push({
        code: "aperture.reference.fileCorrupt",
        message: `Reference payload file '${file.path}' does not match the manifest hash.`,
        file: absoluteFile,
        suggestedFix: "Run 'aperture reference warmup' to repair the cache.",
      });
    }
  }

  return diagnostics;
}

export async function manifestFiles(
  runtimeDir: string,
  relativeRoots: readonly string[],
): Promise<readonly ApertureReferenceManifestFile[]> {
  const files: ApertureReferenceManifestFile[] = [];

  for (const relativeRoot of relativeRoots) {
    const absoluteRoot = path.join(runtimeDir, relativeRoot);

    for (const file of await collectManifestFiles(absoluteRoot)) {
      files.push(await fileManifest(runtimeDir, file));
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function fileManifest(
  root: string,
  file: string,
): Promise<ApertureReferenceManifestFile> {
  const buffer = await readFile(file);

  return {
    path: normalizePath(path.relative(root, file)),
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

async function collectManifestFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }

  await visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}
