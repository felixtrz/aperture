import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadRepositoryInventory,
  loadExperimentRegistry,
  repositoryRoot,
  verifyExperimentFreezes,
  verifyPreservedEvidence,
} from "./check-preserved-evidence.mjs";

/** Standard Prettier, with exact exclusions only after retained bytes verify. */
export async function formatRepository(
  mode,
  {
    root = repositoryRoot,
    inventory,
    experimentRegistry,
    spawn = spawnSync,
  } = {},
) {
  assert.ok(
    mode === "--check" || mode === "--write",
    "Expected --check or --write",
  );
  const production = inventory === undefined;
  inventory ??= await loadRepositoryInventory();
  experimentRegistry ??= production
    ? await loadExperimentRegistry()
    : {
        schema: "aperture.experiment-freeze-registry.v1",
        purpose: "Isolated formatter test",
        inventories: [],
      };
  const preserved = [
    ...new Set([
      ...(await verifyPreservedEvidence(root, inventory)),
      ...(await verifyExperimentFreezes(root, experimentRegistry)),
    ]),
  ];
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "aperture-format-"),
  );
  try {
    const ignore = path.join(temporary, "preserved.ignore");
    // Prettier resolves ignore patterns relative to the ignore file, including ../.
    await fs.writeFile(
      ignore,
      preserved
        .map((relative) =>
          path
            .relative(temporary, path.join(root, relative))
            .split(path.sep)
            .join("/"),
        )
        .join("\n") + "\n",
    );
    const result = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/prettier/bin/prettier.cjs"),
        mode,
        ".",
        "--ignore-path",
        path.join(root, ".gitignore"),
        "--ignore-path",
        path.join(root, ".prettierignore"),
        "--ignore-path",
        ignore,
      ],
      { cwd: root, stdio: "inherit" },
    );
    if (result.error) throw result.error;
    return result.status ?? 1;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assert.equal(process.argv.length, 3, "Supply only --check or --write");
    process.exitCode = await formatRepository(process.argv[2]);
  } catch (error) {
    console.error(`Repository formatting failed: ${error.message}`);
    process.exitCode = 1;
  }
}
