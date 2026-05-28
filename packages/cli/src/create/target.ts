import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { ApertureCliError } from "../errors.js";

export async function assertWritableTarget(
  targetDir: string,
  force: boolean,
): Promise<void> {
  try {
    const targetStat = await stat(targetDir);

    if (!targetStat.isDirectory()) {
      throw new ApertureCliError(
        "aperture.create.targetNotDirectory",
        `Create target '${targetDir}' exists and is not a directory.`,
      );
    }

    const entries = await readdir(targetDir);
    if (!force && entries.length > 0) {
      throw new ApertureCliError(
        "aperture.create.targetNotEmpty",
        `Create target '${targetDir}' is not empty. Re-run with --force to write starter files into it.`,
      );
    }
  } catch (error: unknown) {
    if (error instanceof ApertureCliError) {
      throw error;
    }

    if (isNodeErrorCode(error, "ENOENT")) {
      await mkdir(targetDir, { recursive: true });
      return;
    }

    throw error;
  }
}

export function resolveTargetDir(cwd: string, name: string): string {
  return path.resolve(cwd, name);
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}
