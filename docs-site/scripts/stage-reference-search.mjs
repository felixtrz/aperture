#!/usr/bin/env node

import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(docsRoot, "..");
const sourceFile = path.join(
  workspaceRoot,
  "packages/reference-assets/dist/browser-search.json",
);
const outputFile = path.join(docsRoot, "public/reference-search/index.json");

async function main() {
  if (!(await fileExists(sourceFile))) {
    await rm(path.dirname(outputFile), { force: true, recursive: true });
    process.stdout.write(
      "Skipping local reference search asset staging; packages/reference-assets/dist/browser-search.json is not present.\n",
    );
    return;
  }

  await mkdir(path.dirname(outputFile), { recursive: true });
  await copyFile(sourceFile, outputFile);
  process.stdout.write(
    `Staged reference search asset at ${path.relative(workspaceRoot, outputFile)}.\n`,
  );
}

async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

main().catch((error) => {
  process.stderr.write(
    `Failed to stage reference search asset: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
  process.exit(1);
});
