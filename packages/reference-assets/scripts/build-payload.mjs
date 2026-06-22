#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

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
  const inputs = getReferencePayloadBuildInputs();

  if (allowMissing && !inputs.hasEmbeddingsData) {
    process.stdout.write(
      "Skipping reference payload build because no existing data payload is available yet.\n",
    );
    return;
  }

  run("pnpm", ["run", "ingest"]);
  run(process.execPath, ["./scripts/build-assets.mjs"]);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
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
