#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const docsSiteDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(docsSiteDir, "..");
const contentOutput = path.join(
  docsSiteDir,
  "src",
  "content",
  "api.generated.json",
);
const publicOutput = path.join(
  docsSiteDir,
  "public",
  "api-reference",
  "index.json",
);

const packageDirs = [
  "packages/app",
  "packages/simulation",
  "packages/particles",
  "packages/render",
  "packages/webgpu",
  "packages/runtime",
  "packages/physics",
  "packages/vite-plugin",
];

function exportedEntries(exportsField) {
  if (exportsField === undefined || exportsField === null) {
    return [];
  }

  if (typeof exportsField === "string") {
    return [{ subpath: ".", types: exportsField, importPath: exportsField }];
  }

  return Object.entries(exportsField)
    .map(([subpath, value]) => {
      if (typeof value === "string") {
        return { subpath, types: value, importPath: value };
      }
      if (value && typeof value === "object") {
        return {
          subpath,
          types: value.types,
          importPath: value.import,
        };
      }
      return null;
    })
    .filter(Boolean);
}

function sourcePathFromTypes(packageDir, typesPath) {
  if (typeof typesPath !== "string") {
    return null;
  }

  const basename = path.basename(typesPath).replace(/\.d\.ts$/u, ".ts");
  if (basename === "index.ts") {
    return path.join(packageDir, "src", "index.ts");
  }
  return path.join(packageDir, "src", basename);
}

function symbolKind(symbol) {
  const declaration = symbol.declarations?.[0];
  if (declaration === undefined) {
    return "unknown";
  }
  if (ts.isInterfaceDeclaration(declaration)) return "interface";
  if (ts.isTypeAliasDeclaration(declaration)) return "type";
  if (ts.isClassDeclaration(declaration)) return "class";
  if (ts.isFunctionDeclaration(declaration)) return "function";
  if (ts.isVariableDeclaration(declaration)) return "value";
  if (ts.isEnumDeclaration(declaration)) return "enum";
  return "export";
}

function collectSymbols(entryFiles) {
  const program = ts.createProgram(entryFiles, {
    allowJs: false,
    declaration: true,
    esModuleInterop: true,
    exactOptionalPropertyTypes: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2022,
  });
  const checker = program.getTypeChecker();
  const byFile = new Map();

  for (const entryFile of entryFiles) {
    const sourceFile = program.getSourceFile(entryFile);
    if (sourceFile === undefined) {
      byFile.set(entryFile, []);
      continue;
    }

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    const exports = moduleSymbol
      ? checker.getExportsOfModule(moduleSymbol)
      : [];
    byFile.set(
      entryFile,
      exports
        .map((symbol) => ({
          name: symbol.getName(),
          kind: symbolKind(symbol),
        }))
        .filter((symbol) => symbol.name !== "default")
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  return byFile;
}

const packages = [];
for (const packageDir of packageDirs) {
  const packageJsonPath = path.join(repoRoot, packageDir, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const entries = exportedEntries(packageJson.exports);
  const sourceEntries = entries
    .map((entry) => ({
      ...entry,
      sourcePath: sourcePathFromTypes(
        path.join(repoRoot, packageDir),
        entry.types,
      ),
    }))
    .filter((entry) => entry.sourcePath !== null);
  const symbolsByFile = collectSymbols(
    sourceEntries.map((entry) => entry.sourcePath),
  );

  packages.push({
    name: packageJson.name,
    description: packageJson.description,
    path: packageDir,
    entries: sourceEntries.map((entry) => ({
      subpath: entry.subpath,
      importPath:
        entry.subpath === "."
          ? packageJson.name
          : `${packageJson.name}/${entry.subpath.replace(/^\.\//u, "")}`,
      typesPath: entry.types,
      sourcePath: path.relative(repoRoot, entry.sourcePath),
      symbols: symbolsByFile.get(entry.sourcePath) ?? [],
    })),
  });
}

const reference = {
  generatedAt: new Date(0).toISOString(),
  source: "workspace package exports",
  packages,
};

await mkdir(path.dirname(contentOutput), { recursive: true });
await mkdir(path.dirname(publicOutput), { recursive: true });
const json = `${JSON.stringify(reference, null, 2)}\n`;
await writeFile(contentOutput, json);
await writeFile(publicOutput, json);
