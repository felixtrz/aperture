#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const examplesDir = path.join(process.cwd(), "examples");
const htmlFiles = (await readdir(examplesDir))
  .filter((entry) => entry.endsWith(".html"))
  .sort();
const failures = [];

for (const htmlFile of htmlFiles) {
  const html = await readFile(path.join(examplesDir, htmlFile), "utf8");
  const controlScriptMatches = [
    ...html.matchAll(
      /<script\s+type="module"\s+src="\.\/example-control\.js"><\/script>/gu,
    ),
  ];

  if (htmlFile === "index.html") {
    if (controlScriptMatches.length > 0) {
      failures.push("index.html must not load example-control.js");
    }

    continue;
  }

  if (controlScriptMatches.length !== 1) {
    failures.push(
      `${htmlFile} must load exactly one ./example-control.js module script`,
    );
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }

  process.exitCode = 1;
}
