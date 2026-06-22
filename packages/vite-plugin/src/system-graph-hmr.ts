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
  parseApertureSystemGlobs,
} from "./system-discovery.js";
import {
  APERTURE_VIRTUAL_MODULE_IDS,
  writeApertureGeneratedWorkerEntry,
} from "./virtual-modules.js";

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
};

export interface ApertureSystemGraphRefreshReport {
  readonly refreshed: boolean;
  readonly file: string;
  readonly workerEntryFile?: string;
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

  const workerEntryFile = await writeApertureGeneratedWorkerEntry({
    root: options.root,
    configFile,
  });
  invalidateApertureVirtualModules(options.server);

  return { refreshed: true, file, workerEntryFile };
}

async function watchApertureSystemGraphFiles(
  server: ApertureViteDevServerWithHmr,
  options: {
    readonly root: string;
    readonly configFile: string;
  },
): Promise<void> {
  const configSource = await readOptionalText(options.configFile);
  const globs = parseApertureSystemGlobs(configSource);
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
  const globs = parseApertureSystemGlobs(configSource).map((glob) =>
    normalizePath(glob),
  );

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
