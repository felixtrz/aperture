import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ShaderArtifact } from "./artifact.js";
import {
  compileShaderCore,
  normalizeShaderPath as normalize,
  shaderImports,
  resolveShaderImport,
  type CompileShaderOptions,
} from "./compiler-core.js";
export {
  shaderImports,
  resolveShaderImport,
  generateShaderTypes,
  type CompileShaderOptions,
} from "./compiler-core.js";

/** Explicit Node/build-time compiler entry; never imported by the runtime. */
export function compileShader(options: CompileShaderOptions): ShaderArtifact {
  return compileShaderCore(options, (text) =>
    createHash("sha256").update(text).digest("hex"),
  );
}

export async function compileShaderFile(
  filename: string,
): Promise<ShaderArtifact> {
  const entry = normalize(path.resolve(filename));
  const sources: Record<string, string> = {};
  async function load(file: string): Promise<void> {
    if (file in sources) return;
    const source = await readFile(file, "utf8");
    sources[file] = source;
    await Promise.all(
      shaderImports(source).map((item) =>
        load(resolveShaderImport(file, item.specifier)),
      ),
    );
  }
  await load(entry);
  // Artifacts use paths relative to the entry directory, independent of checkout.
  const base = path.posix.dirname(entry);
  return compileShader({
    entry: path.posix.basename(entry),
    modules: Object.fromEntries(
      Object.entries(sources).map(([file, source]) => [
        path.posix.relative(base, file),
        source,
      ]),
    ),
  });
}
