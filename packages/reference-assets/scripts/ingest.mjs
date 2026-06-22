#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = findWorkspaceRoot(packageRoot);
const packageDataDir = path.join(packageRoot, "data");
const publishedRootLabel = "@aperture-engine/reference-assets";

async function main() {
  run("pnpm", ["--filter", "@aperture-engine/cli", "run", "build"], {
    cwd: workspaceRoot,
  });

  const cli = await import(
    pathToFileURL(path.join(workspaceRoot, "packages/cli/dist/index.js")).href
  );

  const report = await cli.buildApertureReferenceIndex({
    cwd: workspaceRoot,
  });

  await rm(packageDataDir, { force: true, recursive: true });
  await mkdir(packageDataDir, { recursive: true });
  await cp(report.dataDir, packageDataDir, { recursive: true });
  await scrubEmbeddingsMetadata(path.join(packageDataDir, "embeddings.json"));

  process.stdout.write(
    `Ingested Aperture reference corpus into ${packageDataDir} (${report.chunks} chunks, ${report.sources} sources).\n`,
  );
}

async function scrubEmbeddingsMetadata(embeddingsFile) {
  const parsed = JSON.parse(await readFile(embeddingsFile, "utf8"));

  parsed.root = publishedRootLabel;

  if (parsed.manifest?.corpus !== undefined) {
    parsed.manifest.corpus.root = publishedRootLabel;
  }

  await writeFile(
    embeddingsFile,
    `${JSON.stringify(parsed, null, 2)}\n`,
    "utf8",
  );
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    ...options,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);

  while (true) {
    if (
      existsSync(path.join(current, "pnpm-workspace.yaml")) &&
      existsSync(
        path.join(current, "packages/reference-assets/package.json"),
      ) &&
      existsSync(path.join(current, "packages/cli/package.json"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        `Unable to find Aperture workspace root from ${startDir}.`,
      );
    }
    current = parent;
  }
}

main().catch((error) => {
  process.stderr.write(
    `Failed to ingest @aperture-engine/reference-assets: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
  process.exit(1);
});
