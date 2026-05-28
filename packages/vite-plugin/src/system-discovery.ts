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
    parseSystemGlobs(configSource).map((glob) => normalizePath(glob));

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
      const source = await fs.readFile(file, "utf8");
      const systemDiagnostics: ApertureVitePluginDiagnostic[] = [];
      const hasDefaultExport = /\bexport\s+default\b/.test(source);
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

function parseSystemGlobs(source: string | null): string[] {
  if (source === null) {
    return [];
  }

  const systemsMatch = /\bsystems\s*:\s*\[([\s\S]*?)\]/m.exec(source);

  if (systemsMatch === null) {
    return [];
  }

  const body = systemsMatch[1] ?? "";
  const globs: string[] = [];
  const stringLiteral = /["'`]([^"'`]+)["'`]/g;
  let match: RegExpExecArray | null;

  while ((match = stringLiteral.exec(body)) !== null) {
    if (match[1] !== undefined) {
      globs.push(match[1]);
    }
  }

  return globs;
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
