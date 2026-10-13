import type { ApertureViteDevServer } from "./dev-session.js";
type WatchEvent = "add" | "change" | "unlink";
interface ApertureViteHmrModuleGraph {
    getModuleById?(id: string): unknown;
    invalidateModule?(module: unknown): void;
}
interface ApertureViteFileWatcher {
    add?(files: string | readonly string[]): void;
    on?(event: WatchEvent, listener: (file: string) => void): void;
}
type ApertureViteDevServerWithHmr = ApertureViteDevServer & {
    readonly moduleGraph?: ApertureViteHmrModuleGraph;
    readonly watcher?: ApertureViteFileWatcher;
    readonly config: ApertureViteDevServer["config"] & {
        readonly logger?: {
            error(message: string): void;
        };
    };
};
export interface ApertureSystemGraphRefreshReport {
    readonly refreshed: boolean;
    readonly file: string;
    readonly workerEntryFile?: string;
}
export declare function installApertureSystemGraphHmr(server: ApertureViteDevServerWithHmr, options: {
    readonly root: string;
    readonly configFile?: string;
}): void;
export declare function refreshApertureGeneratedWorkerEntryForSystemGraphChange(options: {
    readonly root: string;
    readonly configFile?: string;
    readonly file: string;
    readonly server?: ApertureViteDevServerWithHmr;
}): Promise<ApertureSystemGraphRefreshReport>;
export {};
//# sourceMappingURL=system-graph-hmr.d.ts.map