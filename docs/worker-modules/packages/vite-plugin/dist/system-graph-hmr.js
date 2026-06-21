import path from "node:path";
import { normalizePath, readOptionalText, resolveConfigFile, } from "./file-utils.js";
import { apertureSystemFileMatchesGlobs, apertureSystemGlobBase, parseApertureSystemGlobs, } from "./system-discovery.js";
import { APERTURE_VIRTUAL_MODULE_IDS, writeApertureGeneratedWorkerEntry, } from "./virtual-modules.js";
export function installApertureSystemGraphHmr(server, options) {
    const configFile = resolveConfigFile(options.root, options.configFile);
    let refreshQueue = Promise.resolve();
    void watchApertureSystemGraphFiles(server, {
        root: options.root,
        configFile,
    });
    const queueRefresh = (file) => {
        refreshQueue = refreshQueue
            .then(async () => {
            await refreshApertureGeneratedWorkerEntryForSystemGraphChange({
                root: options.root,
                configFile,
                file,
                server,
            });
        })
            .catch(() => undefined);
    };
    server.watcher?.on?.("add", queueRefresh);
    server.watcher?.on?.("change", queueRefresh);
    server.watcher?.on?.("unlink", queueRefresh);
}
export async function refreshApertureGeneratedWorkerEntryForSystemGraphChange(options) {
    const configFile = resolveConfigFile(options.root, options.configFile);
    const file = path.resolve(options.file);
    if (!(await isApertureSystemGraphFile({
        root: options.root,
        configFile,
        file,
    }))) {
        return { refreshed: false, file };
    }
    const workerEntryFile = await writeApertureGeneratedWorkerEntry({
        root: options.root,
        configFile,
    });
    invalidateApertureVirtualModules(options.server);
    return { refreshed: true, file, workerEntryFile };
}
async function watchApertureSystemGraphFiles(server, options) {
    const configSource = await readOptionalText(options.configFile);
    const globs = parseApertureSystemGlobs(configSource);
    const watchPaths = [
        options.configFile,
        ...globs.map((glob) => apertureSystemGlobBase(options.root, glob)),
    ];
    server.watcher?.add?.(dedupe(watchPaths));
}
async function isApertureSystemGraphFile(options) {
    if (path.resolve(options.file) === path.resolve(options.configFile)) {
        return true;
    }
    const configSource = await readOptionalText(options.configFile);
    const globs = parseApertureSystemGlobs(configSource).map((glob) => normalizePath(glob));
    return apertureSystemFileMatchesGlobs(options.root, options.file, globs);
}
function invalidateApertureVirtualModules(server) {
    const moduleGraph = server?.moduleGraph;
    if (moduleGraph === undefined) {
        return;
    }
    for (const id of APERTURE_VIRTUAL_MODULE_IDS) {
        invalidateModuleById(moduleGraph, id);
        invalidateModuleById(moduleGraph, `\0${id}`);
    }
}
function invalidateModuleById(moduleGraph, id) {
    const module = moduleGraph.getModuleById?.(id);
    if (module !== undefined && module !== null) {
        moduleGraph.invalidateModule?.(module);
    }
}
function dedupe(values) {
    return [...new Set(values)];
}
//# sourceMappingURL=system-graph-hmr.js.map