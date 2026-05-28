import { copyFile, mkdir, writeFile } from "node:fs/promises";
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
    await copyFile(manifestFile, path.join(sharedDir, MANIFEST_FILE));
  }

  if (await fileExists(archiveFile)) {
    await copyFile(archiveFile, path.join(sharedDir, ARCHIVE_FILE));
  }
}

export function apertureReferenceSharedCacheDir(): string {
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
