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
  createApertureGeneratedActionTypes,
  writeApertureGeneratedActionTypes,
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
}

export interface ApertureVitePluginAiOptions {
  readonly mode?: "agent" | "off";
}

export interface ApertureVitePlugin {
  readonly name: string;
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

  const plugin: ApertureVitePlugin = {
    name: "aperture",
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
