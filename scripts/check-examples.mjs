#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

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
