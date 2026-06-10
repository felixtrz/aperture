#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  resolveStaticPath,
  resolveWorkerModulePath,
} from "./serve-examples.mjs";

const examplesDir = path.join(process.cwd(), "examples");
const exampleFiles = (await readdir(examplesDir))
  .filter((entry) => entry.endsWith(".js"))
  .sort();

if (exampleFiles.length === 0) {
  console.error("No example JavaScript files found.");
  process.exitCode = 1;
} else {
  for (const exampleFile of exampleFiles) {
    const relativePath = path.join("examples", exampleFile);
    const result = spawnSync(process.execPath, ["--check", relativePath], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    });

    if (result.status !== 0) {
      if (result.stdout.length > 0) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr.length > 0) {
        process.stderr.write(result.stderr);
      }

      console.error(`Example syntax check failed: ${relativePath}`);
      process.exitCode = result.status ?? 1;
      break;
    }
  }
}

// Every import-map target in the example HTML pages must resolve to a real
// file through the same resolution the example server uses. The browser is the
// only other place these paths are exercised, so without this check a moved or
// removed dependency (e.g. dropping a root node_modules package that 100+
// import maps point at) passes `pnpm run check` and only fails in e2e.
if (process.exitCode === undefined || process.exitCode === 0) {
  const htmlFiles = (await readdir(examplesDir))
    .filter((entry) => entry.endsWith(".html"))
    .sort();
  const importMapPattern =
    /<script[^>]*type="importmap"[^>]*>([\s\S]*?)<\/script>/g;
  const failures = [];
  // Identical targets repeat across the gallery; resolve each once.
  const checkedTargets = new Map();

  for (const htmlFile of htmlFiles) {
    const source = await readFile(path.join(examplesDir, htmlFile), "utf8");

    for (const match of source.matchAll(importMapPattern)) {
      let imports;

      try {
        imports = JSON.parse(match[1] ?? "{}").imports ?? {};
      } catch (error) {
        failures.push(
          `${htmlFile}: import map is not valid JSON (${error.message})`,
        );
        continue;
      }

      for (const [specifier, target] of Object.entries(imports)) {
        if (typeof target !== "string" || !target.startsWith("/")) {
          continue;
        }

        let ok = checkedTargets.get(target);

        if (ok === undefined) {
          const resolved =
            resolveWorkerModulePath(target) ?? resolveStaticPath(target);
          ok = resolved !== null && existsSync(resolved);
          checkedTargets.set(target, ok);
        }

        if (!ok) {
          failures.push(
            `${htmlFile}: import map entry '${specifier}' -> '${target}' does not resolve to a file`,
          );
        }
      }
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    console.error(
      `Example import-map check failed (${failures.length} unresolved entries). ` +
        "Run pnpm run build first if dist/ paths are missing; otherwise fix the import map or restore the dependency.",
    );
    process.exitCode = 1;
  } else {
    console.log(
      `Example import-map check passed (${checkedTargets.size} unique targets).`,
    );
  }
}
