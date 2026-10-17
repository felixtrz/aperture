import type { ShaderArtifact } from "./artifact.js";
import type { CompileShaderOptions } from "./compiler-core.js";
export type { CompileShaderOptions } from "./compiler-core.js";

/** Explicit setup-time compilation of dynamic WGSL, in browsers or Node.
 * No files, URLs, or modules are fetched. Reflection is loaded only on invocation;
 * ordinary artifact consumption has no compiler dependency. */
export async function prepareShader(
  options: CompileShaderOptions,
): Promise<ShaderArtifact> {
  const { compileShaderCore } = await import("./compiler-core.js");
  // Retain each hash preimage until Web Crypto completes; none leave this call.
  const draft = compileShaderCore(options, (source) => source);
  const digest = async (source: string): Promise<string> => {
    const bytes = new TextEncoder().encode(source);
    const hash = new Uint8Array(
      await globalThis.crypto.subtle.digest("SHA-256", bytes),
    );
    return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  };
  const [hash, layoutHash, dependencies] = await Promise.all([
    digest(draft.hash),
    digest(draft.layoutHash),
    Promise.all(
      draft.dependencies.map(async (dependency) => ({
        file: dependency.file,
        hash: await digest(dependency.hash),
      })),
    ),
  ]);
  return { ...draft, hash, layoutHash, dependencies };
}
