import path from "node:path";
import type {
  ApertureReferenceIndex,
  ApertureReferenceStatusDiagnostic,
  ApertureReferenceStatusReport,
} from "./contracts.js";
import { fileExists } from "./files.js";
import { readApertureReferenceIndex } from "./index-io.js";
import { validateManifest } from "./manifest.js";
import { MODEL_CONTRACT, sameModelContract } from "./model.js";
import {
  apertureReferenceArchiveFile,
  apertureReferenceIndexFile,
  apertureReferenceManifestFile,
  apertureReferenceStateFile,
} from "./paths.js";

export async function readApertureReferenceStatus(
  cwd: string,
): Promise<ApertureReferenceStatusReport> {
  const root = path.resolve(cwd);
  const indexFile = apertureReferenceIndexFile(root);
  const manifestFile = apertureReferenceManifestFile(root);
  const archiveFile = apertureReferenceArchiveFile(root);
  const stateFile = apertureReferenceStateFile(root);
  const diagnostics: ApertureReferenceStatusDiagnostic[] = [];
  let corruptIndex = false;

  let index: ApertureReferenceIndex | null = null;

  if (!(await fileExists(indexFile))) {
    diagnostics.push({
      code: "aperture.reference.indexMissing",
      message: `Aperture reference corpus is not warmed. Missing ${indexFile}.`,
      file: indexFile,
      suggestedFix: "Run 'aperture reference warmup'.",
    });
  } else {
    try {
      index = await readApertureReferenceIndex(root, { allowBuild: false });
    } catch (error: unknown) {
      corruptIndex = true;
      diagnostics.push({
        code: "aperture.reference.indexCorrupt",
        message: error instanceof Error ? error.message : String(error),
        file: indexFile,
        suggestedFix: "Run 'aperture reference warmup'.",
      });
    }
  }

  if (index !== null && !sameModelContract(index.model, MODEL_CONTRACT)) {
    diagnostics.push({
      code: "aperture.reference.modelMismatch",
      message:
        "The warmed reference corpus was produced with a different embedding model contract.",
      file: indexFile,
      suggestedFix: "Run 'aperture reference warmup' to rebuild the corpus.",
    });
  }

  if (index !== null) {
    diagnostics.push(...(await validateManifest(root, index.manifest)));
  }

  const modelMismatch = diagnostics.some(
    (diagnostic) => diagnostic.code === "aperture.reference.modelMismatch",
  );
  const ok = index !== null && diagnostics.length === 0;

  return {
    ok,
    status:
      index === null
        ? corruptIndex
          ? "corrupt"
          : "missing"
        : modelMismatch
          ? "model-mismatch"
          : ok
            ? "ready"
            : "corrupt",
    root,
    indexFile,
    manifestFile,
    archiveFile,
    stateFile,
    chunks: index?.chunks.length ?? 0,
    sources: index?.sources.length ?? 0,
    model: index?.model ?? MODEL_CONTRACT,
    diagnostics,
  };
}
