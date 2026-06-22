import type {
  ApertureReferenceChunk,
  ApertureReferenceEntry,
  ApertureReferenceSource,
} from "./contracts.js";
import { uniqueSorted } from "./files.js";
import type { ApertureReferenceSourceCategory } from "./source-filter.js";

export function createReferenceEntries(
  sources: readonly ApertureReferenceSource[],
  chunks: readonly ApertureReferenceChunk[],
): readonly ApertureReferenceEntry[] {
  return sources.map((source) => {
    const sourceChunks = chunks.filter(
      (chunk) => chunk.metadata.file === source.file,
    );

    return {
      file: source.file,
      bytes: source.bytes,
      kind: entryKind(source.file, source.sourceCategory),
      sourceCategory: source.sourceCategory,
      symbols: uniqueSorted(sourceChunks.map((chunk) => chunk.metadata.name)),
      components: uniqueSorted(
        sourceChunks.flatMap((chunk) => chunk.metadata.componentIds),
      ),
      systems: uniqueSorted(
        sourceChunks.flatMap((chunk) => chunk.metadata.systemNames),
      ),
      diagnostics: uniqueSorted(
        sourceChunks.flatMap((chunk) => chunk.metadata.diagnostics),
      ),
      text: source.text,
      chunks: sourceChunks.map((chunk) => chunk.id),
    };
  });
}

export function entryKind(
  file: string,
  sourceCategory: ApertureReferenceSourceCategory,
): ApertureReferenceEntry["kind"] {
  switch (sourceCategory) {
    case "docs":
      return "doc";
    case "example":
      return "example";
    case "external":
      return "reference";
    case "api":
    case "diagnostic":
      return "source";
    case "template":
      return file.endsWith(".ts") ? "source" : "other";
  }
}
