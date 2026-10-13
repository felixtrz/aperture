import { type ApertureViteDevServer } from "./dev-session.js";
export { APERTURE_VITE_DEVTOOLS_WS_CHANNEL, type ApertureViteDevServer, } from "./dev-session.js";
export { apertureGeneratedTypeEntriesFromConfig, createApertureGeneratedActionTypes, renderApertureGeneratedTypes, writeApertureGeneratedActionTypes, type ApertureGeneratedTypeEntries, } from "./generated-action-types.js";
export { createApertureSystemManifest, type ApertureSystemManifest, type ApertureVitePluginDiagnostic, type DiscoveredApertureSystem, } from "./system-discovery.js";
import { type ApertureConfigHmrModule } from "./config-type-hmr.js";
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
export declare const APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS: Readonly<Record<string, string>>;
export interface ApertureVitePluginAiOptions {
    readonly mode?: "agent" | "off";
}
export interface ApertureVitePlugin {
    readonly name: string;
    config?(config?: {
        readonly root?: string;
    }): {
        readonly server?: {
            readonly headers?: Record<string, string>;
        };
        readonly preview?: {
            readonly headers?: Record<string, string>;
        };
        readonly worker?: {
            readonly format?: "es" | "iife";
        };
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
    handleHotUpdate?(context: {
        readonly file: string;
        readonly modules: readonly ApertureConfigHmrModule[];
    }): Promise<void>;
    resolveId?(id: string): string | null;
    load?(id: string): Promise<string | null> | string | null;
    transformIndexHtml?: ((html: string) => string) | {
        readonly order: "pre";
        handler(html: string): string;
    };
}
export declare function aperture(options?: ApertureVitePluginOptions): ApertureVitePlugin;
//# sourceMappingURL=index.d.ts.map