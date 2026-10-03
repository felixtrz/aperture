import ts from "typescript";
const normalized = (text) => text.replace(/\s+/g, "");

// Deliberately narrow proof for this pinned generated-app call. Any enabled,
// static, differently guarded, overridden, or unrecognized edge fails closed.
export function proveDisabledAudioImport(appSource, mainSource, config) {
  if (config.audio !== undefined)
    throw Error("Audio edge is enabled or unproven");
  const app = ts.createSourceFile(
    "app.js",
    appSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const main = ts.createSourceFile(
    "main.mjs",
    mainSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const imports = [],
    calls = [],
    declarations = [],
    resolvers = [];
  function visitApp(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier?.text?.includes("audio")
    )
      throw Error("Static audio import cannot be excluded");
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0]?.text === "./audio.js"
    )
      imports.push(node);
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(app) === "audioOptions"
    )
      declarations.push(node.initializer?.getText(app));
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "resolveGeneratedAudioOptions"
    )
      resolvers.push(node);
    ts.forEachChild(node, visitApp);
  }
  function visitMain(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(main) === "startGeneratedBrowserApp"
    )
      calls.push(node);
    ts.forEachChild(node, visitMain);
  }
  visitApp(app);
  visitMain(main);
  if (
    imports.length !== 1 ||
    calls.length !== 1 ||
    declarations.length !== 1 ||
    normalized(declarations[0] ?? "") !==
      "resolveGeneratedAudioOptions(config,options.audio)" ||
    resolvers.length !== 1
  )
    throw Error("Unproven audio option/import path");
  let guard = imports[0].parent;
  while (guard && !ts.isIfStatement(guard)) guard = guard.parent;
  if (
    !guard ||
    normalized(guard.expression.getText(app)) !==
      "audioOptions!==undefined&&audioOptions!==false" ||
    !guard.thenStatement.getText(app).includes(imports[0].getText(app))
  )
    throw Error("Audio dynamic import guard changed");
  const resolver = normalized(resolvers[0].body.getText(app));
  if (
    !resolver.startsWith(
      "{if(override!==undefined){returnoverride;}constaudio=config.audio;if(audio===undefined||audio===false){returnundefined;}",
    )
  )
    throw Error("Audio disabled-option resolution changed");
  const options = calls[0].arguments[0];
  if (
    !options ||
    !ts.isObjectLiteralExpression(options) ||
    options.properties.some(
      (property) =>
        ts.isSpreadAssignment(property) ||
        property.name?.getText(main) === "audio",
    )
  )
    throw Error("Audio override/spread is unproven");
  const configProperty = options.properties.find(
    (property) => property.name?.getText(main) === "config",
  );
  if (
    !configProperty ||
    !ts.isPropertyAssignment(configProperty) ||
    configProperty.initializer.getText(main) !== "CONFIG"
  )
    throw Error("Browser call does not use frozen CONFIG");
  return {
    kind: "proved-disabled-dynamic-import",
    module: "packages/app/dist/browser/app.js",
    specifier: "./audio.js",
    dynamicImportLine:
      app.getLineAndCharacterOfPosition(imports[0].getStart(app)).line + 1,
    guardLine: app.getLineAndCharacterOfPosition(guard.getStart(app)).line + 1,
    resolverLine:
      app.getLineAndCharacterOfPosition(resolvers[0].getStart(app)).line + 1,
    browserCallLine:
      main.getLineAndCharacterOfPosition(calls[0].getStart(main)).line + 1,
    reason:
      "Actual dynamic import is inside the enabled-audio guard; absent frozen CONFIG.audio and no call override resolve to undefined.",
  };
}
