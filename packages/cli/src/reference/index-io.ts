import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildApertureReferenceIndex } from "./build.js";
import { INDEX_VERSION, type ApertureReferenceIndex } from "./contracts.js";
import { isNodeErrorCode } from "./files.js";
import { apertureReferenceIndexFile } from "./paths.js";

interface ReadIndexOptions {
  readonly allowBuild?: boolean;
}

export async function readApertureReferenceIndex(
  cwd: string,
  options: ReadIndexOptions = { allowBuild: false },
): Promise<ApertureReferenceIndex> {
  const root = path.resolve(cwd);
  const indexFile = apertureReferenceIndexFile(root);

  try {
    const source = await readFile(indexFile, "utf8");
    const parsed = JSON.parse(source) as ApertureReferenceIndex;

    if (parsed.version !== INDEX_VERSION) {
      throw new Error(
        `Unsupported Aperture reference index version '${String(parsed.version)}'.`,
      );
    }

    return parsed;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT") && options.allowBuild === true) {
      await buildApertureReferenceIndex({ cwd: root });
      return readApertureReferenceIndex(root, { allowBuild: false });
    }

    if (isNodeErrorCode(error, "ENOENT")) {
      throw new Error(
        `Aperture reference corpus is not warmed. Run 'aperture reference warmup'. Missing ${indexFile}.`,
        { cause: error },
      );
    }

    throw error;
  }
}

export async function ensureApertureReferenceIndex(
  cwd: string,
): Promise<ApertureReferenceIndex> {
  return readApertureReferenceIndex(cwd, { allowBuild: true });
}
