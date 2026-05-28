import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  IGNORED_DIRECTORIES,
  SELECTED_DEPENDENCY_FILES,
  sourceCategoryForFile,
  type ApertureReferenceSourceCategory,
} from "./reference-source-filter.js";

export interface CandidateSource {
  readonly file: string;
  readonly absoluteFile: string;
  readonly sourceCategory: ApertureReferenceSourceCategory;
  readonly packageName?: string;
  readonly entrypoint?: string;
}

export interface PackageExportInfo {
  readonly packageName: string;
  readonly entrypointsByFile: ReadonlyMap<string, readonly string[]>;
}

export async function collectCandidateSources(
  root: string,
  packageExports: readonly PackageExportInfo[],
): Promise<readonly CandidateSource[]> {
  const candidates = new Map<string, CandidateSource>();
  const entrypointsByFile = new Map<string, string[]>();
  const packageByFile = new Map<string, string>();

  for (const packageInfo of packageExports) {
    for (const [file, entrypoints] of packageInfo.entrypointsByFile) {
      entrypointsByFile.set(file, [
        ...(entrypointsByFile.get(file) ?? []),
        ...entrypoints,
      ]);
      packageByFile.set(file, packageInfo.packageName);
    }
  }

  for (const file of await collectFiles(root)) {
    const relative = normalizePath(path.relative(root, file));
    const sourceCategory = sourceCategoryForFile(relative, entrypointsByFile);

    if (sourceCategory === null) {
      continue;
    }

    const packageName = packageByFile.get(relative);
    const entrypoints = entrypointsByFile.get(relative);

    addCandidate(candidates, {
      file: relative,
      absoluteFile: file,
      sourceCategory,
      ...(packageName === undefined ? {} : { packageName }),
      ...(entrypoints === undefined
        ? {}
        : { entrypoint: uniqueSorted(entrypoints).join(", ") }),
    });
  }

  for (const dependency of SELECTED_DEPENDENCY_FILES) {
    const absoluteFile = path.join(root, dependency);

    if (!(await fileExists(absoluteFile))) {
      continue;
    }

    addCandidate(candidates, {
      file: dependency,
      absoluteFile,
      sourceCategory: "external",
      packageName: "elics",
      entrypoint: "elics",
    });
  }

  return [...candidates.values()].sort((a, b) => a.file.localeCompare(b.file));
}

export async function discoverPackageExportInfo(
  root: string,
): Promise<readonly PackageExportInfo[]> {
  const packagesDir = path.join(root, "packages");

  if (!(await directoryExists(packagesDir))) {
    return [];
  }

  const entries = await readdir(packagesDir, { withFileTypes: true });
  const infos: PackageExportInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageRoot = path.join(packagesDir, entry.name);
    const packageJsonFile = path.join(packageRoot, "package.json");

    if (!(await fileExists(packageJsonFile))) {
      continue;
    }

    const packageJson = JSON.parse(await readFile(packageJsonFile, "utf8")) as {
      readonly name?: unknown;
      readonly exports?: unknown;
    };
    const packageName =
      typeof packageJson.name === "string"
        ? packageJson.name
        : `packages/${entry.name}`;
    const entrypointsByFile = new Map<string, string[]>();
    const directExportFiles = exportedSourceFiles(
      packageRoot,
      packageJson.exports,
    );
    const shouldFollowReexports = packageName !== "@aperture-engine/webgpu";

    for (const exportedFile of directExportFiles) {
      const relative = normalizePath(path.relative(root, exportedFile.file));

      entrypointsByFile.set(relative, [
        ...(entrypointsByFile.get(relative) ?? []),
        `${packageName}${exportedFile.entrypoint === "." ? "" : exportedFile.entrypoint.slice(1)}`,
      ]);

      if (shouldFollowReexports) {
        for (const reexported of await collectReExportedFiles(
          exportedFile.file,
        )) {
          const reexportedRelative = normalizePath(
            path.relative(root, reexported),
          );

          entrypointsByFile.set(reexportedRelative, [
            ...(entrypointsByFile.get(reexportedRelative) ?? []),
            `${packageName}${exportedFile.entrypoint === "." ? "" : exportedFile.entrypoint.slice(1)}`,
          ]);
        }
      }
    }

    infos.push({
      packageName,
      entrypointsByFile,
    });
  }

  return infos;
}

function addCandidate(
  candidates: Map<string, CandidateSource>,
  candidate: CandidateSource,
): void {
  candidates.set(candidate.file, candidate);
}

async function collectFiles(root: string): Promise<readonly string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await visit(absolute);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }

  await visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function exportedSourceFiles(
  packageRoot: string,
  exportsValue: unknown,
): readonly { readonly entrypoint: string; readonly file: string }[] {
  if (!isRecord(exportsValue)) {
    return [];
  }

  const files: { readonly entrypoint: string; readonly file: string }[] = [];

  for (const [entrypoint, target] of Object.entries(exportsValue)) {
    const targetFile = exportTargetFile(target);

    if (targetFile === null) {
      continue;
    }

    const sourceFile = distTargetToSourceFile(packageRoot, targetFile);

    files.push({ entrypoint, file: sourceFile });
  }

  return files;
}

function exportTargetFile(target: unknown): string | null {
  if (typeof target === "string") {
    return target;
  }

  if (!isRecord(target)) {
    return null;
  }

  const importTarget = target["import"];
  const typesTarget = target["types"];

  if (typeof importTarget === "string") {
    return importTarget;
  }

  if (typeof typesTarget === "string") {
    return typesTarget;
  }

  return null;
}

function distTargetToSourceFile(
  packageRoot: string,
  targetFile: string,
): string {
  const normalized = targetFile.replace(/^\.\//u, "");
  const withoutDist = normalized.startsWith("dist/")
    ? normalized.replace(/^dist\//u, "src/")
    : normalized;
  const withoutExtension = withoutDist.replace(/\.(d\.ts|js|mjs|cjs)$/u, "");

  return path.join(packageRoot, `${withoutExtension}.ts`);
}

async function collectReExportedFiles(
  sourceFile: string,
  seen = new Set<string>(),
): Promise<readonly string[]> {
  if (seen.has(sourceFile) || !(await fileExists(sourceFile))) {
    return [];
  }

  seen.add(sourceFile);
  const text = await readFile(sourceFile, "utf8");
  const files: string[] = [];
  const exportPattern =
    /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/gu;
  let match: RegExpExecArray | null;

  while ((match = exportPattern.exec(text)) !== null) {
    const specifier = match[1];

    if (specifier === undefined || !specifier.startsWith(".")) {
      continue;
    }

    const resolved = resolveRelativeSourceFile(
      path.dirname(sourceFile),
      specifier,
    );

    if (resolved === null || seen.has(resolved)) {
      continue;
    }

    files.push(resolved);
    files.push(...(await collectReExportedFiles(resolved, seen)));
  }

  return files;
}

function resolveRelativeSourceFile(
  directory: string,
  specifier: string,
): string | null {
  const withoutJs = specifier.replace(/\.(js|mjs|cjs)$/u, "");
  const candidates = [
    path.join(directory, `${withoutJs}.ts`),
    path.join(directory, `${withoutJs}.tsx`),
    path.join(directory, `${withoutJs}.js`),
    path.join(directory, withoutJs, "index.ts"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizePath(file: string): string {
  return file.split(path.sep).join("/");
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}
