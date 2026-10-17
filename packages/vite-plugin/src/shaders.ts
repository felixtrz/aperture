import path from "node:path";
import type { ApertureVitePlugin } from "./index.js";

/** Shader-only Vite integration; no ECS config, generated worker, or app entry. */
export function apertureShaders(): Pick<
  ApertureVitePlugin,
  "name" | "load" | "handleHotUpdate"
> {
  const loader = createShaderModuleLoader();
  return {
    name: "aperture:shaders",
    load(id) {
      const context = this as
        | { addWatchFile?: (file: string) => void }
        | undefined;
      return loader.load(id, context?.addWatchFile?.bind(context));
    },
    async handleHotUpdate(context) {
      const modules = [...context.modules];
      for (const id of loader.affected(context.file)) {
        const module = context.server?.moduleGraph.getModuleById(id);
        if (module !== undefined) {
          context.server!.moduleGraph.invalidateModule(module);
          if (!modules.includes(module)) modules.push(module);
        }
      }
      return modules;
    },
  };
}

export interface ShaderModuleLoader {
  load(id: string, watch?: (file: string) => void): Promise<string | null>;
  affected(file: string): readonly string[];
}

/** Opt in with `import shader from './effect.wgsl?aperture'`. Raw imports retain
 * Vite's normal behavior. The compiler executes only in the build/dev process. */
export function createShaderModuleLoader(): ShaderModuleLoader {
  const dependencies = new Map<string, Set<string>>();
  return {
    async load(id, watch) {
      if (!id.endsWith(".wgsl?aperture")) return null;
      const filename = id.slice(0, -"?aperture".length);
      const { compileShaderFile } =
        await import("@aperture-engine/shader/compiler");
      const artifact = await compileShaderFile(filename);
      const files = new Set(
        artifact.dependencies.map((dependency) =>
          path.resolve(path.dirname(filename), dependency.file),
        ),
      );
      for (const file of files) watch?.(file);
      dependencies.set(id, files);
      return `export default ${JSON.stringify(artifact)};\n`;
    },
    affected(file) {
      return [...dependencies]
        .filter(([, files]) => files.has(path.resolve(file)))
        .map(([id]) => id);
    },
  };
}
