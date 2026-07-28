import { createRequire } from "node:module";
import path from "node:path";

import {
  registerApertureViteDevtoolsBridge,
  scheduleApertureViteSessionWrite,
  type ApertureViteDevServer,
} from "./dev-session.js";
export {
  APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
  type ApertureViteDevServer,
} from "./dev-session.js";
import { resolveConfigFile } from "./file-utils.js";
import { writeApertureGeneratedActionTypes } from "./generated-action-types.js";
export {
  apertureGeneratedTypeEntriesFromConfig,
  createApertureGeneratedActionTypes,
  renderApertureGeneratedTypes,
  writeApertureGeneratedActionTypes,
  type ApertureGeneratedTypeEntries,
} from "./generated-action-types.js";
export {
  createApertureSystemManifest,
  type ApertureSystemManifest,
  type ApertureVitePluginDiagnostic,
  type DiscoveredApertureSystem,
} from "./system-discovery.js";
import {
  injectApertureBrowserEntry,
  loadApertureVirtualModule,
  resolveApertureVirtualId,
} from "./virtual-modules.js";
import { installApertureSystemGraphHmr } from "./system-graph-hmr.js";

export interface ApertureVitePluginOptions {
  readonly configFile?: string;
  readonly ai?: ApertureVitePluginAiOptions;
  /**
   * Emit the COOP/COEP response headers that make the page cross-origin
   * isolated. Aperture's worker transport relies on `SharedArrayBuffer`, which
   * the browser only exposes when the document is cross-origin isolated, so
   * this defaults to `true`. Set it to `false` only if you supply the headers
   * yourself (for example via a hosting `_headers` file or another plugin).
   */
  readonly crossOriginIsolation?: boolean;
}

/**
 * Response headers required for `crossOriginIsolated === true`, which in turn
 * unlocks `SharedArrayBuffer` for the worker/main-thread snapshot transport.
 */
export const APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS: Readonly<
  Record<string, string>
> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export interface ApertureVitePluginAiOptions {
  readonly mode?: "agent" | "off";
}

export interface ApertureVitePlugin {
  readonly name: string;
  config?(config?: { readonly root?: string }): {
    readonly server?: { readonly headers?: Record<string, string> };
    readonly preview?: { readonly headers?: Record<string, string> };
    readonly worker?: { readonly format?: "es" | "iife" };
    readonly optimizeDeps?: {
      readonly include?: readonly string[];
    };
  } | void;
  configResolved?(config: {
    readonly root: string;
    readonly command?: "serve" | "build";
    readonly server?: {
      readonly host?: string | boolean;
      readonly port?: number;
    };
  }): void;
  configureServer?(server: ApertureViteDevServer): void | Promise<void>;
  resolveId?(id: string): string | null;
  load?(id: string): Promise<string | null> | string | null;
  transformIndexHtml?:
    | ((html: string) => string)
    | {
        readonly order: "pre";
        handler(html: string): string;
      };
}

export function aperture(
  options: ApertureVitePluginOptions = {},
): ApertureVitePlugin {
  let root = process.cwd();
  let command: "serve" | "build" = "serve";
  let configuredServer:
    | {
        readonly host?: string | boolean;
        readonly port?: number;
      }
    | undefined;
  const aiDevtoolsEnabled = options.ai?.mode !== "off";
  const crossOriginIsolation = options.crossOriginIsolation !== false;

  const plugin: ApertureVitePlugin = {
    name: "aperture",
    config(config = {}) {
      const installedEngineEntries = resolveInstalledEngineEntries(
        path.resolve(config.root ?? root),
      );
      const base = {
        // Generated apps bundle an ES-module simulation worker that imports the
        // (code-split) @aperture-engine/app worker entry. Pin the worker format
        // to ES so `vite build` never falls back to IIFE, which Rollup rejects
        // for code-splitting builds (see GH #24).
        worker: { format: "es" as const },
        // Pre-bundle the generated app entry points plus engine packages the
        // consumer installed directly. This prevents a first-run discovery
        // reload (GH #31) and lets esbuild share module singletons between app
        // subpaths and direct user imports, without requiring transitive engine
        // packages that pnpm intentionally keeps out of the app root.
        optimizeDeps: {
          include: [
            "@aperture-engine/app/config",
            "@aperture-engine/app/systems",
            "@aperture-engine/app/browser",
            "@aperture-engine/app/worker",
            ...installedEngineEntries,
          ],
        },
      };

      if (!crossOriginIsolation) {
        return base;
      }

      const headers = { ...APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS };
      return {
        ...base,
        server: { headers },
        preview: { headers: { ...headers } },
      };
    },
    configResolved(config) {
      root = config.root;
      command = config.command ?? command;
      configuredServer = config.server;
      void writeApertureGeneratedActionTypes({
        root,
        configFile: resolveConfigFile(root, options.configFile),
      });
    },
    configureServer(server) {
      if (command === "build") {
        return;
      }

      installApertureSystemGraphHmr(server, {
        root: server.config.root,
        ...(options.configFile === undefined
          ? {}
          : { configFile: options.configFile }),
      });

      if (!aiDevtoolsEnabled) {
        return;
      }

      registerApertureViteDevtoolsBridge(server);
      scheduleApertureViteSessionWrite({
        root: server.config.root,
        server: server.httpServer ?? null,
        configured: server.config.server ?? configuredServer,
      });
    },
    resolveId(id) {
      return resolveApertureVirtualId(id);
    },
    async load(id) {
      return loadApertureVirtualModule(id, {
        root,
        ...(options.configFile === undefined
          ? {}
          : { configFile: options.configFile }),
        aiDevtoolsEnabled: options.ai?.mode !== "off",
      });
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return injectApertureBrowserEntry(html);
      },
    },
  };

  return plugin;
}

const APERTURE_ENGINE_DEPENDENCY_ENTRIES = [
  "@aperture-engine/audio",
  "@aperture-engine/math",
  "@aperture-engine/particles",
  "@aperture-engine/physics",
  "@aperture-engine/physics-rapier",
  "@aperture-engine/render",
  "@aperture-engine/runtime",
  "@aperture-engine/simulation",
  "@aperture-engine/webgpu",
] as const;

function resolveInstalledEngineEntries(root: string): readonly string[] {
  const require = createRequire(path.join(root, "package.json"));
  return APERTURE_ENGINE_DEPENDENCY_ENTRIES.filter((entry) => {
    try {
      require.resolve(`${entry}/package.json`);
      return true;
    } catch {
      return false;
    }
  });
}
