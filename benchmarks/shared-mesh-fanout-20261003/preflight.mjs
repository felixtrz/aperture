/** Resolve/syntax-check actual browser routes on CPU; never listen or launch. */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { collectPins } from "./freeze.mjs";
import { readServedModule } from "./run.mjs";
import { proveDisabledAudioImport } from "../worker-shadow-light-matrix-20261003/import-proof.mjs";
import { sceneModule } from "./cpu-loader.mjs";
const directory = dirname(fileURLToPath(import.meta.url)),
  pins = await collectPins(),
  source = await readFile(resolve(directory, "author-a/main.mjs"), "utf8");
const { CONFIG } = (await sceneModule("aperture")).module;
const queue = ["/author-a/main.mjs", "/author-a/worker.mjs"],
  modules = new Map(),
  excluded = [],
  nonliteral = [];
while (queue.length) {
  const pathname = queue.pop();
  if (modules.has(pathname)) continue;
  const module = await readServedModule(pathname, "live", pins),
    text = module.body.toString("utf8"),
    parsed = ts.createSourceFile(
      module.name,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    ),
    imports = [];
  if (parsed.parseDiagnostics.length)
    throw Error(
      `Syntax error in ${pathname}: ${parsed.parseDiagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; ")}`,
    );
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
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const specifier = node.arguments[0].text;
        if (
          module.name === "packages/app/dist/browser/app.js" &&
          specifier === "./audio.js"
        )
          excluded.push(proveDisabledAudioImport(text, source, CONFIG));
        else imports.push(specifier);
      } else nonliteral.push({ pathname, expression: node.getText(parsed) });
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  modules.set(pathname, { ...module, body: undefined, imports });
  for (const specifier of imports) {
    if (!specifier.startsWith("/") && !specifier.startsWith("."))
      throw Error(
        `Unrewritten external/bare import ${specifier} in ${pathname}`,
      );
    const url = new URL(specifier, `http://fixture.invalid${pathname}`);
    if (url.origin !== "http://fixture.invalid") throw Error("External import");
    queue.push(url.pathname);
  }
}
if (nonliteral.length)
  throw Error("Unproven nonliteral imports: " + JSON.stringify(nonliteral));
const output = process.argv[2];
if (!/^[a-z0-9-]+\.json$/.test(output ?? ""))
  throw Error("New report basename required");
const report = {
  status: "passed",
  moduleCount: modules.size,
  modules: Object.fromEntries(modules),
  excludedOptionalImports: excluded,
  nonliteralDynamicImports: nonliteral,
  browsersLaunched: 0,
  serversStarted: 0,
};
await writeFile(
  resolve(directory, output),
  JSON.stringify(report, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    status: "passed",
    modules: modules.size,
    excludedOptionalImports: excluded,
    report: output,
    browsersLaunched: 0,
    serversStarted: 0,
  }),
);
