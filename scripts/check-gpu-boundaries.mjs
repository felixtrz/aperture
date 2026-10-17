#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { builtinModules, createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const native = /^(?:webgpu|@aperture-engine\/adapter-node)(?:\/|$)/;
const compiler =
  /(?:wgsl_reflect|\/compiler(?:-core|-layout)?\.js$|@aperture-engine\/shader\/(?:compiler|prepare)$)/;
const browserLauncher =
  /(?:playwright|puppeteer|browser-driver|static-server|local-webgpu|verified-webgpu|xvfb)/i;
const builtins = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
);
const entrypoints = [
  {
    name: "standalone",
    entry: "packages/gpu/dist/index.js",
    forbidden: [
      native,
      compiler,
      /^@aperture-engine\/(?:simulation|physics|ui|app|runtime|render|webgpu)(?:\/|$)/,
    ],
    node: false,
  },
  {
    name: "standalone-browser",
    entry: "packages/gpu/dist/browser.js",
    forbidden: [
      native,
      compiler,
      /^@aperture-engine\/(?:simulation|physics|ui|app|runtime|render|webgpu)(?:\/|$)/,
    ],
    node: false,
  },
  {
    name: "shader-runtime",
    entry: "packages/shader/dist/index.js",
    forbidden: [native, compiler],
    node: false,
  },
  {
    name: "browser-app",
    entry: "packages/app/dist/browser.js",
    forbidden: [native, compiler, browserLauncher],
    node: false,
  },
  {
    name: "cpu-headless",
    entry: "packages/app/dist/headless.js",
    forbidden: [
      native,
      compiler,
      browserLauncher,
      /^@aperture-engine\/(?:webgpu|gpu)(?:\/|$)/,
    ],
    node: true,
  },
  {
    name: "dawn-worker",
    entry: "packages/cli/dist/render/dawn-worker.js",
    forbidden: [browserLauncher, compiler],
    node: true,
  },
  {
    name: "dynamic-prepare",
    entry: "packages/shader/dist/prepare.js",
    forbidden: [native],
    node: false,
  },
];
const summaries = [];
for (const policy of entrypoints) {
  const visited = new Set();
  const externals = new Set();
  const contents = [];
  function walk(file, chain = []) {
    if (
      visited.has(file) ||
      path.extname(file) === ".json" ||
      path.extname(file) === ".node"
    )
      return;
    visited.add(file);
    const source = fs.readFileSync(file, "utf8");
    contents.push(source);
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const visit = (node) => {
      let specifier;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        specifier = node.moduleSpecifier.text;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require")) &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      )
        specifier = node.arguments[0].text;
      if (specifier !== undefined) {
        const trace = [...chain, path.relative(root, file), specifier].join(
          " -> ",
        );
        assert(
          !policy.forbidden.some((pattern) => pattern.test(specifier)),
          `${policy.name}: forbidden runtime dependency: ${trace}`,
        );
        if (builtins.has(specifier)) {
          assert(policy.node, `${policy.name}: Node dependency: ${trace}`);
          externals.add(specifier);
        } else if (!specifier.startsWith("#")) {
          const resolved = resolve(specifier, file);
          assert(
            !policy.forbidden.some((pattern) => pattern.test(resolved)),
            `${policy.name}: forbidden runtime file: ${trace}`,
          );
          walk(resolved, [...chain, path.relative(root, file)]);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  walk(path.join(root, policy.entry));
  const joined = contents.join("\n");
  summaries.push({
    name: policy.name,
    files: visited.size,
    unbundledSourceBytes: Buffer.byteLength(joined),
    unbundledGzipBytes: gzipSync(joined).length,
    nodeBuiltins: [...externals].sort(),
  });
}
console.log(
  JSON.stringify(
    {
      note: "Transitive built-JS import closure, including literal dynamic imports. Sizes are unbundled, not tree-shaken production bundle sizes.",
      entrypoints: summaries,
    },
    null,
    2,
  ),
);

function resolve(specifier, from) {
  if (specifier.startsWith("."))
    return path.resolve(path.dirname(from), specifier);
  if (specifier.startsWith("@aperture-engine/")) {
    const [scope, name, ...parts] = specifier.split("/");
    const directory = path.join(root, "packages", name);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "package.json"), "utf8"),
    );
    assert.equal(manifest.name, `${scope}/${name}`);
    const subpath = parts.length ? `./${parts.join("/")}` : ".";
    let target = manifest.exports[subpath];
    if (!target) {
      for (const [pattern, value] of Object.entries(manifest.exports)) {
        if (!pattern.includes("*")) continue;
        const [prefix, suffix] = pattern.split("*");
        if (subpath.startsWith(prefix) && subpath.endsWith(suffix)) {
          const replacement = subpath.slice(
            prefix.length,
            subpath.length - suffix.length || undefined,
          );
          target = (typeof value === "string" ? value : value.import).replace(
            "*",
            replacement,
          );
          break;
        }
      }
    }
    assert(target, `No export for ${specifier}`);
    return path.resolve(
      directory,
      typeof target === "string" ? target : (target.import ?? target.default),
    );
  }
  return createRequire(from).resolve(specifier);
}
