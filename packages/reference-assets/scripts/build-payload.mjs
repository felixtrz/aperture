#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = findWorkspaceRoot(packageRoot);
const dataDir = path.join(packageRoot, "data");
const distDir = path.join(packageRoot, "dist");
const publishedRootLabel = "@aperture-engine/reference-assets";

export function getReferencePayloadBuildInputs({ root = packageRoot } = {}) {
  const resolvedRoot = path.resolve(root);
  const embeddingsPath = path.join(resolvedRoot, "data", "embeddings.json");

  return {
    root: resolvedRoot,
    embeddingsPath,
    hasEmbeddingsData: existsSync(embeddingsPath),
    canRunIngest: true,
  };
}

export function describeMissingPayloadInputs() {
  return (
    "Reference payload generation downloads the pinned embedding model automatically. " +
    "Use build:payload:if-ready only when package lifecycle scripts should skip missing producer data."
  );
}

export async function main(argv = process.argv.slice(2)) {
  const allowMissing = argv.includes("--if-ready");
  const allowCurrent = argv.includes("--if-current");
  const inputs = getReferencePayloadBuildInputs();

  if (allowMissing && !inputs.hasEmbeddingsData) {
    process.stdout.write(
      "Skipping reference payload build because no existing data payload is available yet.\n",
    );
    return;
  }

  if (allowCurrent) {
    const current = await checkReferencePayloadCurrent();

    if (current.ok) {
      process.stdout.write(
        "Reference payload is current; skipping generation.\n",
      );
      return;
    }

    process.stdout.write(
      `Reference payload is not current: ${current.reason}\nRegenerating reference payload.\n`,
    );
  }

  run("pnpm", ["run", "ingest"]);
  run(process.execPath, ["./scripts/build-assets.mjs"]);
}

async function checkReferencePayloadCurrent() {
  try {
    return await verifyReferencePayloadCurrent();
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyReferencePayloadCurrent() {
  const embeddingsFile = path.join(dataDir, "embeddings.json");
  const manifestFile = path.join(distDir, "manifest.json");
  const archiveFile = path.join(distDir, "data.tgz");
  const browserSearchFile = path.join(distDir, "browser-search.json");

  for (const file of [
    embeddingsFile,
    manifestFile,
    archiveFile,
    browserSearchFile,
  ]) {
    if (!(await fileExists(file))) {
      return {
        ok: false,
        reason: `missing ${path.relative(packageRoot, file)}`,
      };
    }
  }

  run("pnpm", ["--filter", "@aperture-engine/cli", "run", "build"], {
    cwd: workspaceRoot,
  });

  const [{ ingestApertureReferenceCorpus }, model] = await Promise.all([
    import(
      pathToFileURL(
        path.join(workspaceRoot, "packages/cli/dist/reference/corpus.js"),
      ).href
    ),
    import(
      pathToFileURL(
        path.join(workspaceRoot, "packages/cli/dist/reference/model.js"),
      ).href
    ),
  ]);
  const existing = JSON.parse(await readFile(embeddingsFile, "utf8"));

  if (existing.root !== publishedRootLabel) {
    return {
      ok: false,
      reason: "data/embeddings.json has a workspace root label",
    };
  }

  if (
    !model.sameModelContract(existing.model, model.MODEL_CONTRACT) ||
    !model.sameModelContract(
      existing.manifest?.model ?? existing.model,
      model.MODEL_CONTRACT,
    )
  ) {
    return {
      ok: false,
      reason: "reference model contract changed",
    };
  }

  const current = await ingestApertureReferenceCorpus(workspaceRoot);

  const currentSourceDigest = digestJson(
    current.sources.map(sourceFreshnessRecord),
  );
  const existingSourceDigest = digestJson(
    existing.sources.map(sourceFreshnessRecord),
  );

  if (currentSourceDigest !== existingSourceDigest) {
    return {
      ok: false,
      reason: "reference source snapshot changed",
    };
  }

  const currentChunkDigest = digestJson(
    current.chunks.map((chunk) => ({
      id: chunkId(chunk.metadata),
      content: chunk.content,
      metadata: chunkMetadataFreshnessRecord(chunk.metadata),
    })),
  );
  const existingChunkDigest = digestJson(
    existing.chunks.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      metadata: chunkMetadataFreshnessRecord(chunk.metadata),
    })),
  );

  if (currentChunkDigest !== existingChunkDigest) {
    return {
      ok: false,
      reason: "reference chunk snapshot changed",
    };
  }

  for (const source of current.sources) {
    const snapshotFile = path.join(dataDir, "sources", source.file);

    if (!(await fileExists(snapshotFile))) {
      return {
        ok: false,
        reason: `missing source snapshot data/sources/${source.file}`,
      };
    }

    const snapshot = await readFile(snapshotFile, "utf8");
    if (source.sha256 !== sha256(snapshot)) {
      return {
        ok: false,
        reason: `source snapshot data/sources/${source.file} is stale`,
      };
    }
  }

  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));

  if (
    manifest.corpus?.root !== publishedRootLabel ||
    manifest.corpus?.chunks !== current.chunks.length ||
    manifest.corpus?.sources !== current.sources.length
  ) {
    return {
      ok: false,
      reason: "dist manifest corpus metadata is stale",
    };
  }

  if (!model.sameModelContract(manifest.model, model.MODEL_CONTRACT)) {
    return {
      ok: false,
      reason: "dist manifest model contract changed",
    };
  }

  const dataManifest = await manifestFiles(packageRoot, dataDir);
  if (digestJson(dataManifest) !== digestJson(manifest.files)) {
    return {
      ok: false,
      reason: "dist manifest data file hashes are stale",
    };
  }

  const archive = await fileManifest(distDir, archiveFile);
  if (digestJson(archive) !== digestJson(manifest.archive)) {
    return {
      ok: false,
      reason: "dist archive hash is stale",
    };
  }

  const browserSearch = await fileManifest(distDir, browserSearchFile);
  if (digestJson(browserSearch) !== digestJson(manifest.browserSearch)) {
    return {
      ok: false,
      reason: "browser search asset hash is stale",
    };
  }

  return { ok: true };
}

function sourceFreshnessRecord(source) {
  return {
    file: source.file,
    bytes: source.bytes,
    sha256: source.sha256,
    sourceCategory: source.sourceCategory,
  };
}

function chunkMetadataFreshnessRecord(metadata) {
  return {
    sourceCategory: metadata.sourceCategory,
    packageName: metadata.packageName ?? null,
    entrypoint: metadata.entrypoint ?? null,
    file: metadata.file,
    chunkType: metadata.chunkType,
    name: metadata.name,
    exportedName: metadata.exportedName ?? null,
    startLine: metadata.startLine,
    endLine: metadata.endLine,
    classContext: metadata.classContext ?? null,
    imports: metadata.imports,
    exports: metadata.exports,
    calls: metadata.calls,
    extends: metadata.extends,
    implements: metadata.implements,
    usesTypes: metadata.usesTypes,
    componentIds: metadata.componentIds,
    systemNames: metadata.systemNames,
    systemPriority: metadata.systemPriority ?? null,
    diagnostics: metadata.diagnostics,
  };
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
    sha256: sha256(buffer),
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

function digestJson(value) {
  return sha256(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function chunkId(metadata) {
  return sha256(
    [
      metadata.sourceCategory,
      metadata.file,
      metadata.startLine,
      metadata.endLine,
      metadata.chunkType,
      metadata.name,
    ].join(":"),
  ).slice(0, 24);
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

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? packageRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `Failed to build @aperture-engine/reference-assets payload: ${
        error instanceof Error ? error.message : String(error)
      }\n`,
    );
    process.exit(1);
  });
}
