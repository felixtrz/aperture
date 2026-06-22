import path from "node:path";
import type { ApertureReferenceSearchReport } from "./contracts.js";
import { readApertureReferenceIndex } from "./index-io.js";
import { MODEL_CONTRACT, sameModelContract } from "./model.js";
import {
  apertureReferenceIndexFile,
  apertureReferenceModelDir,
} from "./paths.js";
import {
  findReferenceDependentsInIndex,
  searchReferenceIndex,
} from "./search.js";
import type { SearchApertureReferencesOptions } from "./contracts.js";

export async function searchApertureReferences(
  options: SearchApertureReferencesOptions,
): Promise<ApertureReferenceSearchReport> {
  const root = path.resolve(options.cwd);
  const index = await readApertureReferenceIndex(root);
  if (!sameModelContract(index.model, MODEL_CONTRACT)) {
    throw new Error(
      "The warmed Aperture reference corpus was produced with a different embedding model contract. Run 'aperture reference warmup' to rebuild it.",
    );
  }
  const report = await searchReferenceIndex(
    index,
    options,
    apertureReferenceModelDir(root),
  );

  return {
    indexFile: apertureReferenceIndexFile(root),
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
