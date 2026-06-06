#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const examplesDir = path.join(process.cwd(), "examples");
const htmlFiles = (await readdir(examplesDir))
  .filter((entry) => entry.endsWith(".html") && entry !== "index.html")
  .sort();
const indexHtml = await readFile(path.join(examplesDir, "index.html"), "utf8");
const linkedFiles = new Set(
  [...indexHtml.matchAll(/href="\/examples\/([^"?]+\.html)(?:\?[^"]*)?"/gu)]
    .map((match) => match[1])
    .filter((file) => file !== undefined),
);

const missing = htmlFiles.filter((file) => !linkedFiles.has(file));
const stale = [...linkedFiles].filter((file) => !htmlFiles.includes(file));

for (const file of missing) {
  console.error(`examples/index.html does not link ${file}`);
}
for (const file of stale) {
  console.error(`examples/index.html links missing page ${file}`);
}

if (missing.length > 0 || stale.length > 0) {
  process.exitCode = 1;
}
