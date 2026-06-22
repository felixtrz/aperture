#!/usr/bin/env node
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsSiteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(docsSiteDir, "..");
const distDir = path.join(docsSiteDir, "dist");
const pagesDir = path.join(repoRoot, "docs");
const manifestPath = path.join(pagesDir, ".docs-site-publish-manifest.json");
const dryRun = process.argv.includes("--dry-run");
const confirmed = process.argv.includes("--confirm-root-cutover");
const showcaseIds = ["city-builder", "fps", "platformer", "racing"];

if (!dryRun && !confirmed) {
  console.error(
    "Refusing to publish without --confirm-root-cutover. Use --dry-run to inspect the copy plan.",
  );
  process.exit(1);
}

function relative(file) {
  return path.relative(repoRoot, file);
}

function assertInside(parent, child) {
  const relativePath = path.relative(parent, child);
  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Refusing to operate outside ${parent}: ${child}`);
  }
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { files: [] };
    }
    throw error;
  }
}

async function removeEmptyParents(startDir) {
  let current = startDir;
  while (current !== pagesDir && current.startsWith(pagesDir)) {
    try {
      await rm(current, { recursive: false });
    } catch {
      return;
    }
    current = path.dirname(current);
  }
}

async function main() {
  if (!(await exists(path.join(distDir, "index.html")))) {
    throw new Error(
      "docs-site/dist/index.html is missing. Run the docs build first.",
    );
  }
  if (await exists(path.join(distDir, "status", "index.html"))) {
    throw new Error(
      "docs-site/dist/status/index.html must not be generated or deployed.",
    );
  }

  const distFiles = await listFiles(distDir);
  for (const showcaseId of showcaseIds) {
    const stagedShowcaseHtml = path.join(
      distDir,
      "showcase",
      showcaseId,
      "index.html",
    );
    if (!(await exists(stagedShowcaseHtml))) {
      throw new Error(
        `docs-site/dist/showcase/${showcaseId}/index.html is missing. Run docs-site build:showcases before publishing.`,
      );
    }
  }
  const previousManifest = await readManifest();
  const nextFiles = new Set(distFiles);
  const copyOps = distFiles.map((file) => ({
    from: path.join(distDir, file),
    to: path.join(pagesDir, file),
    file,
    sourceLabel: path.join("docs-site", "dist", file),
  }));

  const staleFiles = previousManifest.files
    .filter((file) => !nextFiles.has(file))
    .sort();

  console.log(
    `${dryRun ? "Dry run" : "Publishing"} ${copyOps.length} file(s) from docs-site/dist to ${relative(
      pagesDir,
    )}.`,
  );
  if (staleFiles.length > 0) {
    console.log(
      `Removing ${staleFiles.length} stale file(s) from the previous manifest.`,
    );
    for (const file of staleFiles.slice(0, 20)) {
      console.log(`  remove ${path.join("docs", file)}`);
    }
    if (staleFiles.length > 20) {
      console.log(`  ... ${staleFiles.length - 20} more`);
    }
  }
  for (const operation of copyOps.slice(0, 20)) {
    console.log(
      `  copy ${operation.sourceLabel} -> ${path.join("docs", operation.file)}`,
    );
  }
  if (copyOps.length > 20) {
    console.log(`  ... ${copyOps.length - 20} more`);
  }

  if (dryRun) {
    return;
  }

  for (const file of staleFiles) {
    const target = path.join(pagesDir, file);
    assertInside(pagesDir, target);
    await rm(target, { force: true });
    await removeEmptyParents(path.dirname(target));
  }

  for (const operation of copyOps) {
    assertInside(pagesDir, operation.to);
    await mkdir(path.dirname(operation.to), { recursive: true });
    if (operation.contents !== undefined) {
      await writeFile(operation.to, operation.contents, "utf8");
    } else {
      await copyFile(operation.from, operation.to);
    }
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "docs-site/dist",
        files: [...nextFiles].sort(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
