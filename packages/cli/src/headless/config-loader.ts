import path from "node:path";
import { stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  createApertureSystemManifest,
  type ApertureVitePluginDiagnostic,
} from "@aperture-engine/vite-plugin";
import type { ApertureConfig } from "@aperture-engine/app/config";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";
import { ApertureCliError } from "../errors.js";

export interface LoadApertureHeadlessAppOptions {
  /** Absolute or cwd-relative path to a `mode: "headless"` aperture config. */
  readonly configFile: string;
  /** App root the system globs resolve against. Defaults to the config dir. */
  readonly root?: string;
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
 * pure Node via native TypeScript import (type stripping). Because this is a
 * normal Node import, the config and systems resolve `@aperture-engine/*` to the
 * same module instances the CLI already holds — one ECS registration, no
 * separate module realm. Headless configs and systems must therefore be
 * erasable TypeScript (no enums/decorators/namespaces/parameter-properties).
 */
export async function loadApertureHeadlessApp(
  options: LoadApertureHeadlessAppOptions,
): Promise<LoadedApertureHeadlessApp> {
  const configFile = path.resolve(options.configFile);
  const root = options.root ?? path.dirname(configFile);

  await assertConfigFileExists(configFile);

  const configModule = await importModule(configFile, "config");
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
      // import a module that lacks a default export.
      continue;
    }

    const moduleRecord = await importModule(
      path.resolve(root, discovered.file),
      "system",
    );
    systems.push(moduleRecord as ApertureSystemModule);
  }

  return {
    config,
    systems,
    diagnostics: manifest.diagnostics,
    configFile,
    root,
  };
}

async function importModule(
  absolutePath: string,
  kind: "config" | "system",
): Promise<Record<string, unknown>> {
  try {
    return (await import(pathToFileURL(absolutePath).href)) as Record<
      string,
      unknown
    >;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    throw new ApertureCliError(
      "aperture.headless.configLoadFailed",
      `Failed to load ${kind} module '${absolutePath}': ${message}. ` +
        "Ensure @aperture-engine/* resolves from the app and that the file is erasable TypeScript (no enums/decorators/namespaces/parameter-properties).",
    );
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
