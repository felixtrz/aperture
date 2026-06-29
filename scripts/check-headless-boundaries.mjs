#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const HEADLESS_PATHS = [
  "packages/app/src/headless.ts",
  "packages/app/src/headless-tools.ts",
  "packages/app/src/systems/frame-time.ts",
  "packages/app/src/systems/random.ts",
  "packages/cli/src/headless",
  "packages/cli/src/commands/headless.ts",
  "packages/cli/src/commands/headless-serve.ts",
];

const FORBIDDEN_PACKAGE_IMPORTS = new Set([
  "@aperture-engine/webgpu",
  "playwright",
]);

const FORBIDDEN_GLOBALS = new Set([
  "AudioContext",
  "Blob",
  "CSSStyleSheet",
  "Document",
  "Element",
  "EventTarget",
  "File",
  "FileReader",
  "Gamepad",
  "GPUAdapter",
  "GPUCanvasContext",
  "GPUDevice",
  "HTMLCanvasElement",
  "HTMLElement",
  "Image",
  "ImageBitmap",
  "KeyboardEvent",
  "MouseEvent",
  "Navigator",
  "OffscreenCanvas",
  "PointerEvent",
  "Request",
  "Response",
  "WebGLRenderingContext",
  "WheelEvent",
  "Window",
  "cancelAnimationFrame",
  "document",
  "localStorage",
  "navigator",
  "requestAnimationFrame",
  "sessionStorage",
  "window",
]);

const files = collectHeadlessFiles();
const violations = [];

for (const filePath of files) {
  checkSourceFile(filePath);
}

if (violations.length > 0) {
  console.error(
    [
      "Headless boundary check failed:",
      ...violations.map(
        (violation) =>
          `- ${violation.file}:${violation.line}:${violation.column} ${violation.message}`,
      ),
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`Headless boundary check passed (${files.length} files).`);
}

function collectHeadlessFiles() {
  const result = [];

  for (const entry of HEADLESS_PATHS) {
    const absolutePath = path.join(rootDir, entry);

    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      result.push(...walkFiles(absolutePath));
    } else if (stat.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry))) {
      result.push(absolutePath);
    }
  }

  return result.sort((a, b) => a.localeCompare(b));
}

function checkSourceFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(filePath),
  );

  const report = (node, message) => {
    const position = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    violations.push({
      file: displayPath(filePath),
      line: position.line + 1,
      column: position.character + 1,
      message,
    });
  };

  const visit = (node) => {
    const specifier = moduleSpecifierText(node);
    if (specifier !== null && isForbiddenImport(specifier)) {
      report(
        node,
        `Headless code must not import browser-only module '${specifier}'. Use an explicit adapter boundary instead.`,
      );
    }

    if (isForbiddenDynamicImport(node)) {
      const specifierText = node.arguments[0].text;
      report(
        node,
        `Headless code must not dynamically import browser-only module '${specifierText}'.`,
      );
    }

    if (isForbiddenRequire(node)) {
      const specifierText = node.arguments[0].text;
      report(
        node,
        `Headless code must not require browser-only module '${specifierText}'.`,
      );
    }

    if (ts.isIdentifier(node) && FORBIDDEN_GLOBALS.has(node.text)) {
      report(
        node,
        `Headless code must not reference browser global '${node.text}'.`,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function isForbiddenImport(specifier) {
  if (FORBIDDEN_PACKAGE_IMPORTS.has(specifier)) {
    return true;
  }

  return (
    specifier.includes("/browser/") ||
    specifier.endsWith("/browser") ||
    specifier.includes("/worker/") ||
    specifier.endsWith("/worker")
  );
}

function isForbiddenDynamicImport(node) {
  return (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    isForbiddenImport(node.arguments[0].text)
  );
}

function isForbiddenRequire(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require" &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    isForbiddenImport(node.arguments[0].text)
  );
}

function moduleSpecifierText(node) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }

  return null;
}

function walkFiles(directory) {
  const result = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...walkFiles(entryPath));
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entryPath))) {
      result.push(entryPath);
    }
  }

  return result;
}

function scriptKindForPath(filePath) {
  switch (path.extname(filePath)) {
    case ".cts":
    case ".mts":
    case ".ts":
      return ts.ScriptKind.TS;
    case ".tsx":
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.Unknown;
  }
}

function displayPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}
