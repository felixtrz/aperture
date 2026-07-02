#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const DEFAULT_HEADLESS_PACKAGES = [
  "math",
  "simulation",
  "physics",
  "physics-rapier",
  "particles",
  "render",
  "runtime",
  "ui",
];

export const FORBIDDEN_WEBGPU_PACKAGE = "@aperture-engine/webgpu";

export const FORBIDDEN_WEBGPU_GLOBALS = [
  "GPUAdapter",
  "GPUBindGroup",
  "GPUBuffer",
  "GPUCanvasContext",
  "GPUCommandBuffer",
  "GPUCommandEncoder",
  "GPUDevice",
  "GPUMapMode",
  "GPUQueue",
  "GPURenderPassEncoder",
  "GPURenderPipeline",
  "GPUSampler",
  "GPUShaderModule",
  "GPUShaderStage",
  "GPUTexture",
  "GPUTextureUsage",
  "GPUTextureView",
];

// Web Audio is main-thread-only, so headless packages (which the audio plan
// keeps free of any Web Audio node) must never reference these globals. The
// non-headless @aperture-engine/audio package is exempt — it is not in
// DEFAULT_HEADLESS_PACKAGES, exactly as @aperture-engine/webgpu is exempt from
// the GPU globals. `AudioListener` is intentionally absent: it collides with
// the render-side ECS component of the same name and is never constructed
// directly anyway (you reach it via `context.listener`).
export const FORBIDDEN_WEBAUDIO_GLOBALS = [
  "AnalyserNode",
  "AudioBufferSourceNode",
  "AudioContext",
  "AudioWorkletNode",
  "BiquadFilterNode",
  "ConvolverNode",
  "DynamicsCompressorNode",
  "GainNode",
  "MediaElementAudioSourceNode",
  "OfflineAudioContext",
  "PannerNode",
  "webkitAudioContext",
];

// The invariant is the WORKER IMPORT GRAPH: headless-package code (outside a
// package's browser entry) must run in workers and Node, so only
// MAIN-THREAD-ONLY globals are banned. Worker-available APIs (Blob, Response,
// Request, File, OffscreenCanvas, ImageBitmap, EventTarget, ...) are
// deliberately absent — render's texture decode legitimately uses them from
// the worker with feature detection.
export const FORBIDDEN_BROWSER_GLOBALS = [
  "CSSStyleSheet",
  "Document",
  "Element",
  "Gamepad",
  "HTMLCanvasElement",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Image",
  "KeyboardEvent",
  "MouseEvent",
  "PointerEvent",
  "WheelEvent",
  "Window",
  "cancelAnimationFrame",
  "document",
  "localStorage",
  "requestAnimationFrame",
  "sessionStorage",
  "window",
];

// Browser-only code in a headless package must live behind the package's
// browser entry: `src/browser.ts`/`src/browser.tsx` plus anything under
// `src/browser/`. Every other source file is part of the worker import graph
// and must stay free of browser globals. The exemption is structural so the
// next feature package with a browser split is covered with zero edits here.
function isBrowserEntrySubpath(sourceDir, filePath) {
  const relative = path.relative(sourceDir, filePath);

  return (
    relative === "browser.ts" ||
    relative === "browser.tsx" ||
    relative.startsWith(`browser${path.sep}`)
  );
}

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export function checkPackageBoundaries(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const headlessPackages =
    options.headlessPackages ?? DEFAULT_HEADLESS_PACKAGES;
  const forbiddenGlobals = new Set(
    options.forbiddenGlobals ?? FORBIDDEN_WEBGPU_GLOBALS,
  );
  const forbiddenAudioGlobals = new Set(
    options.forbiddenAudioGlobals ?? FORBIDDEN_WEBAUDIO_GLOBALS,
  );
  const forbiddenBrowserGlobals = new Set(
    options.forbiddenBrowserGlobals ?? FORBIDDEN_BROWSER_GLOBALS,
  );
  const forbiddenPackage = options.forbiddenPackage ?? FORBIDDEN_WEBGPU_PACKAGE;
  const violations = [];

  for (const packageName of headlessPackages) {
    const packageDir = path.join(rootDir, "packages", packageName);

    if (!fs.existsSync(packageDir)) {
      continue;
    }

    collectPackageJsonViolations({
      rootDir,
      packageName,
      packageDir,
      forbiddenPackage,
      violations,
    });

    const sourceDir = path.join(packageDir, "src");

    if (!fs.existsSync(sourceDir)) {
      continue;
    }

    for (const filePath of walkFiles(sourceDir)) {
      if (!SOURCE_EXTENSIONS.has(path.extname(filePath))) {
        continue;
      }

      collectSourceViolations({
        rootDir,
        packageName,
        filePath,
        forbiddenPackage,
        forbiddenGlobals,
        forbiddenAudioGlobals,
        forbiddenBrowserGlobals,
        isBrowserEntryFile: isBrowserEntrySubpath(sourceDir, filePath),
        violations,
      });
    }
  }

  return violations;
}

export function formatPackageBoundaryViolations(violations) {
  if (violations.length === 0) {
    return "Package boundary check passed.";
  }

  return [
    "Package boundary check failed:",
    ...violations.map((violation) => {
      const location =
        violation.line === undefined
          ? violation.file
          : `${violation.file}:${violation.line}:${violation.column}`;

      return `- ${location} [${violation.packageName}] ${violation.message}`;
    }),
  ].join("\n");
}

function collectPackageJsonViolations(options) {
  const packageJsonPath = path.join(options.packageDir, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  const source = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(source);

  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = packageJson[section];

    if (
      dependencies === null ||
      typeof dependencies !== "object" ||
      !Object.hasOwn(dependencies, options.forbiddenPackage)
    ) {
      continue;
    }

    const offset = source.indexOf(`"${options.forbiddenPackage}"`);
    const position = lineColumnAtOffset(source, offset < 0 ? 0 : offset);

    options.violations.push({
      packageName: options.packageName,
      file: displayPath(options.rootDir, packageJsonPath),
      line: position.line,
      column: position.column,
      kind: "package-dependency",
      name: options.forbiddenPackage,
      message: `Headless package declares forbidden dependency '${options.forbiddenPackage}' in ${section}.`,
    });
  }
}

function collectSourceViolations(options) {
  const source = fs.readFileSync(options.filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    options.filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(options.filePath),
  );

  const report = (node, kind, name, message) => {
    const position = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );

    options.violations.push({
      packageName: options.packageName,
      file: displayPath(options.rootDir, options.filePath),
      line: position.line + 1,
      column: position.character + 1,
      kind,
      name,
      message,
    });
  };

  const visit = (node) => {
    const moduleSpecifier = moduleSpecifierText(node);

    if (moduleSpecifier === options.forbiddenPackage) {
      report(
        node,
        "forbidden-import",
        options.forbiddenPackage,
        `Headless package imports forbidden WebGPU backend package '${options.forbiddenPackage}'.`,
      );
    }

    if (isForbiddenDynamicImport(node, options.forbiddenPackage)) {
      report(
        node,
        "forbidden-import",
        options.forbiddenPackage,
        `Headless package dynamically imports forbidden WebGPU backend package '${options.forbiddenPackage}'.`,
      );
    }

    if (isForbiddenRequire(node, options.forbiddenPackage)) {
      report(
        node,
        "forbidden-import",
        options.forbiddenPackage,
        `Headless package requires forbidden WebGPU backend package '${options.forbiddenPackage}'.`,
      );
    }

    if (isNavigatorGpuAccess(node)) {
      report(
        node,
        "forbidden-global",
        "navigator.gpu",
        "Headless package reads browser WebGPU global 'navigator.gpu'.",
      );
    }

    if (ts.isIdentifier(node) && options.forbiddenGlobals.has(node.text)) {
      report(
        node,
        "forbidden-global",
        node.text,
        `Headless package references browser WebGPU global '${node.text}'.`,
      );
    }

    if (ts.isIdentifier(node) && options.forbiddenAudioGlobals.has(node.text)) {
      report(
        node,
        "forbidden-global",
        node.text,
        `Headless package references browser Web Audio global '${node.text}'.`,
      );
    }

    if (
      !options.isBrowserEntryFile &&
      ts.isIdentifier(node) &&
      options.forbiddenBrowserGlobals.has(node.text)
    ) {
      report(
        node,
        "forbidden-global",
        node.text,
        `Headless package references browser global '${node.text}'. Move browser-only code behind the package's browser entry (src/browser.ts or src/browser/).`,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
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

function isForbiddenDynamicImport(node, forbiddenPackage) {
  return (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === forbiddenPackage
  );
}

function isForbiddenRequire(node, forbiddenPackage) {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require" &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === forbiddenPackage
  );
}

function isNavigatorGpuAccess(node) {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "navigator" &&
    node.name.text === "gpu"
  );
}

function scriptKindForPath(filePath) {
  switch (path.extname(filePath)) {
    case ".cjs":
    case ".js":
    case ".mjs":
      return ts.ScriptKind.JS;
    case ".cts":
    case ".mts":
    case ".ts":
      return ts.ScriptKind.TS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".tsx":
      return ts.ScriptKind.TSX;
    default:
      return ts.ScriptKind.Unknown;
  }
}

function* walkFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(entryPath);
      continue;
    }

    if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function lineColumnAtOffset(source, offset) {
  const prefix = source.slice(0, offset);
  const lines = prefix.split(/\r\n|\r|\n/);

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function displayPath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function isMainModule() {
  return path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const violations = checkPackageBoundaries();
  const output = formatPackageBoundaryViolations(violations);

  if (violations.length > 0) {
    console.error(output);
    process.exitCode = 1;
  } else {
    console.log(output);
  }
}
