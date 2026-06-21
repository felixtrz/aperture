import { promises as fs } from "node:fs";
import path from "node:path";
export const APERTURE_VITE_DEVTOOLS_WS_CHANNEL = "aperture:devtools";
const APERTURE_DEVTOOLS_PROTOCOL_VERSION = 1;
const APERTURE_RUNTIME_DIRECTORY = ".aperture/runtime";
const APERTURE_SESSION_FILE = "session.json";
const APERTURE_STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";
const APERTURE_MCP_MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";
const APERTURE_MCP_RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";
export function registerApertureViteDevtoolsBridge(server) {
    server.ws.on?.(APERTURE_VITE_DEVTOOLS_WS_CHANNEL, (_payload, client) => {
        client.send?.(APERTURE_VITE_DEVTOOLS_WS_CHANNEL, {
            ok: true,
            protocolVersion: APERTURE_DEVTOOLS_PROTOCOL_VERSION,
            bridge: apertureViteDevtoolsBridgeDescriptor(bridgeWebSocketUrl(server.config.server, server.httpServer ?? null)),
        });
    });
}
export function scheduleApertureViteSessionWrite(input) {
    const write = () => {
        void writeApertureViteDevSession(input);
    };
    if (input.server?.address() !== null &&
        input.server?.address() !== undefined) {
        write();
        return;
    }
    input.server?.once("listening", write);
}
async function writeApertureViteDevSession(input) {
    const now = new Date().toISOString();
    const endpoint = resolveApertureViteDevEndpoint(input.configured, input.server);
    const runtimeDir = path.join(input.root, APERTURE_RUNTIME_DIRECTORY);
    const logs = {
        daemon: path.join(runtimeDir, "daemon.log"),
        server: path.join(runtimeDir, "server.log"),
        browser: path.join(runtimeDir, "browser.log"),
    };
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(path.join(runtimeDir, APERTURE_SESSION_FILE), `${JSON.stringify({
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
    }, null, 2)}\n`, "utf8");
}
function resolveApertureViteDevEndpoint(configured, server) {
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
function bridgeWebSocketUrl(configured, server) {
    return resolveApertureViteDevEndpoint(configured, server).webSocketUrl;
}
function apertureViteDevtoolsBridgeDescriptor(webSocketUrl) {
    return {
        statusGlobal: APERTURE_STATUS_GLOBAL,
        managedGlobal: APERTURE_MCP_MANAGED_GLOBAL,
        runtimeGlobal: APERTURE_MCP_RUNTIME_GLOBAL,
        url: webSocketUrl,
        channel: APERTURE_VITE_DEVTOOLS_WS_CHANNEL,
    };
}
function addressInfo(server) {
    const address = server?.address();
    return typeof address === "object" && address !== null ? address : null;
}
function normalizeHost(configured, boundAddress) {
    if (typeof configured === "string" && configured.length > 0) {
        return normalizeBindableHost(configured);
    }
    if (typeof boundAddress === "string" && boundAddress.length > 0) {
        return normalizeBindableHost(boundAddress);
    }
    return "127.0.0.1";
}
function normalizeBindableHost(host) {
    return host === "::" || host === "0.0.0.0" ? "127.0.0.1" : host;
}
//# sourceMappingURL=dev-session.js.map