#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const showcaseIds = ["city-builder", "fps", "platformer", "racing"];
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsSiteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(docsSiteDir, "..");
const distShowcaseDir = path.join(docsSiteDir, "dist", "showcase");
const base = process.env.APERTURE_DOCS_BASE ?? "/";
const normalizedBase = base.endsWith("/") ? base : `${base}/`;

async function assertFile(file, hint) {
  try {
    const result = await stat(file);
    if (result.isFile()) {
      return;
    }
  } catch {
    // Handled below.
  }
  throw new Error(`${hint} is missing: ${path.relative(repoRoot, file)}`);
}

async function main() {
  await rm(distShowcaseDir, { recursive: true, force: true });

  for (const showcaseId of showcaseIds) {
    const showcaseDir = path.join(repoRoot, "showcase", showcaseId);
    const showcaseDist = path.join(showcaseDir, "dist");
    const showcaseBase = `${normalizedBase}showcase/${showcaseId}/`;
    console.log(`Building showcase/${showcaseId} with base ${showcaseBase}`);
    const result = spawnSync(
      "pnpm",
      ["--dir", showcaseDir, "run", "build", `--base=${showcaseBase}`],
      {
        cwd: repoRoot,
        stdio: "inherit",
      },
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }

    await assertFile(
      path.join(showcaseDist, "index.html"),
      `showcase/${showcaseId}/dist/index.html`,
    );
    await cp(showcaseDist, path.join(distShowcaseDir, showcaseId), {
      dereference: true,
      recursive: true,
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
