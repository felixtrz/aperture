#!/usr/bin/env node
// Static flake-hygiene gate for test/e2e. Bans the patterns that caused real
// flakes in the 2026-07 audit so they cannot creep back in:
//
//   1. page.waitForTimeout(...) — arbitrary sleeps paper over the missing
//      "frame presented" signal; use waitForPresentedFrames (webgpu-status.ts)
//      or an expect.poll on the actual condition. A site that genuinely has
//      no deterministic signal must carry a `flake-allow:` comment on the
//      same or previous line explaining why.
//
//   2. waitForFunction(fn, { ... }) — Playwright's signature is
//      waitForFunction(fn, ARG, options); an options object in the second
//      slot silently becomes the page-function argument and the intended
//      timeout is discarded.
//
//   3. test.setTimeout(N) with N below the 240s project default — hand-tuned
//      per-test budgets BELOW the config default repeatedly flaked on loaded
//      shards (glb-viewer documented two such raises before the audit).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const E2E_DIR = fileURLToPath(new URL("../test/e2e", import.meta.url));
const PROJECT_DEFAULT_TIMEOUT_MS = 240_000;

export function findHygieneViolations(source, file) {
  const violations = [];
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    if (!line.includes(".waitForTimeout(")) {
      return;
    }

    const previous = lines[index - 1] ?? "";

    if (line.includes("flake-allow:") || previous.includes("flake-allow:")) {
      return;
    }

    violations.push({
      file,
      line: index + 1,
      rule: "no-wait-for-timeout",
      message:
        "waitForTimeout sleeps are banned in test/e2e — use " +
        "waitForPresentedFrames or expect.poll on the real condition " +
        "(or add a `// flake-allow: <reason>` justification).",
    });
  });

  for (const call of collectCallArguments(source, "waitForFunction(")) {
    const second = call.args[1]?.trim() ?? "";

    if (second.startsWith("{") && /\btimeout\s*:/.test(second)) {
      violations.push({
        file,
        line: call.line,
        rule: "wait-for-function-options-slot",
        message:
          "waitForFunction options must be the THIRD argument " +
          "(waitForFunction(fn, undefined, { timeout })); in the second " +
          "slot they become the page-function argument and the timeout is " +
          "silently ignored.",
      });
    }
  }

  for (const call of collectCallArguments(source, "test.setTimeout(")) {
    const value = Number((call.args[0] ?? "").replaceAll("_", ""));

    if (Number.isFinite(value) && value < PROJECT_DEFAULT_TIMEOUT_MS) {
      violations.push({
        file,
        line: call.line,
        rule: "no-below-default-timeout",
        message:
          `test.setTimeout(${call.args[0]}) is below the ${PROJECT_DEFAULT_TIMEOUT_MS}ms ` +
          "project default — per-test budgets below the config default are " +
          "load-tuned flakes waiting to recur; remove the override.",
      });
    }
  }

  return violations;
}

/**
 * Collect top-level argument slices for every occurrence of `marker` using
 * paren/brace matching. String and template literals are skipped so commas
 * and braces inside them cannot desynchronize the scan; the sources are
 * prettier-formatted TypeScript, which keeps this deliberately simple parser
 * honest.
 */
export function collectCallArguments(source, marker) {
  const calls = [];
  let searchFrom = 0;

  for (;;) {
    const start = source.indexOf(marker, searchFrom);

    if (start === -1) {
      return calls;
    }

    const argsStart = start + marker.length;
    let depth = 1;
    let index = argsStart;
    let argStart = argsStart;
    const args = [];

    while (index < source.length && depth > 0) {
      const char = source[index];

      if (char === '"' || char === "'" || char === "`") {
        index = skipStringLiteral(source, index);
        continue;
      }

      if (char === "(" || char === "{" || char === "[") {
        depth += 1;
      } else if (char === ")" || char === "}" || char === "]") {
        depth -= 1;

        if (depth === 0) {
          args.push(source.slice(argStart, index));
          break;
        }
      } else if (char === "," && depth === 1) {
        args.push(source.slice(argStart, index));
        argStart = index + 1;
      }

      index += 1;
    }

    calls.push({
      line: source.slice(0, start).split("\n").length,
      args,
    });
    searchFrom = argsStart;
  }
}

function skipStringLiteral(source, start) {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    if (source[index] === "\\") {
      index += 2;
      continue;
    }

    if (source[index] === quote) {
      return index + 1;
    }

    index += 1;
  }

  return index;
}

async function collectSpecFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectSpecFiles(fullPath)));
    } else if (entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const files = await collectSpecFiles(E2E_DIR);
  let failed = false;

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const relative = path.relative(path.join(E2E_DIR, "../.."), file);

    for (const violation of findHygieneViolations(source, relative)) {
      console.error(
        `${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`,
      );
      failed = true;
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log(`E2E hygiene check passed (${files.length} files).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
