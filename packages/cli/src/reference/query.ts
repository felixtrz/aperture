import path from "node:path";
import type { ApertureReferenceSearchReport } from "./contracts.js";
import { readApertureReferenceIndex } from "./index-io.js";
import { apertureReferenceIndexFile } from "./paths.js";
import {
  findReferenceDependentsInIndex,
  searchReferenceIndex,
} from "./search.js";
import type { SearchApertureReferencesOptions } from "./contracts.js";

export async function searchApertureReferences(
  options: SearchApertureReferencesOptions,
): Promise<ApertureReferenceSearchReport> {
  const index = await readApertureReferenceIndex(options.cwd);
  const report = searchReferenceIndex(index, options);

  return {
    indexFile: apertureReferenceIndexFile(path.resolve(options.cwd)),
    ...report,
  };
}

export async function findApertureReferenceDependents(options: {
  readonly cwd: string;
  readonly symbol: string;
  readonly limit?: number;
}): Promise<ApertureReferenceSearchReport> {
  const index = await readApertureReferenceIndex(options.cwd);
  const report = findReferenceDependentsInIndex(index, options);

  return {
    indexFile: apertureReferenceIndexFile(path.resolve(options.cwd)),
    ...report,
  };
}
