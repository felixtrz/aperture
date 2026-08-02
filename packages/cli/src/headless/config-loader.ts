import path from "node:path";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, normalizePath, type ViteDevServer } from "vite";
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
 * through a short-lived Vite SSR module graph. App-local dependencies are
 * transformed and evaluated afresh on every call, while engine packages remain
 * external Node imports shared with the CLI. This is important for long-lived
 * MCP hosts: app_stop/app_start must observe edits to shared config, component,
 * resource, and system modules without restarting the MCP process.
 */
export async function loadApertureHeadlessApp(
  options: LoadApertureHeadlessAppOptions,
): Promise<LoadedApertureHeadlessApp> {
  const configFile = path.resolve(options.configFile);
  const root = options.root ?? path.dirname(configFile);

  await assertConfigFileExists(configFile);

  const moduleServer = await createHeadlessModuleServer(root);
  try {
    const configModule = await importModule(moduleServer, configFile, "config");
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
        moduleServer,
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
  } finally {
    await moduleServer.close();
  }
}

async function createHeadlessModuleServer(
  root: string,
): Promise<ViteDevServer> {
  const cliResolutionAnchor = fileURLToPath(import.meta.url);

  return createServer({
    root,
    configFile: false,
    appType: "custom",
    logLevel: "silent",
    plugins: [
      {
        name: "aperture-headless-engine-resolution",
        enforce: "pre",
        async resolveId(source, importer) {
          if (!source.startsWith("@aperture-engine/")) {
            return null;
          }

          const appResolution =
            importer === undefined
              ? null
              : await this.resolve(source, importer, { skipSelf: true });
          if (appResolution !== null) {
            return appResolution;
          }

          // Fixture apps and intentionally minimal repro projects may not have
          // their own node_modules tree. Resolve engine packages through the
          // CLI installation in that case, matching the shared-runtime model
          // used by the headless runner.
          return this.resolve(source, cliResolutionAnchor, { skipSelf: true });
        },
      },
    ],
    server: { middlewareMode: true },
  });
}

async function importModule(
  server: ViteDevServer,
  absolutePath: string,
  kind: "config" | "system",
): Promise<Record<string, unknown>> {
  try {
    return (await server.ssrLoadModule(
      `/@fs/${normalizePath(absolutePath)}`,
    )) as Record<string, unknown>;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    // A browser config typically reads `import.meta.env.BASE_URL`, which only
    // exists in a Vite build — in Node the access throws before the mode
    // check can run. Name the real mistake instead of the symptom (#74).
    if (kind === "config" && /BASE_URL|import\.meta\.env/u.test(message)) {
      throw new ApertureCliError(
        "aperture.headless.invalidMode",
        `Config '${absolutePath}' reads import.meta.env, which only exists in a Vite browser build — this looks like the browser config (aperture.config.ts). ` +
          `The aperture headless command expects a config with mode: "headless" (typically aperture.headless.config.ts). (${message})`,
      );
    }

    throw new ApertureCliError(
      "aperture.headless.configLoadFailed",
      `Failed to load ${kind} module '${absolutePath}': ${message}. ` +
        "Ensure @aperture-engine/* resolves from the app and that the module is valid TypeScript.",
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
