import { registerApertureViteDevtoolsBridge, scheduleApertureViteSessionWrite, } from "./dev-session.js";
export { APERTURE_VITE_DEVTOOLS_WS_CHANNEL, } from "./dev-session.js";
import { resolveConfigFile } from "./file-utils.js";
import { writeApertureGeneratedActionTypes } from "./generated-action-types.js";
export { createApertureGeneratedActionTypes, writeApertureGeneratedActionTypes, } from "./generated-action-types.js";
export { createApertureSystemManifest, } from "./system-discovery.js";
import { injectApertureBrowserEntry, loadApertureVirtualModule, resolveApertureVirtualId, } from "./virtual-modules.js";
import { installApertureSystemGraphHmr } from "./system-graph-hmr.js";
/**
 * Response headers required for `crossOriginIsolated === true`, which in turn
 * unlocks `SharedArrayBuffer` for the worker/main-thread snapshot transport.
 */
export const APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
};
export function aperture(options = {}) {
    let root = process.cwd();
    let command = "serve";
    let configuredServer;
    const aiDevtoolsEnabled = options.ai?.mode !== "off";
    const crossOriginIsolation = options.crossOriginIsolation !== false;
    const plugin = {
        name: "aperture",
        config() {
            if (!crossOriginIsolation) {
                return;
            }
            const headers = { ...APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS };
            return {
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
//# sourceMappingURL=index.js.map