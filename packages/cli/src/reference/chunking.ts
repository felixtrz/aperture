import path from "node:path";
import {
  Node,
  SyntaxKind,
  type ClassDeclaration,
  type Node as MorphNode,
  type Project,
  type SourceFile,
} from "ts-morph";
import { tokenizeReferenceText } from "./embedding.js";
import type {
  ApertureReferenceChunkMetadata,
  ApertureReferenceChunkType,
} from "./contracts.js";
import type { CandidateSource } from "./source-collection.js";

const MAX_WHOLE_FILE_CHUNK_BYTES = 18_000;

export interface RawReferenceChunk {
  readonly content: string;
  readonly metadata: Omit<ApertureReferenceChunkMetadata, "semanticLabels"> & {
    readonly semanticLabels?: readonly string[];
  };
}

export function chunkReferenceSource(
  project: Project,
  candidate: CandidateSource,
  text: string,
): readonly RawReferenceChunk[] {
  if (candidate.file.endsWith(".md")) {
    return chunkMarkdown(candidate, text);
  }

  if (isTypeScriptLike(candidate.file)) {
    return chunkTypeScript(project, candidate, text);
  }

  return [wholeFileChunk(candidate, text)];
}

function chunkMarkdown(
  candidate: CandidateSource,
  text: string,
): readonly RawReferenceChunk[] {
  const lines = text.split(/\r?\n/u);
  const headingLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^#{1,6}\s+/u.test(line));

  if (headingLines.length === 0) {
    return [wholeFileChunk(candidate, text)];
  }

  return headingLines.map((heading, index) => {
    const nextHeading = headingLines[index + 1];
    const endLine = nextHeading?.index ?? lines.length;
    const content = lines.slice(heading.index, endLine).join("\n").trim();
    const name = heading.line.replace(/^#{1,6}\s+/u, "").trim();

    return {
      content,
      metadata: baseMetadata(candidate, {
        chunkType: "doc-section",
        name,
        startLine: heading.index + 1,
        endLine,
        exports: [],
        semanticLabels: ["docs", "markdown", ...labelWords(name)],
      }),
    };
  });
}

function chunkTypeScript(
  project: Project,
  candidate: CandidateSource,
  text: string,
): readonly RawReferenceChunk[] {
  let sourceFile: SourceFile;

  try {
    sourceFile =
      project.getSourceFile(candidate.absoluteFile) ??
      project.addSourceFileAtPath(candidate.absoluteFile);
  } catch {
    return [wholeFileChunk(candidate, text)];
  }

  const chunks: RawReferenceChunk[] = [];
  const exportedDeclarations = sourceFile.getExportedDeclarations();

  for (const [exportedName, declarations] of exportedDeclarations) {
    for (const declaration of declarations) {
      chunks.push(
        chunkDeclaration(candidate, sourceFile, declaration, exportedName),
      );
    }
  }

  if (chunks.length === 0 || isGeneratedSystemFile(candidate.file)) {
    chunks.push(...systemClassChunks(candidate, sourceFile));
  }

  for (const diagnostic of diagnosticChunks(candidate, text)) {
    chunks.push(diagnostic);
  }

  if (chunks.length === 0) {
    chunks.push(wholeFileChunk(candidate, text));
  }

  return dedupeChunks(chunks);
}

function chunkDeclaration(
  candidate: CandidateSource,
  sourceFile: SourceFile,
  declaration: MorphNode,
  exportedName: string,
): RawReferenceChunk {
  const content = declaration.getText();
  const name = declarationName(declaration, exportedName);
  const chunkType = chunkTypeForDeclaration(candidate, declaration, content);
  const metadata = metadataForNode(candidate, sourceFile, declaration, {
    chunkType,
    name,
    exportedName,
    content,
  });

  return { content, metadata };
}

function systemClassChunks(
  candidate: CandidateSource,
  sourceFile: SourceFile,
): readonly RawReferenceChunk[] {
  return sourceFile
    .getClasses()
    .filter(
      (declaration) =>
        declaration.getName()?.endsWith("System") === true ||
        declaration.getExtends()?.getText().includes("createSystem") === true ||
        candidate.file.endsWith(".system.ts"),
    )
    .map((declaration) => {
      const content = declaration.getText();
      const name =
        declaration.getName() ??
        path.basename(candidate.file, path.extname(candidate.file));

      return {
        content,
        metadata: metadataForNode(candidate, sourceFile, declaration, {
          chunkType: "system",
          name,
          exportedName: name,
          content,
        }),
      };
    });
}

function diagnosticChunks(
  candidate: CandidateSource,
  text: string,
): readonly RawReferenceChunk[] {
  const diagnostics = extractDiagnosticCodes(text);

  if (diagnostics.length === 0) {
    return [];
  }

  return diagnostics.map((code) => {
    const line = lineForOffset(text, text.indexOf(code));

    return {
      content: snippetAround(text, code, 900),
      metadata: baseMetadata(candidate, {
        chunkType: "diagnostic",
        name: code,
        startLine: line,
        endLine: line,
        diagnostics: [code],
        exports: [],
        semanticLabels: ["diagnostic", ...labelWords(code)],
      }),
    };
  });
}

function wholeFileChunk(
  candidate: CandidateSource,
  text: string,
): RawReferenceChunk {
  const content =
    Buffer.byteLength(text, "utf8") <= MAX_WHOLE_FILE_CHUNK_BYTES
      ? text
      : text.slice(0, MAX_WHOLE_FILE_CHUNK_BYTES);
  const chunkType: ApertureReferenceChunkType =
    candidate.sourceCategory === "example"
      ? "example"
      : candidate.sourceCategory === "template"
        ? "template"
        : candidate.sourceCategory === "docs"
          ? "doc-section"
          : "source";

  return {
    content,
    metadata: baseMetadata(candidate, {
      chunkType,
      name: path.basename(candidate.file),
      startLine: 1,
      endLine: content.split(/\r?\n/u).length,
      componentIds: extractComponentIds(text),
      systemNames: extractSystemNames(text, candidate.file),
      diagnostics: extractDiagnosticCodes(text),
      exports: extractExportNames(text),
      calls: extractCalls(text),
      semanticLabels: [
        candidate.sourceCategory,
        chunkType,
        ...labelWords(candidate.file),
      ],
    }),
  };
}

function metadataForNode(
  candidate: CandidateSource,
  sourceFile: SourceFile,
  node: MorphNode,
  input: {
    readonly chunkType: ApertureReferenceChunkType;
    readonly name: string;
    readonly exportedName: string;
    readonly content: string;
  },
): Omit<ApertureReferenceChunkMetadata, "semanticLabels"> & {
  readonly semanticLabels?: readonly string[];
} {
  const componentIds = extractComponentIds(input.content);
  const systemNames =
    input.chunkType === "system"
      ? uniqueSorted([
          input.name,
          ...extractSystemNames(input.content, candidate.file),
        ])
      : extractSystemNames(input.content, candidate.file);
  const diagnostics = extractDiagnosticCodes(input.content);
  const classContext = nearestClassName(node);
  const extendsValues = Node.isClassDeclaration(node)
    ? classExtends(node)
    : extractExtends(input.content);
  const implementsValues = Node.isClassDeclaration(node)
    ? classImplements(node)
    : [];
  const systemPriority = extractSystemPriority(input.content);

  return baseMetadata(candidate, {
    chunkType: input.chunkType,
    name: input.name,
    exportedName: input.exportedName,
    startLine: node.getStartLineNumber(),
    endLine: node.getEndLineNumber(),
    ...(classContext === undefined ? {} : { classContext }),
    imports: sourceFile
      .getImportDeclarations()
      .flatMap((importDeclaration) => [
        importDeclaration.getModuleSpecifierValue(),
        ...importDeclaration
          .getNamedImports()
          .map((namedImport) => namedImport.getName()),
      ]),
    exports: [input.exportedName],
    calls: extractCalls(input.content),
    extends: extendsValues,
    implements: implementsValues,
    usesTypes: extractTypeLikeNames(input.content),
    componentIds,
    systemNames,
    ...(systemPriority === undefined ? {} : { systemPriority }),
    diagnostics,
    semanticLabels: uniqueSorted([
      candidate.sourceCategory,
      input.chunkType,
      input.name,
      input.exportedName,
      ...componentIds,
      ...systemNames,
      ...diagnostics,
      ...labelWords(candidate.file),
    ]),
  });
}

function baseMetadata(
  candidate: CandidateSource,
  input: {
    readonly chunkType: ApertureReferenceChunkType;
    readonly name: string;
    readonly exportedName?: string;
    readonly startLine: number;
    readonly endLine: number;
    readonly classContext?: string;
    readonly imports?: readonly string[];
    readonly exports?: readonly string[];
    readonly calls?: readonly string[];
    readonly extends?: readonly string[];
    readonly implements?: readonly string[];
    readonly usesTypes?: readonly string[];
    readonly componentIds?: readonly string[];
    readonly systemNames?: readonly string[];
    readonly systemPriority?: number;
    readonly diagnostics?: readonly string[];
    readonly semanticLabels?: readonly string[];
  },
): Omit<ApertureReferenceChunkMetadata, "semanticLabels"> & {
  readonly semanticLabels?: readonly string[];
} {
  return {
    sourceCategory:
      input.chunkType === "diagnostic"
        ? "diagnostic"
        : candidate.sourceCategory,
    ...(candidate.packageName === undefined
      ? {}
      : { packageName: candidate.packageName }),
    ...(candidate.entrypoint === undefined
      ? {}
      : { entrypoint: candidate.entrypoint }),
    file: candidate.file,
    chunkType: input.chunkType,
    name: input.name,
    ...(input.exportedName === undefined
      ? {}
      : { exportedName: input.exportedName }),
    startLine: input.startLine,
    endLine: input.endLine,
    ...(input.classContext === undefined
      ? {}
      : { classContext: input.classContext }),
    imports: uniqueSorted(input.imports ?? []),
    exports: uniqueSorted(input.exports ?? []),
    calls: uniqueSorted(input.calls ?? []),
    extends: uniqueSorted(input.extends ?? []),
    implements: uniqueSorted(input.implements ?? []),
    usesTypes: uniqueSorted(input.usesTypes ?? []),
    componentIds: uniqueSorted(input.componentIds ?? []),
    systemNames: uniqueSorted(input.systemNames ?? []),
    ...(input.systemPriority === undefined
      ? {}
      : { systemPriority: input.systemPriority }),
    diagnostics: uniqueSorted(input.diagnostics ?? []),
    ...(input.semanticLabels === undefined
      ? {}
      : { semanticLabels: uniqueSorted(input.semanticLabels) }),
  };
}

function chunkTypeForDeclaration(
  candidate: CandidateSource,
  declaration: MorphNode,
  content: string,
): ApertureReferenceChunkType {
  if (extractDiagnosticCodes(content).length > 0) {
    return "diagnostic";
  }

  if (extractComponentIds(content).length > 0) {
    return "component";
  }

  if (
    candidate.file.endsWith(".system.ts") ||
    content.includes("createSystem(") ||
    (Node.isClassDeclaration(declaration) &&
      declaration.getName()?.endsWith("System") === true)
  ) {
    return "system";
  }

  if (Node.isClassDeclaration(declaration)) {
    return "class";
  }

  if (Node.isFunctionDeclaration(declaration)) {
    return "function";
  }

  if (Node.isInterfaceDeclaration(declaration)) {
    return "interface";
  }

  if (Node.isTypeAliasDeclaration(declaration)) {
    return "type";
  }

  if (Node.isEnumDeclaration(declaration)) {
    return "enum";
  }

  if (Node.isVariableDeclaration(declaration)) {
    return "variable";
  }

  return "source";
}

function declarationName(declaration: MorphNode, exportedName: string): string {
  if (
    Node.isClassDeclaration(declaration) ||
    Node.isFunctionDeclaration(declaration) ||
    Node.isInterfaceDeclaration(declaration) ||
    Node.isTypeAliasDeclaration(declaration) ||
    Node.isEnumDeclaration(declaration) ||
    Node.isVariableDeclaration(declaration)
  ) {
    return declaration.getName() ?? exportedName;
  }

  return exportedName;
}

function nearestClassName(node: MorphNode): string | undefined {
  const parentClass = node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);

  if (parentClass !== undefined && Node.isClassDeclaration(parentClass)) {
    return parentClass.getName();
  }

  return undefined;
}

function classExtends(declaration: ClassDeclaration): readonly string[] {
  const extendsExpression = declaration.getExtends();

  return extendsExpression === undefined ? [] : [extendsExpression.getText()];
}

function classImplements(declaration: ClassDeclaration): readonly string[] {
  return declaration.getImplements().map((expression) => expression.getText());
}

function dedupeChunks(
  chunks: readonly RawReferenceChunk[],
): readonly RawReferenceChunk[] {
  const seen = new Set<string>();
  const deduped: RawReferenceChunk[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.metadata.file}:${chunk.metadata.startLine}:${chunk.metadata.endLine}:${chunk.metadata.name}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(chunk);
  }

  return deduped;
}

function isTypeScriptLike(file: string): boolean {
  return [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"].includes(
    path.extname(file),
  );
}

function isGeneratedSystemFile(file: string): boolean {
  return file.endsWith(".system.ts") || file.includes("/systems/");
}

function extractComponentIds(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bid\s*:\s*["'`]([^"'`]+)["'`]/gu,
    /\bcreateComponent\s*\(\s*["'`]([^"'`]+)["'`]/gu,
    /\bdefineComponent\s*\(\s*["'`]([^"'`]+)["'`]/gu,
  ]).filter((value) => value.includes("."));
}

function extractSystemNames(text: string, file: string): readonly string[] {
  const systems = uniqueMatches(text, [
    /\bclass\s+([A-Za-z_$][\w$]*System)\b/gu,
    /\bexport\s+default\s+class\s+([A-Za-z_$][\w$]*)\b/gu,
  ]);

  if (file.endsWith(".system.ts") && systems.length === 0) {
    return [path.basename(file, ".system.ts")];
  }

  return systems;
}

function extractDiagnosticCodes(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bcode\s*:\s*["'`]([^"'`]+)["'`]/gu,
    /\bdiagnostic\.code\s*===\s*["'`]([^"'`]+)["'`]/gu,
  ]).filter((value) => value.includes("."));
}

function extractExportNames(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bexport\s+(?:async\s+)?(?:function|class|interface|type|const|let|var|enum)\s+([A-Za-z_$][\w$]*)/gu,
    /\bexport\s*\{\s*([^}]+)\s*\}/gu,
  ]).flatMap((match) =>
    match.includes(",")
      ? match
          .split(",")
          .map((part) => part.trim().split(/\s+as\s+/u)[0] ?? "")
          .filter((part) => part.length > 0)
      : [match],
  );
}

function extractCalls(text: string): readonly string[] {
  return uniqueMatches(text, [/\b([A-Za-z_$][\w$]*)\s*\(/gu]).filter(
    (value) =>
      !["catch", "for", "function", "if", "return", "switch", "while"].includes(
        value,
      ),
  );
}

function extractExtends(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\bextends\s+([A-Za-z_$][\w$]*(?:\([^)]*\))?)/gu,
  ]);
}

function extractSystemPriority(text: string): number | undefined {
  const match = /\bpriority\s*:\s*(-?\d+(?:\.\d+)?)/u.exec(text);

  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function extractTypeLikeNames(text: string): readonly string[] {
  return uniqueMatches(text, [
    /\btype\s+([A-Za-z_$][\w$]*)/gu,
    /\binterface\s+([A-Za-z_$][\w$]*)/gu,
    /\bimplements\s+([A-Za-z_$][\w$]*)/gu,
    /\bextends\s+([A-Za-z_$][\w$]*)/gu,
  ]);
}

function uniqueMatches(text: string, patterns: readonly RegExp[]): string[] {
  const values = new Set<string>();

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const value = match[1]?.trim();

      if (value !== undefined && value.length > 0) {
        values.add(value);
      }
    }
  }

  return uniqueSorted([...values]);
}

function labelWords(value: string): readonly string[] {
  return tokenizeReferenceText(value).filter((token) => token.length > 2);
}

function snippetAround(text: string, query: string, radius: number): string {
  const index = Math.max(0, text.indexOf(query));
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + query.length + radius);

  return text.slice(start, end);
}

function lineForOffset(text: string, offset: number): number {
  if (offset <= 0) {
    return 1;
  }

  return text.slice(0, offset).split(/\r?\n/u).length;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort((a, b) =>
    a.localeCompare(b),
  );
}
