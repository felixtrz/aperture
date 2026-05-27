import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { apertureRuntimeDir } from "./session.js";

const INDEX_VERSION = 1;
const DEFAULT_LIMIT = 10;
const MAX_INDEXED_FILE_BYTES = 200_000;
const INDEXABLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".toml",
  ".wgsl",
]);
const IGNORED_DIRECTORIES = new Set([
  ".aperture",
  ".git",
  ".turbo",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const DEFAULT_CORPUS_ROOTS = [
  "docs",
  "packages",
  "examples",
  "test",
  "agent",
  "references",
  "src",
];
const DEFAULT_CORPUS_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "aperture.config.ts",
  "package.json",
  "vite.config.ts",
];

export interface ApertureReferenceIndex {
  readonly version: typeof INDEX_VERSION;
  readonly root: string;
  readonly createdAt: string;
  readonly entries: readonly ApertureReferenceEntry[];
}

export interface ApertureReferenceEntry {
  readonly file: string;
  readonly bytes: number;
  readonly kind: "doc" | "source" | "example" | "test" | "reference" | "other";
  readonly symbols: readonly string[];
  readonly components: readonly string[];
  readonly systems: readonly string[];
  readonly diagnostics: readonly string[];
  readonly text: string;
}

export interface BuildApertureReferenceIndexOptions {
  readonly cwd: string;
}

export interface BuildApertureReferenceIndexReport {
  readonly indexFile: string;
  readonly entries: number;
  readonly root: string;
}

export interface SearchApertureReferencesOptions {
  readonly cwd: string;
  readonly query: string;
  readonly limit?: number;
  readonly kind?: ApertureReferenceEntry["kind"] | "any";
}

export interface ApertureReferenceSearchResult {
  readonly file: string;
  readonly kind: ApertureReferenceEntry["kind"];
  readonly score: number;
  readonly symbols: readonly string[];
  readonly components: readonly string[];
  readonly systems: readonly string[];
  readonly diagnostics: readonly string[];
  readonly snippet: string;
}

export interface ApertureReferenceSearchReport {
  readonly indexFile: string;
  readonly query: string;
  readonly total: number;
  readonly results: readonly ApertureReferenceSearchResult[];
}

export async function buildApertureReferenceIndex(
  options: BuildApertureReferenceIndexOptions,
): Promise<BuildApertureReferenceIndexReport> {
  const root = path.resolve(options.cwd);
  const entries: ApertureReferenceEntry[] = [];

  for (const relativeRoot of DEFAULT_CORPUS_ROOTS) {
    const absoluteRoot = path.join(root, relativeRoot);
    if (!(await directoryExists(absoluteRoot))) {
      continue;
    }

    for (const file of await collectIndexableFiles(absoluteRoot)) {
      const relative = normalizePath(path.relative(root, file));
      const fileStat = await stat(file);

      if (fileStat.size > MAX_INDEXED_FILE_BYTES) {
        continue;
      }

      const text = await readFile(file, "utf8");
      entries.push({
        file: relative,
        bytes: fileStat.size,
        kind: entryKind(relative),
        symbols: extractSymbols(text),
        components: extractComponentIds(text),
        systems: extractSystemNames(text, relative),
        diagnostics: extractDiagnosticCodes(text),
        text,
      });
    }
  }

  for (const relativeFile of DEFAULT_CORPUS_FILES) {
    const absoluteFile = path.join(root, relativeFile);
    if (!(await fileExists(absoluteFile))) {
      continue;
    }

    const fileStat = await stat(absoluteFile);
    if (fileStat.size > MAX_INDEXED_FILE_BYTES) {
      continue;
    }

    const text = await readFile(absoluteFile, "utf8");
    entries.push({
      file: normalizePath(relativeFile),
      bytes: fileStat.size,
      kind: entryKind(relativeFile),
      symbols: extractSymbols(text),
      components: extractComponentIds(text),
      systems: extractSystemNames(text, relativeFile),
      diagnostics: extractDiagnosticCodes(text),
      text,
    });
  }

  const index: ApertureReferenceIndex = {
    version: INDEX_VERSION,
    root,
    createdAt: new Date().toISOString(),
    entries: entries.sort((a, b) => a.file.localeCompare(b.file)),
  };
  const indexFile = apertureReferenceIndexFile(root);

  await mkdir(path.dirname(indexFile), { recursive: true });
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  return { indexFile, entries: entries.length, root };
}

export async function searchApertureReferences(
  options: SearchApertureReferencesOptions,
): Promise<ApertureReferenceSearchReport> {
  const index = await readApertureReferenceIndex(options.cwd);
  const query = options.query.trim();
  const tokens = tokenize(query);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const matches = index.entries
    .filter(
      (entry) =>
        options.kind === undefined ||
        options.kind === "any" ||
        entry.kind === options.kind,
    )
    .map((entry) => scoreEntry(entry, query, tokens))
    .filter(
      (result): result is ApertureReferenceSearchResult => result !== null,
    )
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));

  return {
    indexFile: apertureReferenceIndexFile(path.resolve(options.cwd)),
    query,
    total: matches.length,
    results: matches.slice(0, limit),
  };
}

export async function readApertureReferenceFile(
  cwd: string,
  file: string,
): Promise<ApertureReferenceEntry | null> {
  const index = await readApertureReferenceIndex(cwd);
  const normalized = normalizePath(file);

  return index.entries.find((entry) => entry.file === normalized) ?? null;
}

export async function listApertureReferenceComponents(
  cwd: string,
): Promise<readonly string[]> {
  const index = await readApertureReferenceIndex(cwd);
  const components = new Set<string>();

  for (const entry of index.entries) {
    for (const component of entry.components) {
      components.add(component);
    }
  }

  return [...components].sort((a, b) => a.localeCompare(b));
}

export async function listApertureReferenceSystems(
  cwd: string,
): Promise<readonly string[]> {
  const index = await readApertureReferenceIndex(cwd);
  const systems = new Set<string>();

  for (const entry of index.entries) {
    for (const system of entry.systems) {
      systems.add(system);
    }
  }

  return [...systems].sort((a, b) => a.localeCompare(b));
}

export async function ensureApertureReferenceIndex(
  cwd: string,
): Promise<ApertureReferenceIndex> {
  try {
    return await readApertureReferenceIndex(cwd);
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      await buildApertureReferenceIndex({ cwd });
      return readApertureReferenceIndex(cwd);
    }

    throw error;
  }
}

export function apertureReferenceIndexFile(root: string): string {
  return path.join(apertureRuntimeDir(root), "reference", "index.json");
}

async function readApertureReferenceIndex(
  cwd: string,
): Promise<ApertureReferenceIndex> {
  const root = path.resolve(cwd);
  const source = await readFile(apertureReferenceIndexFile(root), "utf8");
  const parsed = JSON.parse(source) as ApertureReferenceIndex;

  return parsed;
}

async function collectIndexableFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await visit(path.join(directory, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const file = path.join(directory, entry.name);
      if (INDEXABLE_EXTENSIONS.has(path.extname(file))) {
        files.push(file);
      }
    }
  }

  await visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function scoreEntry(
  entry: ApertureReferenceEntry,
  query: string,
  tokens: readonly string[],
): ApertureReferenceSearchResult | null {
  if (tokens.length === 0) {
    return null;
  }

  const haystacks = [
    entry.file,
    ...entry.symbols,
    ...entry.components,
    ...entry.systems,
    ...entry.diagnostics,
    entry.text,
  ].map((value) => value.toLowerCase());
  let score = 0;

  for (const token of tokens) {
    for (const haystack of haystacks) {
      if (haystack.includes(token)) {
        score += haystack === entry.file.toLowerCase() ? 5 : 1;
      }
    }
  }

  if (
    entry.symbols.some((symbol) => symbol.toLowerCase() === query.toLowerCase())
  ) {
    score += 20;
  }

  if (score === 0) {
    return null;
  }

  return {
    file: entry.file,
    kind: entry.kind,
    score,
    symbols: entry.symbols.slice(0, 12),
    components: entry.components.slice(0, 12),
    systems: entry.systems.slice(0, 12),
    diagnostics: entry.diagnostics.slice(0, 12),
    snippet: snippetForQuery(entry.text, tokens),
  };
}

function snippetForQuery(text: string, tokens: readonly string[]): string {
  const lower = text.toLowerCase();
  const index = Math.max(
    0,
    tokens
      .map((token) => lower.indexOf(token))
      .filter((position) => position >= 0)
      .sort((a, b) => a - b)[0] ?? 0,
  );
  const start = Math.max(0, index - 120);
  const end = Math.min(text.length, index + 240);

  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function extractSymbols(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bexport\s+(?:async\s+)?(?:function|class|interface|type|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s*\{\s*([^}]+)\s*\}/g,
  ]).flatMap((match) =>
    match.includes(",")
      ? match
          .split(",")
          .map((part) => part.trim().split(/\s+as\s+/u)[0] ?? "")
          .filter((part) => part.length > 0)
      : [match],
  );
}

function extractComponentIds(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bid\s*:\s*["'`]([^"'`]+)["'`]/g,
    /\bcreateComponent\s*\(\s*["'`]([^"'`]+)["'`]/g,
  ]).filter((value) => value.includes("."));
}

function extractSystemNames(text: string, file: string): readonly string[] {
  const systems = uniqueMatches(text, [
    /\bclass\s+([A-Za-z_$][\w$]*System)\b/g,
    /\bexport\s+default\s+class\s+([A-Za-z_$][\w$]*)\b/g,
  ]);

  if (file.endsWith(".system.ts") && systems.length === 0) {
    return [path.basename(file, ".system.ts")];
  }

  return systems;
}

function extractDiagnosticCodes(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bcode\s*:\s*["'`]([^"'`]+)["'`]/g,
    /\bdiagnostic\.code\s*===\s*["'`]([^"'`]+)["'`]/g,
  ]);
}

function uniqueMatches(text: string, patterns: readonly RegExp[]): string[] {
  const values = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[1]?.trim();
      if (value !== undefined && value.length > 0) {
        values.add(value);
      }
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b));
}

function tokenize(query: string): readonly string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9_.:/-]+/u)
    .filter((token) => token.length > 0);
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory();
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function entryKind(file: string): ApertureReferenceEntry["kind"] {
  if (file.startsWith("docs/") || file.startsWith("agent/")) {
    return "doc";
  }

  if (file.startsWith("examples/")) {
    return "example";
  }

  if (file.startsWith("test/")) {
    return "test";
  }

  if (file.startsWith("references/")) {
    return "reference";
  }

  if (file.startsWith("packages/")) {
    return "source";
  }

  if (file.startsWith("src/") || file.endsWith(".ts")) {
    return "source";
  }

  return "other";
}

function normalizePath(file: string): string {
  return file.split(path.sep).join("/");
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}
