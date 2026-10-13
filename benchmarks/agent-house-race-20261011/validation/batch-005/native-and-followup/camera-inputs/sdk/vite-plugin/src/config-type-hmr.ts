import path from "node:path";
import { resolveConfigFile } from "./file-utils.js";
import { writeApertureGeneratedActionTypes } from "./generated-action-types.js";

export interface ApertureConfigHmrModule {
  readonly file: string | null;
  readonly importers: ReadonlySet<ApertureConfigHmrModule>;
}

export async function refreshApertureConfigTypesForHotUpdate(options: {
  readonly root: string;
  readonly configFile?: string;
  readonly file: string;
  readonly modules: readonly ApertureConfigHmrModule[];
}): Promise<void> {
  const configFile = resolveConfigFile(options.root, options.configFile);
  const pending = [...options.modules];
  const visited = new Set<ApertureConfigHmrModule>();
  let affectsConfig = path.resolve(options.file) === configFile;

  while (!affectsConfig && pending.length > 0) {
    const module = pending.pop()!;
    if (visited.has(module)) continue;
    visited.add(module);
    affectsConfig =
      module.file !== null && path.resolve(module.file) === configFile;
    pending.push(...module.importers);
  }

  if (affectsConfig) {
    // Vite can soft-invalidate static importers and reuse their transformed
    // output without calling load again. Refresh metadata at the hot-update
    // boundary instead of relying on a virtual config module being reloaded.
    await writeApertureGeneratedActionTypes({ root: options.root, configFile });
  }
}
