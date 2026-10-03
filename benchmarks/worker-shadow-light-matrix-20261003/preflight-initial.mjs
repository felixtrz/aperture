// CPU-only: resolve the same rewritten module graph that the immutable server
// will serve, without listening, loading browser modules, or launching a browser.
import { readFile, realpath } from "node:fs/promises";
import { relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { checkPins, resolveFixtureModulePath } from "./run.mjs";
import { rewriteWorkerModuleImports } from "../../scripts/serve-examples.mjs";

const directory = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(directory, "../..");
const pins = await checkPins(),
  queue = ["main.mjs", "worker.mjs"].map(
    (name) => `/worker-modules/${relative(repo, directory)}/${name}`,
  );
const modules = new Map(),
  nonliteral = [];
while (queue.length) {
  const pathname = queue.pop();
  if (modules.has(pathname)) continue;
  const target = resolveFixtureModulePath(pathname);
  if (!target) throw Error(`Unserved module route: ${pathname}`);
  const actual = await realpath(target),
    name = relative(repo, actual);
  if (!pins.files[name]) throw Error(`Unpinned module: ${name}`);
  const source = rewriteWorkerModuleImports(await readFile(actual, "utf8"));
  const parsed = ts.createSourceFile(
    name,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  if (parsed.parseDiagnostics.length)
    throw Error(
      `Syntax error in ${name}: ${parsed.parseDiagnostics.map((value) => ts.flattenDiagnosticMessageText(value.messageText, " ")).join("; ")}`,
    );
  const imports = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      imports.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteral(argument)) imports.push(argument.text);
      else nonliteral.push({ module: name, expression: node.getText(parsed) });
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  modules.set(pathname, {
    path: name,
    sha256: pins.files[name].sha256,
    imports,
  });
  for (const specifier of imports) {
    if (!(specifier.startsWith("/") || specifier.startsWith(".")))
      throw Error(`Unrewritten bare/external import ${specifier} in ${name}`);
    const url = new URL(specifier, `http://fixture.invalid${pathname}`);
    if (url.origin !== "http://fixture.invalid")
      throw Error(`External import: ${url}`);
    queue.push(url.pathname);
  }
}
const main = await readFile(resolve(directory, "main.mjs"), "utf8");
if (
  main.includes("manualSource") ||
  /renderer\.renderSnapshot\s*\(/.test(main) ||
  main.includes("createFixture")
)
  throw Error("Manual main-thread fixture/render path detected");
const appSource = await readFile(
  resolve(repo, "packages/app/dist/browser/app.js"),
  "utf8",
);
const startAt = appSource.indexOf("webgpu.app.start();"),
  returnAt = appSource.indexOf("return {", startAt);
if (
  startAt < 0 ||
  returnAt < startAt ||
  /\bawait\b/.test(appSource.slice(startAt, returnAt))
)
  throw Error("Generated startup hook-order premise changed");
console.log(
  JSON.stringify(
    {
      status: "passed",
      modules: Object.fromEntries(modules),
      nonliteralDynamicImports: nonliteral,
      browsersLaunched: 0,
      serversStarted: 0,
    },
    null,
    2,
  ),
);
