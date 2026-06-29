#!/usr/bin/env node
// AF-4 (readiness roadmap R3.2): generate docs/DIAGNOSTICS_CATALOG.md — the
// lookup table for every structured diagnostic code the engine can emit.
// Agents resolving a tool-returned diagnostic look the code up here.
//
//   node scripts/generate-diagnostics-catalog.mjs           # rewrite the doc
//   node scripts/generate-diagnostics-catalog.mjs --check   # CI: fail on drift
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import prettier from "prettier";

const CATALOG_FILE = "docs/DIAGNOSTICS_CATALOG.md";
const SOURCE_ROOT = "packages";
const GENERATED_SOURCE_DIRS = new Set(["packages/reference-assets/data"]);

// Diagnostic-shaped object literals, CLI errors, and warning lines all carry
// stable dotted codes. Messages/suggestedFix are extracted best-effort from the
// surrounding source text.
const CODE_PATTERNS = [
  /code:\s*"([a-zA-Z0-9][a-zA-Z0-9_.-]*\.[a-zA-Z0-9_.-]+)"/g,
  /new\s+ApertureCliError\(\s*"([a-zA-Z0-9][a-zA-Z0-9_.-]*\.[a-zA-Z0-9_.-]+)"/g,
  /\.(?:info|warn|error)\(\s*"(aperture\.[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+)"/g,
  /(?:^|[^a-zA-Z0-9_.-])(aperture\.[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+):/g,
  /warning\s+(aperture\.[a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+):/g,
];

export async function collectDiagnosticCodes(root = process.cwd()) {
  const entries = new Map();
  const sourceFiles = await collectSourceFiles(
    path.join(root, SOURCE_ROOT),
    root,
  );

  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    const relative = path.relative(root, file).split(path.sep).join("/");

    for (const pattern of CODE_PATTERNS) {
      pattern.lastIndex = 0;

      for (const match of source.matchAll(pattern)) {
        const code = match[1];
        const context = source.slice(
          match.index ?? 0,
          (match.index ?? 0) + 1200,
        );
        const existing = entries.get(code) ?? {
          code,
          files: new Set(),
          message: null,
          hasSuggestedFix: false,
        };

        existing.files.add(relative);
        existing.message ??= extractMessage(context, code);
        existing.hasSuggestedFix ||= /suggestedFix\s*:/.test(context);
        entries.set(code, existing);
      }
    }
  }

  return [...entries.values()].sort((a, b) => a.code.localeCompare(b.code));
}

async function collectSourceFiles(directory, root) {
  const files = [];
  const children = await readdir(directory, { withFileTypes: true });

  for (const child of children) {
    const childPath = path.join(directory, child.name);

    if (child.isDirectory()) {
      const relativeDirectory = path
        .relative(root, childPath)
        .split(path.sep)
        .join("/");

      if (child.name === "dist" || child.name === "node_modules") {
        continue;
      }
      if (GENERATED_SOURCE_DIRS.has(relativeDirectory)) {
        continue;
      }
      files.push(...(await collectSourceFiles(childPath, root)));
    } else if (child.name.endsWith(".ts") && !child.name.endsWith(".d.ts")) {
      files.push(childPath);
    }
  }

  return files;
}

function extractMessage(context, code) {
  return (
    extractStringProperty(context, "message") ??
    extractCliErrorMessage(context) ??
    extractWarningMessage(context, code)
  );
}

function extractStringProperty(objectText, property) {
  // Plain string literal (single-line) on the property.
  const literal = objectText.match(
    new RegExp(`${property}:\\s*"([^"\\n]*)"`, "u"),
  );

  if (literal?.[1] !== undefined) {
    return literal[1];
  }

  // Template literal or expression: record the raw template with
  // interpolations marked, truncated for the table.
  const template = objectText.match(
    new RegExp(`${property}:\\s*\`([^\`]*)\``, "u"),
  );

  if (template?.[1] !== undefined) {
    return template[1].replaceAll(/\$\{[^}]*\}/g, "…").replaceAll("\n", " ");
  }

  if (new RegExp(`${property}\\s*:`, "u").test(objectText)) {
    return "(message composed at runtime)";
  }

  return null;
}

function extractCliErrorMessage(context) {
  const literal = context.match(
    /^\s*new\s+ApertureCliError\(\s*"[^"]+"\s*,\s*"([^"\n]*)"/u,
  );

  if (literal?.[1] !== undefined) {
    return literal[1];
  }

  const template = context.match(
    /^\s*new\s+ApertureCliError\(\s*"[^"]+"\s*,\s*`([^`]*)`/u,
  );

  if (template?.[1] !== undefined) {
    return template[1].replaceAll(/\$\{[^}]*\}/g, "…").replaceAll("\n", " ");
  }

  if (/^\s*new\s+ApertureCliError\(/u.test(context)) {
    return "(message composed at runtime)";
  }

  return null;
}

function extractWarningMessage(context, code) {
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const warning = context.match(
    new RegExp(`${escapedCode}:\\s*([^\\\\\`"\\n]*)`, "u"),
  );

  if (warning?.[1] !== undefined) {
    const message = warning[1].trim();
    return message.length === 0 ? null : message;
  }

  return null;
}

export function renderCatalog(entries) {
  const groups = new Map();

  for (const entry of entries) {
    const prefix = entry.code.split(".").slice(0, 2).join(".");
    const group = groups.get(prefix) ?? [];
    group.push(entry);
    groups.set(prefix, group);
  }

  const lines = [
    "# Diagnostics Catalog",
    "",
    "**Status:** generated — do not edit by hand. Regenerate with",
    "`node scripts/generate-diagnostics-catalog.mjs`; CI verifies the committed",
    "file matches the source (`pnpm run check:diagnostics`).",
    "",
    `Every structured diagnostic code the engine can emit (${entries.length}`,
    "codes), grouped by namespace. Agents: when a tool or report returns a",
    "diagnostic, look its code up here for the message contract, whether a",
    "suggestedFix accompanies it, and where it is emitted.",
    "",
  ];

  for (const [prefix, group] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`## ${prefix} (${group.length})`, "");
    lines.push("| Code | Message | Fix? | Emitted from |");
    lines.push("| --- | --- | --- | --- |");

    for (const entry of group) {
      const files = [...entry.files]
        .sort()
        .map((file) => `\`${file}\``)
        .join("<br>");
      const message = (entry.message ?? "(message composed at runtime)")
        .replaceAll("|", "\\|")
        .slice(0, 220);
      lines.push(
        `| \`${entry.code}\` | ${message} | ${entry.hasSuggestedFix ? "yes" : "—"} | ${files} |`,
      );
    }

    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

async function main() {
  const check = process.argv.includes("--check");
  const entries = await collectDiagnosticCodes();
  // The committed file must satisfy format:check, so emit prettier-formatted
  // markdown (honoring the repo prettier config).
  const config = await prettier.resolveConfig(CATALOG_FILE);
  const rendered = await prettier.format(renderCatalog(entries), {
    ...config,
    parser: "markdown",
  });

  if (check) {
    let committed = "";

    try {
      committed = await readFile(CATALOG_FILE, "utf8");
    } catch {
      // Missing file fails the comparison below.
    }

    if (committed !== rendered) {
      console.error(
        `Diagnostics catalog is stale (${entries.length} codes in source). ` +
          "Run node scripts/generate-diagnostics-catalog.mjs and commit the result.",
      );
      process.exitCode = 1;
      return;
    }

    console.log(`Diagnostics catalog check passed (${entries.length} codes).`);
    return;
  }

  await writeFile(CATALOG_FILE, rendered);
  console.log(`Wrote ${CATALOG_FILE} (${entries.length} codes).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
