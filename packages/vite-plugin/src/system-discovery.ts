import { promises as fs } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import {
  normalizePath,
  readOptionalText,
  resolveConfigFile,
  toModuleUrl,
} from "./file-utils.js";
import {
  isNamedPropertyAssignment,
  numericLiteralValue,
  scriptKindForPath,
} from "./typescript-ast.js";

export interface DiscoveredApertureSystem {
  readonly file: string;
  readonly moduleUrl: string;
  readonly hasDefaultExport: boolean;
  readonly schedule: {
    readonly priority: number;
  };
  readonly diagnostics: readonly ApertureVitePluginDiagnostic[];
}

export interface ApertureSystemManifest {
  readonly systems: readonly DiscoveredApertureSystem[];
  readonly diagnostics: readonly ApertureVitePluginDiagnostic[];
}

export interface ApertureVitePluginDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly glob?: string;
  readonly suggestedFix: string;
}

export async function createApertureSystemManifest(options: {
  readonly root: string;
  readonly configFile?: string;
  readonly systemGlobs?: readonly string[];
}): Promise<ApertureSystemManifest> {
  const configFile = resolveConfigFile(options.root, options.configFile);
  const configSource = await readOptionalText(configFile);
  const diagnostics: ApertureVitePluginDiagnostic[] = [];
  const globs =
    options.systemGlobs ??
    (await readApertureSystemConfigGraph(configFile)).globs.map((glob) =>
      normalizePath(glob),
    );

  if (configSource === null && options.systemGlobs === undefined) {
    diagnostics.push({
      code: "aperture.config.notFound",
      file: configFile,
      message: `Aperture config file '${configFile}' was not found.`,
      suggestedFix:
        "Create aperture.config.ts or pass configFile to aperture().",
    });
  }

  const systems: DiscoveredApertureSystem[] = [];
  const discoveredFiles = new Set<string>();

  for (const glob of globs) {
    const files = await discoverGlob(options.root, glob);

    if (files.length === 0) {
      diagnostics.push({
        code: "aperture.systemGlob.empty",
        glob,
        message: `System glob '${glob}' did not match any files.`,
        suggestedFix:
          "Check the systems array in aperture.config.ts or create matching *.system.ts files.",
      });
    }

    for (const file of files) {
      if (discoveredFiles.has(file)) continue;
      discoveredFiles.add(file);
      const source = await fs.readFile(file, "utf8");
      const systemDiagnostics: ApertureVitePluginDiagnostic[] = [];
      const hasDefaultExport = systemHasDefaultExport(source, file);
      const priority = parseSystemDescriptorPriority(source, file);

      if (!hasDefaultExport) {
        systemDiagnostics.push({
          code: "aperture.system.missingDefaultExport",
          file,
          message: `System module '${file}' does not default-export a system class.`,
          suggestedFix:
            "Default-export a class extending createSystem() from @aperture-engine/app/systems.",
        });
      }

      if (priority === null) {
        systemDiagnostics.push({
          code: "aperture.system.invalidPriority",
          file,
          message: `System module '${file}' has invalid createSystem descriptor priority metadata.`,
          suggestedFix: "Use createSystem({ priority: 0 }) or omit priority.",
        });
      }

      diagnostics.push(...systemDiagnostics);
      systems.push({
        file,
        moduleUrl: toModuleUrl(file),
        hasDefaultExport,
        schedule: { priority: priority ?? 0 },
        diagnostics: systemDiagnostics,
      });
    }
  }

  return {
    systems: systems.sort(
      (a, b) =>
        a.schedule.priority - b.schedule.priority ||
        a.moduleUrl.localeCompare(b.moduleUrl),
    ),
    diagnostics,
  };
}

export function parseApertureSystemGlobs(source: string | null): string[] {
  return findApertureSystemGlobs(source) ?? [];
}

function findApertureSystemGlobs(source: string | null): string[] | null {
  if (source === null) {
    return null;
  }

  const parsed = ts.createSourceFile(
    "config.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const globs: string[] = [];
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isPropertyAssignment(node) &&
      isNamedPropertyAssignment(node, "systems") &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      found = true;
      for (const element of node.initializer.elements) {
        if (
          ts.isStringLiteral(element) ||
          ts.isNoSubstitutionTemplateLiteral(element)
        )
          globs.push(element.text);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);

  return found ? globs : null;
}

/** Static config dependencies used consistently by discovery and HMR. */
export async function readApertureSystemConfigGraph(
  configFile: string,
): Promise<{
  readonly globs: readonly string[];
  readonly files: readonly string[];
}> {
  const visited = new Set<string>();
  async function visit(file: string): Promise<string[]> {
    file = path.resolve(file);
    if (visited.has(file)) return [];
    visited.add(file);
    const source = await readOptionalText(file);
    if (source === null) return [];
    const direct = findApertureSystemGlobs(source);
    let imported: string[] = [];
    for (const specifier of localImportSpecifiers(source)) {
      const dependency = await resolveLocalImport(file, specifier);
      if (dependency !== null) {
        const nested = await visit(dependency);
        if (imported.length === 0) imported = nested;
      }
    }
    return direct ?? imported;
  }
  const globs = await visit(configFile);
  return { globs, files: [...visited] };
}

function systemHasDefaultExport(source: string, file: string): boolean {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(file),
  );
  return parsed.statements.some(
    (statement) =>
      (ts.isExportAssignment(statement) && !statement.isExportEquals) ||
      (ts.isExportDeclaration(statement) &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some(
          (element) => element.name.text === "default",
        )) ||
      (ts.canHaveModifiers(statement) &&
        ts
          .getModifiers(statement)
          ?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
          ) === true),
  );
}

function localImportSpecifiers(source: string): string[] {
  const parsed = ts.createSourceFile(
    "config.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const specifiers: string[] = [];
  for (const statement of parsed.statements) {
    if (
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith(".")
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
}

async function resolveLocalImport(
  importer: string,
  specifier: string,
): Promise<string | null> {
  const candidate = path.resolve(path.dirname(importer), specifier);
  const candidates = path.extname(candidate)
    ? [
        candidate,
        candidate.endsWith(".js")
          ? `${candidate.slice(0, -".js".length)}.ts`
          : candidate,
      ]
    : [`${candidate}.ts`, `${candidate}.js`, path.join(candidate, "index.ts")];

  for (const file of candidates) {
    if (await fileExists(file)) {
      return file;
    }
  }

  return null;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    const stats = await fs.stat(file);
    return stats.isFile();
  } catch {
    return false;
  }
}

export function apertureSystemFileMatchesGlobs(
  root: string,
  file: string,
  globs: readonly string[],
): boolean {
  const relative = normalizePath(path.relative(root, file));

  return globs.some((glob) => globToRegExp(normalizePath(glob)).test(relative));
}

export function apertureSystemGlobBase(root: string, glob: string): string {
  return globBase(root, normalizePath(glob));
}

function parseSystemDescriptorPriority(
  source: string,
  fileName: string,
): number | null {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(fileName),
  );
  let priority: number | null | undefined;

  const visit = (node: ts.Node): void => {
    if (priority !== undefined) {
      return;
    }

    if (ts.isCallExpression(node) && isCreateSystemCall(node)) {
      priority = readCreateSystemPriority(node);
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return priority === undefined ? 0 : priority;
}

function isCreateSystemCall(node: ts.CallExpression): boolean {
  const expression = node.expression;

  return (
    (ts.isIdentifier(expression) && expression.text === "createSystem") ||
    (ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "createSystem")
  );
}

function readCreateSystemPriority(node: ts.CallExpression): number | null {
  const descriptor = node.arguments[0];

  if (descriptor === undefined || !ts.isObjectLiteralExpression(descriptor)) {
    return 0;
  }

  const priorityProperty = descriptor.properties.find((property) =>
    isNamedPropertyAssignment(property, "priority"),
  );

  if (priorityProperty === undefined) {
    return 0;
  }

  const priority = numericLiteralValue(priorityProperty.initializer);

  return priority === null || !Number.isFinite(priority) ? null : priority;
}

async function discoverGlob(root: string, glob: string): Promise<string[]> {
  const normalizedGlob = normalizePath(glob);
  const base = globBase(root, normalizedGlob);
  const matcher = globToRegExp(normalizedGlob);
  const output: string[] = [];

  async function visit(directory: string): Promise<void> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const absolute = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          await visit(absolute);
          continue;
        }

        const relative = normalizePath(path.relative(root, absolute));
        if (matcher.test(relative)) {
          output.push(absolute);
        }
      }
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { readonly code?: unknown }).code === "ENOENT"
      ) {
        return;
      }

      throw error;
    }
  }

  await visit(base);
  return output.sort((a, b) => a.localeCompare(b));
}

function globBase(root: string, glob: string): string {
  const wildcardIndex = glob.search(/[*?[\]]/);
  const prefix = wildcardIndex === -1 ? glob : glob.slice(0, wildcardIndex);
  const slash = prefix.lastIndexOf("/");
  const directory = slash === -1 ? "." : prefix.slice(0, slash);

  return path.resolve(root, directory);
}

function globToRegExp(glob: string): RegExp {
  let pattern = "^";

  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];

    if (char === "*" && next === "*") {
      if (glob[index + 2] === "/") {
        pattern += "(?:.*/)?";
        index += 2;
        continue;
      }

      pattern += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      pattern += "[^/]*";
      continue;
    }

    if (char === "?") {
      pattern += ".";
      continue;
    }

    pattern += escapeRegExp(char ?? "");
  }

  pattern += "$";
  return new RegExp(pattern);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}
