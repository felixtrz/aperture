#!/usr/bin/env node
// AI-86: keep doc reference paths portable so a fresh checkout can follow them.
// Two checks over docs/**/*.md:
//   1. No machine-specific absolute home-directory path (e.g. /Users/<name>/... or
//      /home/<name>/...) — those can't be followed from another machine.
//   2. Every `references/<engine>/...` citation points to an engine that
//      scripts/setup-references.sh actually restores (plus the committed
//      framework-comparison-research / kenney_platformer-kit), so the citation
//      resolves after `pnpm run setup:references`.
// Wired into `pnpm run check`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = "docs";
const SETUP_REFERENCES = "scripts/setup-references.sh";
// Reference dirs that exist in-repo without being in the setup-references REPOS list.
const ALWAYS_ALLOWED_REFERENCES = [
  "framework-comparison-research",
  "kenney_platformer-kit",
];

const HOME_PATH = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//;
const REFERENCE_PATH = /references\/([A-Za-z0-9._-]+)/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

export function restoredReferenceEngines(
  setupSource = readFileSync(SETUP_REFERENCES, "utf8"),
) {
  // REPOS entries look like:  "engine|https://...|<sha>|ref"
  const names = [
    ...setupSource.matchAll(/^\s*"([A-Za-z0-9._-]+)\|https?:/gm),
  ].map((m) => m[1]);
  return new Set([...names, ...ALWAYS_ALLOWED_REFERENCES]);
}

export function findDocHomePaths(files = walk(DOCS_DIR)) {
  const hits = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (HOME_PATH.test(line))
          hits.push({ file, line: index + 1, text: line.trim() });
      });
  }
  return hits;
}

export function findUnknownReferenceEngines(allowed, files = walk(DOCS_DIR)) {
  const hits = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        for (const match of line.matchAll(REFERENCE_PATH)) {
          const engine = match[1];
          // Ignore prose placeholders with no letter (e.g. `references/...`).
          if (!/[A-Za-z]/.test(engine)) continue;
          if (!allowed.has(engine)) {
            hits.push({ file, line: index + 1, engine, text: line.trim() });
          }
        }
      });
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const homeHits = findDocHomePaths();
  const allowed = restoredReferenceEngines();
  const refHits = findUnknownReferenceEngines(allowed);
  let failed = false;

  if (homeHits.length > 0) {
    failed = true;
    console.error(
      `check:doc-paths — ${homeHits.length} machine-specific home-directory path(s) in docs/:`,
    );
    for (const hit of homeHits)
      console.error(`  ${hit.file}:${hit.line}  ${hit.text.slice(0, 160)}`);
    console.error(
      "Replace with repo-relative `references/<engine>/...` paths or an upstream URL.",
    );
  }
  if (refHits.length > 0) {
    failed = true;
    console.error(
      `check:doc-paths — ${refHits.length} reference(s) to an engine not restored by ${SETUP_REFERENCES}:`,
    );
    for (const hit of refHits)
      console.error(`  ${hit.file}:${hit.line}  references/${hit.engine}`);
    console.error(`Allowed: ${[...allowed].sort().join(", ")}`);
  }
  if (failed) process.exit(1);
  console.log(
    "check:doc-paths passed — docs reference only portable, restorable paths.",
  );
}
