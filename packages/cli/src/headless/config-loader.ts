import path from "node:path";
import { stat } from "node:fs/promises";
import {
  createApertureSystemManifest,
  type ApertureVitePluginDiagnostic,
} from "@aperture-engine/vite-plugin";
import type { ApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import type { Alias } from "vite";
import { ApertureCliError } from "../errors.js";
import { createHeadlessViteRuntime } from "./vite-runtime.js";

export interface LoadApertureHeadlessAppOptions {
  /** Absolute or cwd-relative path to a `mode: "headless"` aperture config. */
  readonly configFile: string;
  /** App root the system globs resolve against. Defaults to the config dir. */
  readonly root?: string;
  /** Vite resolve aliases (e.g. to run against unbuilt in-repo source). */
  readonly aliases?: readonly Alias[];
}

export interface LoadedApertureHeadlessApp {
  readonly config: ApertureConfig;
  readonly systems: readonly ApertureSystemModule[];
  readonly diagnostics: readonly ApertureVitePluginDiagnostic[];
  readonly configFile: string;
  readonly root: string;
}

/**
 * Load a headless aperture config and its discovered `*.system.ts` modules in
 * pure Node via an in-process Vite SSR runner. The dev server is torn down
 * before returning — the loaded config and system classes are live JS values
 * that outlive it.
 */
export async function loadApertureHeadlessApp(
  options: LoadApertureHeadlessAppOptions,
): Promise<LoadedApertureHeadlessApp> {
  const configFile = path.resolve(options.configFile);
  const root = options.root ?? path.dirname(configFile);

  await assertConfigFileExists(configFile);

  const runtime = await createHeadlessViteRuntime({
    root,
    ...(options.aliases === undefined ? {} : { aliases: options.aliases }),
  });

  try {
    const configModule = await runtime.importModule(configFile);
    const config = configModule["default"] as ApertureConfig | undefined;

    if (config === undefined) {
      throw new ApertureCliError(
        "aperture.headless.invalidConfig",
        `Headless config '${configFile}' must default-export a defineApertureConfig() result.`,
      );
    }

    if (config.mode !== "headless") {
      throw new ApertureCliError(
        "aperture.headless.invalidMode",
        `Headless config '${configFile}' has mode '${String(
          config.mode,
        )}'. The aperture headless command requires mode: "headless".`,
      );
    }

    const manifest = await createApertureSystemManifest({
      root,
      systemGlobs: config.systems ?? [],
    });

    const systems: ApertureSystemModule[] = [];

    for (const discovered of manifest.systems) {
      if (!discovered.hasDefaultExport) {
        // A diagnostic is already recorded on the manifest; skip rather than
        // import a module the runtime would reject for lacking a default.
        continue;
      }

      const moduleRecord = await runtime.importModule(discovered.file);
      systems.push(moduleRecord as ApertureSystemModule);
    }

    return {
      config,
      systems,
      diagnostics: manifest.diagnostics,
      configFile,
      root,
    };
  } finally {
    await runtime.dispose();
  }
}

async function assertConfigFileExists(configFile: string): Promise<void> {
  try {
    const configStat = await stat(configFile);

    if (configStat.isFile()) {
      return;
    }
  } catch (error: unknown) {
    if (
      !(error instanceof Error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }

  throw new ApertureCliError(
    "aperture.headless.configNotFound",
    `Headless config file '${configFile}' was not found.`,
  );
}
