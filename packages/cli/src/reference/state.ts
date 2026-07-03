import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ApertureReferenceManifest } from "./contracts.js";
import { fileExists } from "./files.js";
import {
  ARCHIVE_FILE,
  MANIFEST_FILE,
  apertureReferenceArchiveFile,
  apertureReferenceManifestFile,
  apertureReferenceStateFile,
} from "./paths.js";

export async function writeReferenceState(
  root: string,
  state: {
    readonly source: "workspace" | "directory" | "url";
    readonly status: "ready";
    readonly updatedAt: string;
    readonly manifest: ApertureReferenceManifest;
  },
): Promise<void> {
  const stateFile = apertureReferenceStateFile(root);

  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function syncSharedReferenceCache(root: string): Promise<void> {
  const sharedDir = apertureReferenceSharedCacheDir();
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);

  await mkdir(sharedDir, { recursive: true });

  if (await fileExists(manifestFile)) {
    await publishToSharedCache(manifestFile, sharedDir, MANIFEST_FILE);
  }

  if (await fileExists(archiveFile)) {
    await publishToSharedCache(archiveFile, sharedDir, ARCHIVE_FILE);
  }
}

/**
 * Copy through a same-directory temp file and rename into place. The shared
 * cache is machine-global: concurrent warms (CI jobs, a second checkout
 * sharing $HOME) interleaving plain copyFile calls could leave a torn
 * manifest or archive for whoever reads the cache next.
 */
async function publishToSharedCache(
  sourceFile: string,
  sharedDir: string,
  fileName: string,
): Promise<void> {
  const tempFile = path.join(
    sharedDir,
    `.${fileName}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`,
  );

  await copyFile(sourceFile, tempFile);
  try {
    await rename(tempFile, path.join(sharedDir, fileName));
  } catch (error) {
    await rm(tempFile, { force: true });
    throw error;
  }
}

export function apertureReferenceSharedCacheDir(): string {
  // Test/CI override: warming publishes to this machine-global cache, so
  // suites point it at a per-run temp dir instead of polluting the real user
  // cache on every test run.
  const override = process.env["APERTURE_REFERENCE_CACHE_DIR"];
  if (override !== undefined && override.length > 0) {
    return override;
  }

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Caches",
      "aperture",
      "reference",
    );
  }

  if (process.platform === "win32") {
    return path.join(
      process.env["LOCALAPPDATA"] ?? os.tmpdir(),
      "aperture",
      "reference",
    );
  }

  return path.join(
    process.env["XDG_CACHE_HOME"] ?? path.join(os.homedir(), ".cache"),
    "aperture",
    "reference",
  );
}
