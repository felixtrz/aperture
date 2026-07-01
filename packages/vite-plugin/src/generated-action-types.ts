import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";
import { readOptionalText, resolveConfigFile } from "./file-utils.js";
import {
  isNamedPropertyAssignment,
  propertyNameText,
  scriptKindForPath,
} from "./typescript-ast.js";

const APERTURE_GENERATED_DIRECTORY = ".aperture/generated";
const APERTURE_GENERATED_TYPES_FILE = "aperture-env.d.ts";
const SIBLING_HEADLESS_CONFIG = "aperture.headless.config.ts";

type GeneratedActionKind = "button" | "axis1d" | "axis2d";
type GeneratedSignalKind = "ref" | "string" | "number" | "boolean";

interface GeneratedActionEntry {
  readonly name: string;
  readonly kind: GeneratedActionKind;
}

interface GeneratedSignalEntry {
  readonly name: string;
  readonly kind: GeneratedSignalKind;
}

export interface ApertureGeneratedTypeEntries {
  readonly actions: readonly GeneratedActionEntry[];
  readonly signals: readonly GeneratedSignalEntry[];
}

export async function writeApertureGeneratedActionTypes(options: {
  readonly root: string;
  readonly configFile?: string;
}): Promise<string> {
  const configFile =
    options.configFile ?? resolveConfigFile(options.root, undefined);
  const entries = await resolveApertureGeneratedTypeEntries(
    options.root,
    configFile,
  );
  const contents = renderApertureGeneratedTypes(entries);
  const directory = path.join(options.root, APERTURE_GENERATED_DIRECTORY);
  const file = path.join(directory, APERTURE_GENERATED_TYPES_FILE);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(file, contents, "utf8");
  return file;
}

/**
 * Resolve the action/signal entries for codegen. The config module is
 * EVALUATED first (#68): the scaffold's recommended factory pattern
 * (`createApertureAppConfig()` in aperture.shared-config.ts) is invisible to
 * a shallow AST parse of the config file and used to yield an empty action
 * map. A browser config that reads import.meta.env cannot be imported in
 * plain Node, so the sibling headless config (built from the same shared
 * factory) is tried next, and the original AST parse remains as the final
 * fallback for configs that cannot be evaluated at all.
 */
async function resolveApertureGeneratedTypeEntries(
  root: string,
  configFile: string,
): Promise<ApertureGeneratedTypeEntries> {
  const evaluated =
    (await evaluateApertureConfigEntries(configFile)) ??
    (await evaluateSiblingHeadlessConfigEntries(root, configFile));

  if (evaluated !== null) {
    return evaluated;
  }

  const source = await readOptionalText(configFile);
  return {
    actions:
      source === null ? [] : parseGeneratedInputActionTypes(source, configFile),
    signals: [],
  };
}

async function evaluateSiblingHeadlessConfigEntries(
  root: string,
  configFile: string,
): Promise<ApertureGeneratedTypeEntries | null> {
  const headlessConfig = path.join(root, SIBLING_HEADLESS_CONFIG);
  if (path.resolve(configFile) === headlessConfig) {
    return null;
  }
  return evaluateApertureConfigEntries(headlessConfig);
}

async function evaluateApertureConfigEntries(
  configFile: string,
): Promise<ApertureGeneratedTypeEntries | null> {
  let mtimeMs: number;
  try {
    mtimeMs = (await fs.stat(configFile)).mtimeMs;
  } catch {
    return null;
  }

  try {
    // The mtime query busts Node's module cache when the config changes
    // within one long-lived dev-server process.
    const url = `${pathToFileURL(configFile).href}?aperture-codegen=${mtimeMs}`;
    const moduleRecord = (await import(url)) as Record<string, unknown>;
    return apertureGeneratedTypeEntriesFromConfig(moduleRecord["default"]);
  } catch {
    // Not evaluable in plain Node (e.g. reads import.meta.env, or is not
    // erasable TypeScript) — the caller falls back to other sources.
    return null;
  }
}

/** Extract action/signal codegen entries from an EVALUATED config object. */
export function apertureGeneratedTypeEntriesFromConfig(
  config: unknown,
): ApertureGeneratedTypeEntries | null {
  if (typeof config !== "object" || config === null) {
    return null;
  }

  const record = config as {
    readonly input?: { readonly actions?: Record<string, unknown> };
    readonly signals?: Record<string, unknown>;
  };

  const actions: GeneratedActionEntry[] = [];
  for (const [name, action] of Object.entries(record.input?.actions ?? {})) {
    const kind = (action as { readonly kind?: unknown } | null)?.kind;
    if (kind === "button" || kind === "axis1d" || kind === "axis2d") {
      actions.push({ name, kind });
    }
  }

  const signals: GeneratedSignalEntry[] = [];
  for (const [name, descriptor] of Object.entries(record.signals ?? {})) {
    const kind = (descriptor as { readonly kind?: unknown } | null)?.kind;
    if (
      kind === "ref" ||
      kind === "string" ||
      kind === "number" ||
      kind === "boolean"
    ) {
      signals.push({ name, kind });
    }
  }

  return { actions, signals };
}

export function createApertureGeneratedActionTypes(
  source: string | null,
  fileName = "aperture.config.ts",
): string {
  const actions =
    source === null ? [] : parseGeneratedInputActionTypes(source, fileName);
  return renderApertureGeneratedTypes({ actions, signals: [] });
}

export function renderApertureGeneratedTypes(
  entries: ApertureGeneratedTypeEntries,
): string {
  const lines = [
    `import type { InputAxis1dAction, InputAxis2dAction, InputButtonAction, Signal } from "@aperture-engine/app/systems";`,
    "",
    `declare module "@aperture-engine/app/systems" {`,
    `  interface ApertureGeneratedActionMap {`,
    ...entries.actions.map(
      (action) =>
        `    readonly ${generatedMapProperty(action.name)}: ${generatedActionTypeName(action.kind)};`,
    ),
    `  }`,
    `  interface ApertureGeneratedSignalMap {`,
    ...entries.signals.map(
      (signal) =>
        `    readonly ${generatedMapProperty(signal.name)}: ${generatedSignalTypeName(signal.kind)};`,
    ),
    `  }`,
    `}`,
    "",
    `export {};`,
    "",
  ];

  return lines.join("\n");
}

function parseGeneratedInputActionTypes(
  source: string,
  fileName: string,
): readonly GeneratedActionEntry[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(fileName),
  );
  const actions: GeneratedActionEntry[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isDefineApertureConfigCall(node)) {
      const descriptor = node.arguments[0];
      const actionObject =
        descriptor !== undefined && ts.isObjectLiteralExpression(descriptor)
          ? readInputActionsObject(descriptor)
          : null;

      if (actionObject !== null) {
        actions.push(...readGeneratedInputActions(actionObject));
      }
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return dedupeGeneratedInputActions(actions);
}

function isDefineApertureConfigCall(node: ts.CallExpression): boolean {
  const expression = node.expression;

  return (
    (ts.isIdentifier(expression) &&
      expression.text === "defineApertureConfig") ||
    (ts.isPropertyAccessExpression(expression) &&
      expression.name.text === "defineApertureConfig")
  );
}

function readInputActionsObject(
  descriptor: ts.ObjectLiteralExpression,
): ts.ObjectLiteralExpression | null {
  const inputProperty = descriptor.properties.find((property) =>
    isNamedPropertyAssignment(property, "input"),
  );

  if (
    inputProperty === undefined ||
    !ts.isObjectLiteralExpression(inputProperty.initializer)
  ) {
    return null;
  }

  const actionsProperty = inputProperty.initializer.properties.find(
    (property) => isNamedPropertyAssignment(property, "actions"),
  );

  return actionsProperty !== undefined &&
    ts.isObjectLiteralExpression(actionsProperty.initializer)
    ? actionsProperty.initializer
    : null;
}

function readGeneratedInputActions(
  actionsObject: ts.ObjectLiteralExpression,
): readonly GeneratedActionEntry[] {
  const actions: GeneratedActionEntry[] = [];

  for (const property of actionsObject.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const name = propertyNameText(property.name);
    const kind = readGeneratedInputActionKind(property.initializer);

    if (name !== null && kind !== null) {
      actions.push({ name, kind });
    }
  }

  return actions;
}

function readGeneratedInputActionKind(
  initializer: ts.Expression,
): GeneratedActionKind | null {
  if (ts.isArrayLiteralExpression(initializer)) {
    return "button";
  }

  if (ts.isObjectLiteralExpression(initializer)) {
    const kindProperty = initializer.properties.find((property) =>
      isNamedPropertyAssignment(property, "kind"),
    );
    const kind =
      kindProperty !== undefined && ts.isStringLiteral(kindProperty.initializer)
        ? kindProperty.initializer.text
        : null;

    return kind === "button" || kind === "axis1d" || kind === "axis2d"
      ? kind
      : null;
  }

  if (!ts.isCallExpression(initializer)) {
    return null;
  }

  const expression = initializer.expression;
  const helper =
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.name)
      ? expression.name.text
      : ts.isIdentifier(expression)
        ? expression.text
        : null;

  return helper === "button" || helper === "axis1d" || helper === "axis2d"
    ? helper
    : null;
}

function dedupeGeneratedInputActions(
  actions: readonly GeneratedActionEntry[],
): readonly GeneratedActionEntry[] {
  const byName = new Map<string, GeneratedActionKind>();

  for (const action of actions) {
    byName.set(action.name, action.kind);
  }

  return [...byName].map(([name, kind]) => ({ name, kind }));
}

function generatedMapProperty(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function generatedActionTypeName(kind: GeneratedActionKind): string {
  if (kind === "button") {
    return "InputButtonAction";
  }

  return kind === "axis1d" ? "InputAxis1dAction" : "InputAxis2dAction";
}

function generatedSignalTypeName(kind: GeneratedSignalKind): string {
  if (kind === "string") {
    return "Signal<string>";
  }
  if (kind === "number") {
    return "Signal<number>";
  }
  if (kind === "boolean") {
    return "Signal<boolean>";
  }
  return "Signal<unknown>";
}
