import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { resolveConfigFile, toModuleUrl } from "./file-utils.js";
import { writeApertureGeneratedActionTypes } from "./generated-action-types.js";
export {
  createApertureGeneratedActionTypes,
  writeApertureGeneratedActionTypes,
} from "./generated-action-types.js";
import {
  createApertureSystemManifest,
  type ApertureSystemManifest,
} from "./system-discovery.js";
export {
  createApertureSystemManifest,
  type ApertureSystemManifest,
  type ApertureVitePluginDiagnostic,
  type DiscoveredApertureSystem,
} from "./system-discovery.js";

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

export interface ApertureViteDevServer {
  readonly config: {
    readonly root: string;
    readonly server?: {
      readonly host?: string | boolean;
      readonly port?: number;
    };
  };
  readonly httpServer?: {
    address(): string | AddressInfo | null;
    once(event: "listening" | "close", listener: () => void): unknown;
  } | null;
  readonly ws: {
    on?(
      event: typeof APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
      listener: (
        payload: unknown,
        client: {
          send?(event: string, payload: unknown): void;
        },
      ) => void,
    ): void;
    send?(event: string, payload: unknown): void;
  };
}

const VIRTUAL_CONFIG = "virtual:aperture/config";
const VIRTUAL_SYSTEM_MANIFEST = "virtual:aperture/system-manifest";
const VIRTUAL_WORKER_SYSTEMS = "virtual:aperture/worker-systems";
const VIRTUAL_WORKER_ENTRY = "virtual:aperture/worker-entry";
const VIRTUAL_BROWSER_ENTRY = "virtual:aperture/browser-entry";
const RESOLVED_PREFIX = "\0";
export const APERTURE_VITE_DEVTOOLS_WS_CHANNEL = "aperture:devtools";
const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
const APERTURE_RUNTIME_DIRECTORY = ".aperture/runtime";
const APERTURE_SESSION_FILE = "session.json";
const APERTURE_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";
const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";
const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";

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
      if (!aiDevtoolsEnabled || command === "build") {
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
      if (isVirtualId(virtualBaseId(id))) {
        return `${RESOLVED_PREFIX}${id}`;
      }

      return null;
    },
    async load(id) {
      const rawVirtualId = id.startsWith(RESOLVED_PREFIX) ? id.slice(1) : id;
      const virtualId = virtualBaseId(rawVirtualId);
      const configFile = resolveConfigFile(root, options.configFile);
      await writeApertureGeneratedActionTypes({ root, configFile });

      if (virtualId === VIRTUAL_CONFIG) {
        return `export { default } from ${JSON.stringify(toModuleUrl(configFile))};`;
      }

      if (virtualId === VIRTUAL_SYSTEM_MANIFEST) {
        const manifest = await createApertureSystemManifest({
          root,
          configFile,
        });

        return `export default ${JSON.stringify(manifest.systems, null, 2)};\nexport const diagnostics = ${JSON.stringify(manifest.diagnostics, null, 2)};`;
      }

      if (virtualId === VIRTUAL_WORKER_SYSTEMS) {
        const manifest = await createApertureSystemManifest({
          root,
          configFile,
        });

        return workerSystemsModule(manifest);
      }

      if (virtualId === VIRTUAL_WORKER_ENTRY) {
        return [
          `import config from ${JSON.stringify(VIRTUAL_CONFIG)};`,
          `import { systems } from ${JSON.stringify(VIRTUAL_WORKER_SYSTEMS)};`,
          `import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";`,
          `startGeneratedSimulationWorker({ config, systems });`,
          "",
        ].join("\n");
      }

      if (virtualId === VIRTUAL_BROWSER_ENTRY) {
        const workerEntryPath = `/@id/__x00__${VIRTUAL_WORKER_ENTRY}`;
        const aiDevtoolsEnabledInDev = options.ai?.mode !== "off";

        return [
          `import config from ${JSON.stringify(VIRTUAL_CONFIG)};`,
          `import systemManifest from ${JSON.stringify(VIRTUAL_SYSTEM_MANIFEST)};`,
          `import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";`,
          `const worker = new Worker(${JSON.stringify(workerEntryPath)}, { type: "module" });`,
          `const apertureDevtoolsEnabled = ${JSON.stringify(aiDevtoolsEnabledInDev)} && import.meta.env.DEV;`,
          `startGeneratedBrowserApp({`,
          `  config,`,
          `  systemManifest,`,
          `  workerEntry: worker,`,
          `  devtools: { enabled: apertureDevtoolsEnabled },`,
          `});`,
          "",
        ].join("\n");
      }

      return null;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (html.includes(VIRTUAL_BROWSER_ENTRY)) {
          return html;
        }

        const script = `<script type="module">import ${JSON.stringify(VIRTUAL_BROWSER_ENTRY)};</script>`;

        if (html.includes("</body>")) {
          return html.replace("</body>", `  ${script}\n</body>`);
        }

        return `${html}\n${script}\n`;
      },
    },
  };

  return plugin;
}

function registerApertureViteDevtoolsBridge(
  server: ApertureViteDevServer,
): void {
  server.ws.on?.(APERTURE_VITE_DEVTOOLS_WS_CHANNEL, (_payload, client) => {
    client.send?.(APERTURE_VITE_DEVTOOLS_WS_CHANNEL, {
      ok: true,
      protocolVersion: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
      bridge: apertureViteDevtoolsBridgeDescriptor(
        bridgeWebSocketUrl(server.config.server, server.httpServer ?? null),
      ),
    });
  });
}

function scheduleApertureViteSessionWrite(input: {
  readonly root: string;
  readonly server: ApertureViteDevServer["httpServer"] | null;
  readonly configured:
    | {
        readonly host?: string | boolean;
        readonly port?: number;
      }
    | undefined;
}): void {
  const write = (): void => {
    void writeApertureViteDevSession(input);
  };

  if (
    input.server?.address() !== null &&
    input.server?.address() !== undefined
  ) {
    write();
    return;
  }

  input.server?.once("listening", write);
}

async function writeApertureViteDevSession(input: {
  readonly root: string;
  readonly server: ApertureViteDevServer["httpServer"] | null;
  readonly configured:
    | {
        readonly host?: string | boolean;
        readonly port?: number;
      }
    | undefined;
}): Promise<void> {
  const now = new Date().toISOString();
  const endpoint = resolveApertureViteDevEndpoint(
    input.configured,
    input.server,
  );
  const runtimeDir = path.join(input.root, APERTURE_RUNTIME_DIRECTORY);
  const logs = {
    daemon: path.join(runtimeDir, "daemon.log"),
    server: path.join(runtimeDir, "server.log"),
    browser: path.join(runtimeDir, "browser.log"),
  };

  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(
    path.join(runtimeDir, APERTURE_SESSION_FILE),
    `${JSON.stringify(
      {
        protocolVersion: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
        appRoot: input.root,
        url: endpoint.httpUrl,
        host: endpoint.host,
        port: endpoint.port,
        startedAt: now,
        updatedAt: now,
        daemon: {
          pid: null,
          state: "unknown",
        },
        server: {
          pid: process.pid,
          state: "running",
        },
        browser: {
          pid: null,
          state: "unknown",
          cdpPort: null,
          cdpUrl: null,
          headless: true,
        },
        bridge: apertureViteDevtoolsBridgeDescriptor(endpoint.webSocketUrl),
        logs,
        owned: false,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function resolveApertureViteDevEndpoint(
  configured:
    | {
        readonly host?: string | boolean;
        readonly port?: number;
      }
    | undefined,
  server: ApertureViteDevServer["httpServer"] | null,
): {
  readonly host: string;
  readonly port: number;
  readonly httpUrl: string;
  readonly webSocketUrl: string;
} {
  const address = addressInfo(server);
  const host = normalizeHost(configured?.host, address?.address);
  const port = address?.port ?? configured?.port ?? 5173;

  return {
    host,
    port,
    httpUrl: `http://${host}:${port}/`,
    webSocketUrl: `ws://${host}:${port}/`,
  };
}

function bridgeWebSocketUrl(
  configured:
    | {
        readonly host?: string | boolean;
        readonly port?: number;
      }
    | undefined,
  server: ApertureViteDevServer["httpServer"] | null,
): string {
  return resolveApertureViteDevEndpoint(configured, server).webSocketUrl;
}

function apertureViteDevtoolsBridgeDescriptor(webSocketUrl: string): {
  readonly statusGlobal: typeof APERTURE_STATUS_GLOBAL;
  readonly managedGlobal: typeof APERTURE_MCP_MANAGED_GLOBAL;
  readonly runtimeGlobal: typeof APERTURE_MCP_RUNTIME_GLOBAL;
  readonly url: string;
  readonly channel: typeof APERTURE_VITE_DEVTOOLS_WS_CHANNEL;
} {
  return {
    statusGlobal: APERTURE_STATUS_GLOBAL,
    managedGlobal: APERTURE_MCP_MANAGED_GLOBAL,
    runtimeGlobal: APERTURE_MCP_RUNTIME_GLOBAL,
    url: webSocketUrl,
    channel: APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
  };
}

function addressInfo(
  server: ApertureViteDevServer["httpServer"] | null,
): AddressInfo | null {
  const address = server?.address();

  return typeof address === "object" && address !== null ? address : null;
}

function normalizeHost(
  configured: string | boolean | undefined,
  boundAddress: string | undefined,
): string {
  if (typeof configured === "string" && configured.length > 0) {
    return normalizeBindableHost(configured);
  }

  if (typeof boundAddress === "string" && boundAddress.length > 0) {
    return normalizeBindableHost(boundAddress);
  }

  return "127.0.0.1";
}

function normalizeBindableHost(host: string): string {
  return host === "::" || host === "0.0.0.0" ? "127.0.0.1" : host;
}

function workerSystemsModule(manifest: ApertureSystemManifest): string {
  const imports = manifest.systems
    .map(
      (system, index) =>
        `import * as SystemModule${index} from ${JSON.stringify(system.moduleUrl)};`,
    )
    .join("\n");
  const systems = manifest.systems
    .map((_system, index) => `{ default: SystemModule${index}.default }`)
    .join(",\n  ");

  return [imports, `export const systems = [`, `  ${systems}`, `];`, ""].join(
    "\n",
  );
}

function isVirtualId(id: string): boolean {
  return (
    id === VIRTUAL_CONFIG ||
    id === VIRTUAL_SYSTEM_MANIFEST ||
    id === VIRTUAL_WORKER_SYSTEMS ||
    id === VIRTUAL_WORKER_ENTRY ||
    id === VIRTUAL_BROWSER_ENTRY
  );
}

function virtualBaseId(id: string): string {
  const queryIndex = id.indexOf("?");
  return queryIndex === -1 ? id : id.slice(0, queryIndex);
}
