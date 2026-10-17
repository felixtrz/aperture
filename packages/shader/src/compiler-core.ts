import {
  WgslParser,
  WgslReflect,
  WgslScanner,
} from "wgsl_reflect/wgsl_reflect.module.js";
import type { VariableInfo, TemplateInfo } from "wgsl_reflect";
import {
  ShaderError,
  type ShaderArtifact,
  type ShaderBinding,
  type ShaderSourceLocation,
  type ShaderStage,
} from "./artifact.js";
import {
  minimumBufferSize,
  reflectBufferLayout,
  validateBufferLayout,
} from "./compiler-layout.js";
import { shaderValueType } from "./packing.js";

export interface CompileShaderOptions {
  readonly entry: string;
  readonly modules: Readonly<Record<string, string>>;
  readonly requiredFeatures?: readonly string[];
}

export function normalizeShaderPath(file: string): string {
  const path = file.replaceAll("\\", "/");
  const absolute = path.startsWith("/");
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === ".." && segments.length > 0 && segments.at(-1) !== "..")
      segments.pop();
    else if (segment !== ".." || !absolute) segments.push(segment);
  }
  return `${absolute ? "/" : ""}${segments.join("/")}` || ".";
}
const normalize = normalizeShaderPath;

/** Module directive: // @import "./library.wgsl". Libraries share WGSL's global
 * namespace and may declare functions, structs and constants, but no bindings.
 * Syntax/reflection are build-time checks; actual device compilation is required. */
export function compileShaderCore(
  options: CompileShaderOptions,
  hash: (source: string) => string,
): ShaderArtifact {
  const modules = new Map(
    Object.entries(options.modules).map(([file, source]) => [
      normalize(file),
      source,
    ]),
  );
  const entry = normalize(options.entry);
  const active: string[] = [],
    visited = new Set<string>();
  const lines: string[] = [],
    sourceMap: ShaderSourceLocation[] = [],
    dependencies: { file: string; hash: string }[] = [];
  function fail(
    code: string,
    message: string,
    location?: ShaderSourceLocation,
  ): never {
    throw new ShaderError([
      {
        severity: "error",
        code: `aperture.shader.${code}`,
        message,
        ...(location === undefined ? {} : { location }),
      },
    ]);
  }
  function visit(file: string): void {
    if (active.includes(file))
      fail(
        "moduleCycle",
        `WGSL import cycle: ${[...active, file].join(" -> ")}`,
      );
    if (visited.has(file)) return;
    const source = modules.get(file);
    if (source === undefined)
      fail("moduleMissing", `WGSL module '${file}' was not supplied.`);
    active.push(file);
    const imports = shaderImports(source);
    for (const imported of imports)
      visit(resolveShaderImport(file, imported.specifier));
    for (const [index, line] of source.split(/\r?\n/u).entries()) {
      lines.push(imports.some((item) => item.line === index + 1) ? "" : line);
      sourceMap.push({ file, line: index + 1 });
    }
    dependencies.push({ file, hash: hash(source) });
    active.pop();
    visited.add(file);
  }
  visit(entry);
  // WGSL module directives must precede declarations. Imports are emitted
  // dependency-first, so hoist parser-tokenized directives while retaining each
  // source line (including declarations sharing a directive's line).
  let code = lines.join("\n");
  if (dependencies.length > 1) {
    const tokens = new WgslScanner(code).scanTokens();
    const directives: { text: string; location: ShaderSourceLocation }[] = [];
    const removals: { start: number; end: number }[] = [];
    let depth = 0;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]!;
      if (
        depth === 0 &&
        ["enable", "requires", "diagnostic"].includes(token.lexeme)
      ) {
        let end = index;
        while (end < tokens.length && tokens[end]!.lexeme !== ";") end++;
        if (end >= tokens.length) break; // Parser reports the authored error below.
        const final = tokens[end]!;
        directives.push({
          text: tokens
            .slice(index, end + 1)
            .map((item) => item.lexeme)
            .join(" "),
          location: sourceMap[token.line - 1]!,
        });
        removals.push({ start: token.start, end: final.end });
        index = end;
      } else if (token.lexeme === "{") depth++;
      else if (token.lexeme === "}") depth--;
    }
    if (directives.length > 0) {
      for (const removal of removals.reverse())
        code =
          code.slice(0, removal.start) +
          code.slice(removal.start, removal.end).replace(/[^\n]/gu, " ") +
          code.slice(removal.end);
      code =
        directives.map((directive) => directive.text).join("\n") + "\n" + code;
      sourceMap.unshift(...directives.map((directive) => directive.location));
    }
  }
  let reflection: InstanceType<typeof WgslReflect>;
  const features = new Set(options.requiredFeatures ?? []);
  try {
    const ast = new WgslParser().parse(code);
    const names = new Set<string>();
    for (const node of ast) {
      const declaration = node as typeof node & {
        name?: string;
        attributes?: { name: string }[] | null;
      };
      const location = sourceMap[node.line - 1];
      if (node.astNodeType === "enable") {
        if (declaration.name === "f16") features.add("shader-f16");
        if (declaration.name === "subgroups") features.add("subgroups");
        continue;
      }
      if (
        ["function", "struct", "alias", "var", "const", "override"].includes(
          node.astNodeType,
        ) &&
        declaration.name !== undefined
      ) {
        if (names.has(declaration.name))
          fail(
            "duplicateSymbol",
            `Duplicate WGSL symbol '${declaration.name}'. Imports share the module namespace.`,
            location,
          );
        names.add(declaration.name);
      }
      if (
        location?.file !== entry &&
        declaration.attributes?.some(
          (attribute) =>
            attribute.name === "binding" || attribute.name === "group",
        )
      )
        fail(
          "libraryBinding",
          "Resource bindings must be declared by the entry module, not an imported library.",
          location,
        );
    }
    reflection = new WgslReflect(code);
  } catch (error) {
    if (error instanceof ShaderError) throw error;
    const problem = error as { message?: string; token?: { line?: number } };
    const message = problem.message ?? String(error);
    const line =
      problem.token?.line ??
      Number(/(?:line|Line)[: ]+(\d+)/u.exec(message)?.[1] ?? 0);
    fail("parseFailed", message, sourceMap[line - 1]);
  }
  const entries = (["vertex", "fragment", "compute"] as const).flatMap(
    (stage) =>
      reflection.entry[stage].map((fn) => ({
        name: fn.name,
        stage,
        bindings: fn.resources.map((resource) => resource.name).sort(),
        ...(fn.workgroupSize === null
          ? {}
          : { workgroupSize: fn.workgroupSize }),
      })),
  );
  const variables = [
    ...reflection.uniforms,
    ...reflection.storage,
    ...reflection.textures,
    ...reflection.samplers,
  ];
  const occupied = new Set<string>();
  const bindings = variables
    .map((variable): ShaderBinding => {
      const slot = `${variable.group}:${variable.binding}`;
      if (occupied.has(slot))
        fail(
          "duplicateBinding",
          `Multiple resources use @group(${variable.group}) @binding(${variable.binding}).`,
        );
      occupied.add(slot);
      const visibility = [
        ...new Set(
          entries
            .filter((entry) => entry.bindings.includes(variable.name))
            .map((entry) => entry.stage),
        ),
      ];
      try {
        return reflectBinding(variable, visibility);
      } catch (error) {
        return fail(
          "bindingLayout",
          `${variable.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    })
    .sort((a, b) => a.group - b.group || a.binding - b.binding);
  return {
    format: "aperture.shader",
    version: 1,
    compiler: "aperture-wgsl/1:wgsl_reflect/1.6.0",
    entry,
    code,
    hash: hash(code),
    layoutHash: hash(JSON.stringify(bindings)),
    dependencies,
    sourceMap,
    entryPoints: entries,
    overrides: reflection.overrides.map((value) => ({
      name: value.name,
      id: value.id,
      type: value.type?.getTypeName() ?? "inferred",
    })),
    bindings,
    requiredFeatures: [...features].sort(),
  };
}

function reflectBinding(
  variable: VariableInfo,
  visibility: readonly ShaderStage[],
): ShaderBinding {
  const common = {
    name: variable.name,
    group: variable.group,
    binding: variable.binding,
    visibility,
    access:
      variable.access === "read_write"
        ? ("read_write" as const)
        : variable.access === "write"
          ? ("write" as const)
          : ("read" as const),
  };
  if (variable.resourceType === 0 || variable.resourceType === 1) {
    const uniform = variable.resourceType === 0;
    const layout = reflectBufferLayout(variable.type);
    validateBufferLayout(layout, uniform, variable.name);
    return {
      ...common,
      kind: uniform ? "uniform-buffer" : "storage-buffer",
      layout,
      minBindingSize: minimumBufferSize(layout),
    };
  }
  if (variable.resourceType === 4)
    return {
      ...common,
      kind: "sampler",
      sampler:
        variable.type.name === "sampler_comparison"
          ? "comparison"
          : "filtering",
    };
  if (variable.resourceType === 3 || variable.resourceType === 5) {
    const type = variable.type as TemplateInfo;
    const dimension = type.name
      .replace(/^texture_(storage_|depth_|multisampled_)?/u, "")
      .replaceAll("_", "-") as NonNullable<
      ShaderBinding["texture"]
    >["dimension"];
    if (
      !["1d", "2d", "2d-array", "3d", "cube", "cube-array"].includes(dimension)
    )
      throw new Error(`Unsupported texture type '${type.name}'.`);
    const format = type.format?.name;
    return {
      ...common,
      kind: variable.resourceType === 5 ? "storage-texture" : "texture",
      texture: {
        dimension,
        multisampled: type.name.includes("multisampled"),
        sampleType: type.name.includes("depth")
          ? "depth"
          : format === "i32"
            ? "sint"
            : format === "u32"
              ? "uint"
              : "float",
        ...(variable.resourceType === 5 && format !== undefined
          ? { format }
          : {}),
      },
    };
  }
  throw new Error(`Unsupported resource class '${variable.resourceType}'.`);
}

export function shaderImports(
  source: string,
): readonly { readonly specifier: string; readonly line: number }[] {
  const imports: { specifier: string; line: number }[] = [];
  // The import directive is a preprocessor comment; actual WGSL uses the parser.
  let depth = 0;
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    if (depth === 0) {
      const match = /^\s*\/\/\s*@import\s+"([^"\r\n]+)"\s*;?\s*$/u.exec(line);
      if (match !== null) {
        imports.push({ specifier: match[1]!, line: index + 1 });
        continue;
      }
    }
    for (let i = 0; i < line.length - 1; i++) {
      const token = line.slice(i, i + 2);
      if (depth === 0 && token === "//") break;
      if (token === "/*") {
        depth++;
        i++;
      } else if (depth > 0 && token === "*/") {
        depth--;
        i++;
      }
    }
  }
  return imports;
}

export function resolveShaderImport(from: string, specifier: string): string {
  if (!specifier.startsWith("./") && !specifier.startsWith("../"))
    throw new ShaderError([
      {
        severity: "error",
        code: "aperture.shader.importPath",
        message: `WGSL imports must be relative file paths: '${specifier}'.`,
      },
    ]);
  const file = normalize(from);
  return normalize(`${file.slice(0, file.lastIndexOf("/") + 1)}${specifier}`);
}

export function generateShaderTypes(artifact: ShaderArtifact): string {
  return `// Generated by ${artifact.compiler}; source hash ${artifact.hash}\nexport interface ShaderParameters {\n${artifact.bindings
    .filter((binding) => binding.layout !== undefined)
    .map(
      (binding) =>
        `  readonly ${JSON.stringify(binding.name)}: ${shaderValueType(binding.layout!)};`,
    )
    .join("\n")}\n}\n`;
}
