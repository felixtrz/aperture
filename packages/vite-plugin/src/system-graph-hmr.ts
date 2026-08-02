import path from "node:path";
import type { ApertureViteDevServer } from "./dev-session.js";
import {
  normalizePath,
  readOptionalText,
  resolveConfigFile,
} from "./file-utils.js";
import {
  apertureSystemFileMatchesGlobs,
  apertureSystemGlobBase,
  parseApertureSystemGlobsFromConfig,
} from "./system-discovery.js";
import {
  APERTURE_VIRTUAL_MODULE_IDS,
  writeApertureGeneratedWorkerEntry,
} from "./virtual-modules.js";

type WatchEvent = "add" | "change" | "unlink";

interface ApertureViteHmrModuleGraph {
  getModuleById?(id: string): unknown;
  getModulesByFile?(file: string): Iterable<unknown> | undefined;
  invalidateModule?(module: unknown): void;
}

interface ApertureViteFileWatcher {
  add?(files: string | readonly string[]): void;
  on?(event: WatchEvent, listener: (file: string) => void): void;
}

type ApertureViteDevServerWithHmr = ApertureViteDevServer & {
  readonly moduleGraph?: ApertureViteHmrModuleGraph;
  readonly watcher?: ApertureViteFileWatcher;
};

export interface ApertureSystemGraphRefreshReport {
  readonly refreshed: boolean;
  readonly file: string;
  readonly workerEntryFile?: string;
  /** True when the regenerated worker entry differed from the one on disk. */
  readonly workerEntryChanged?: boolean;
}

export function installApertureSystemGraphHmr(
  server: ApertureViteDevServerWithHmr,
  options: {
    readonly root: string;
    readonly configFile?: string;
  },
): void {
  const configFile = resolveConfigFile(options.root, options.configFile);
  let refreshQueue: Promise<void> = Promise.resolve();

  void watchApertureSystemGraphFiles(server, {
    root: options.root,
    configFile,
  });

  const queueRefresh = (file: string): void => {
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

export async function refreshApertureGeneratedWorkerEntryForSystemGraphChange(options: {
  readonly root: string;
  readonly configFile?: string;
  readonly file: string;
  readonly server?: ApertureViteDevServerWithHmr;
}): Promise<ApertureSystemGraphRefreshReport> {
  const configFile = resolveConfigFile(options.root, options.configFile);
  const file = path.resolve(options.file);

  if (
    !(await isApertureSystemGraphFile({
      root: options.root,
      configFile,
      file,
    }))
  ) {
    return { refreshed: false, file };
  }

  const workerEntry = await writeApertureGeneratedWorkerEntry({
    root: options.root,
    configFile,
  });
  invalidateApertureVirtualModules(options.server);

  if (workerEntry.changed) {
    // The generated output directory is excluded from vite's watcher (the
    // plugin's own writes must never fan back into the full-reload pipeline),
    // so a genuine system-graph change has to invalidate the on-disk entry
    // module and announce the reload itself. Unchanged entries need neither:
    // edits to existing system files already reload through the module graph.
    invalidateApertureModulesForFile(options.server, workerEntry.file);
    options.server?.ws.send?.({ type: "full-reload", path: "*" });
  }

  return {
    refreshed: true,
    file,
    workerEntryFile: workerEntry.file,
    workerEntryChanged: workerEntry.changed,
  };
}

async function watchApertureSystemGraphFiles(
  server: ApertureViteDevServerWithHmr,
  options: {
    readonly root: string;
    readonly configFile: string;
  },
): Promise<void> {
  const configSource = await readOptionalText(options.configFile);
  const globs = await parseApertureSystemGlobsFromConfig(
    options.configFile,
    configSource,
  );
  const watchPaths = [
    options.configFile,
    ...globs.map((glob) => apertureSystemGlobBase(options.root, glob)),
  ];

  server.watcher?.add?.(dedupe(watchPaths));
}

async function isApertureSystemGraphFile(options: {
  readonly root: string;
  readonly configFile: string;
  readonly file: string;
}): Promise<boolean> {
  if (path.resolve(options.file) === path.resolve(options.configFile)) {
    return true;
  }

  const configSource = await readOptionalText(options.configFile);
  const globs = (
    await parseApertureSystemGlobsFromConfig(options.configFile, configSource)
  ).map((glob) => normalizePath(glob));

  return apertureSystemFileMatchesGlobs(options.root, options.file, globs);
}

function invalidateApertureVirtualModules(
  server: ApertureViteDevServerWithHmr | undefined,
): void {
  const moduleGraph = server?.moduleGraph;

  if (moduleGraph === undefined) {
    return;
  }

  for (const id of APERTURE_VIRTUAL_MODULE_IDS) {
    invalidateModuleById(moduleGraph, id);
    invalidateModuleById(moduleGraph, `\0${id}`);
  }
}

function invalidateApertureModulesForFile(
  server: ApertureViteDevServerWithHmr | undefined,
  file: string,
): void {
  const moduleGraph = server?.moduleGraph;
  const modules = moduleGraph?.getModulesByFile?.(normalizePath(file));

  if (moduleGraph === undefined || modules === undefined) {
    return;
  }

  for (const module of modules) {
    if (module !== undefined && module !== null) {
      moduleGraph.invalidateModule?.(module);
    }
  }
}

function invalidateModuleById(
  moduleGraph: ApertureViteHmrModuleGraph,
  id: string,
): void {
  const module = moduleGraph.getModuleById?.(id);

  if (module !== undefined && module !== null) {
    moduleGraph.invalidateModule?.(module);
  }
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
