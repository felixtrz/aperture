#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
  mkdir,
} from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import { fileURLToPath } from "node:url";
import { writeBrowserSearchAsset } from "./browser-search-asset.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dataDir = path.join(packageRoot, "data");
const distDir = path.join(packageRoot, "dist");
const manifestFile = path.join(distDir, "manifest.json");
const archiveFile = path.join(distDir, "data.tgz");
const browserSearchFile = path.join(distDir, "browser-search.json");
const allowMissing = process.argv.includes("--if-ready");

async function main() {
  const embeddingsFile = path.join(dataDir, "embeddings.json");

  if (!(await fileExists(embeddingsFile))) {
    if (allowMissing) {
      await rm(distDir, { force: true, recursive: true });
      process.stdout.write(
        "Skipping @aperture-engine/reference-assets dist build because data/embeddings.json is not present.\n",
      );
      return;
    }

    throw new Error(
      'Missing data/embeddings.json. Run "pnpm --filter @aperture-engine/reference-assets run ingest" first.',
    );
  }

  await rm(distDir, { force: true, recursive: true });
  await mkdir(distDir, { recursive: true });

  await tar.c(
    {
      cwd: packageRoot,
      file: archiveFile,
      gzip: true,
      portable: true,
      noPax: true,
      mtime: new Date(0),
    },
    ["data"],
  );

  const index = JSON.parse(await readFile(embeddingsFile, "utf8"));
  const archive = await fileManifest(distDir, archiveFile);
  const browserSearch = await writeBrowserSearchAsset({
    embeddingsFile,
    outputFile: browserSearchFile,
  });
  const files = await manifestFiles(packageRoot, dataDir);
  const manifest = {
    schemaVersion: index.manifest?.schemaVersion ?? 1,
    indexVersion: index.version,
    corpus: {
      name: index.manifest?.corpus?.name ?? "aperture-developer-api",
      root: index.root ?? "@aperture-engine/reference-assets",
      generatedAt: index.createdAt,
      chunks: index.chunks?.length ?? 0,
      sources: index.sources?.length ?? 0,
    },
    model: index.model,
    files,
    archive,
    browserSearch: await fileManifest(distDir, browserSearch.outputFile),
  };

  await writeFile(
    manifestFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(
    `Built @aperture-engine/reference-assets dist (${archive.bytes} B data archive, ${browserSearch.bytes} B browser search asset, ${files.length} files).\n`,
  );
}

async function manifestFiles(root, relativeRoot) {
  const files = [];

  for (const file of await collectFiles(relativeRoot)) {
    files.push(await fileManifest(root, file));
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function fileManifest(root, file) {
  const buffer = await readFile(file);

  return {
    path: toPosixPath(path.relative(root, file)),
    bytes: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function collectFiles(root) {
  const out = [];

  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);

    if (entry.isDirectory()) {
      out.push(...(await collectFiles(absolute)));
    } else if (entry.isFile()) {
      out.push(absolute);
    }
  }

  return out.sort((a, b) => a.localeCompare(b));
}

async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

main().catch((error) => {
  process.stderr.write(
    `Failed to build @aperture-engine/reference-assets: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
  process.exit(1);
});
