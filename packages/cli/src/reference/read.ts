import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ApertureReferenceEntry } from "./contracts.js";
import { entryKind } from "./entries.js";
import {
  isNodeErrorCode,
  normalizePath,
  sliceLines,
  uniqueSorted,
} from "./files.js";
import { readApertureReferenceIndex } from "./index-io.js";
import { SOURCES_DIRECTORY, apertureReferenceDataDir } from "./paths.js";

export async function readApertureReferenceFile(
  cwd: string,
  file: string,
  options: { readonly startLine?: number; readonly endLine?: number } = {},
): Promise<ApertureReferenceEntry | null> {
  const index = await readApertureReferenceIndex(cwd);
  const root = path.resolve(cwd);
  const normalized = normalizePath(file);
  const source = index.sources.find((entry) => entry.file === normalized);

  if (source === undefined) {
    return null;
  }

  const warmedText = await readWarmedSourceFile(root, normalized, source.text);
  const text =
    options.startLine === undefined && options.endLine === undefined
      ? warmedText
      : sliceLines(warmedText, options.startLine, options.endLine);
  const chunks = index.chunks.filter(
    (chunk) => chunk.metadata.file === normalized,
  );

  return {
    file: source.file,
    bytes: source.bytes,
    kind: entryKind(source.file, source.sourceCategory),
    sourceCategory: source.sourceCategory,
    symbols: uniqueSorted(chunks.map((chunk) => chunk.metadata.name)),
    components: uniqueSorted(
      chunks.flatMap((chunk) => chunk.metadata.componentIds),
    ),
    systems: uniqueSorted(
      chunks.flatMap((chunk) => chunk.metadata.systemNames),
    ),
    diagnostics: uniqueSorted(
      chunks.flatMap((chunk) => chunk.metadata.diagnostics),
    ),
    text,
    chunks: chunks.map((chunk) => chunk.id),
  };
}

export async function listApertureReferenceComponents(
  cwd: string,
): Promise<readonly string[]> {
  const index = await readApertureReferenceIndex(cwd);

  return uniqueSorted(
    index.chunks.flatMap((chunk) => chunk.metadata.componentIds),
  );
}

export async function listApertureReferenceSystems(
  cwd: string,
): Promise<readonly string[]> {
  const index = await readApertureReferenceIndex(cwd);

  return uniqueSorted(
    index.chunks.flatMap((chunk) => chunk.metadata.systemNames),
  );
}

async function readWarmedSourceFile(
  root: string,
  file: string,
  fallback: string,
): Promise<string> {
  const sourceFile = path.join(
    apertureReferenceDataDir(root),
    SOURCES_DIRECTORY,
    file,
  );

  try {
    return await readFile(sourceFile, "utf8");
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return fallback;
    }

    throw error;
  }
}
