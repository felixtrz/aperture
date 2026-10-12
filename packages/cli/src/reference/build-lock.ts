import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";

/** Fail fast across calls and processes instead of risking concurrent rollback. */
export async function withReferenceBuildLock<T>(
  runtimeDir: string,
  build: () => Promise<T>,
): Promise<T> {
  const lockFile = `${runtimeDir}.build.lock`;
  await mkdir(path.dirname(lockFile), { recursive: true });
  const handle = await open(lockFile, "wx").catch((error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      throw new Error(
        `Aperture reference corpus is already generating for ${runtimeDir}. Wait for the current build and retry. If its process has ended, remove the stale lock ${lockFile} before retrying.`,
        { cause: error },
      );
    }
    throw error;
  });
  try {
    await handle.writeFile(
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), runtimeDir })}\n`,
      "utf8",
    );
    return await build();
  } finally {
    try {
      await handle.close();
    } finally {
      await rm(lockFile, { force: true });
    }
  }
}
