import { promises as fs } from "node:fs";
import path from "node:path";

export interface ApertureVitePluginOptions {
  readonly configFile?: string;
}

export interface ApertureVitePlugin {
  readonly name: string;
  configResolved?(config: { readonly root: string }): void;
  resolveId?(id: string): string | null;
  load?(id: string): Promise<string | null> | string | null;
  transformIndexHtml?:
    | ((html: string) => string)
    | {
        readonly order: "pre";
        handler(html: string): string;
      };
}

export interface DiscoveredApertureSystem {
  readonly file: string;
  readonly moduleUrl: string;
  readonly hasDefaultExport: boolean;
  readonly schedule: {
    readonly priority: number;
  };
  readonly diagnostics: readonly ApertureVitePluginDiagnostic[];
}

export interface ApertureSystemManifest {
  readonly systems: readonly DiscoveredApertureSystem[];
  readonly diagnostics: readonly ApertureVitePluginDiagnostic[];
}

export interface ApertureVitePluginDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly glob?: string;
  readonly suggestedFix: string;
}

const VIRTUAL_CONFIG = "virtual:aperture/config";
const VIRTUAL_SYSTEM_MANIFEST = "virtual:aperture/system-manifest";
const VIRTUAL_WORKER_SYSTEMS = "virtual:aperture/worker-systems";
const VIRTUAL_WORKER_ENTRY = "virtual:aperture/worker-entry";
const VIRTUAL_BROWSER_ENTRY = "virtual:aperture/browser-entry";
const RESOLVED_PREFIX = "\0";

export function aperture(
  options: ApertureVitePluginOptions = {},
): ApertureVitePlugin {
  let root = process.cwd();

  const plugin: ApertureVitePlugin = {
    name: "aperture",
    configResolved(config) {
      root = config.root;
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

        return [
          `import config from ${JSON.stringify(VIRTUAL_CONFIG)};`,
          `import systemManifest from ${JSON.stringify(VIRTUAL_SYSTEM_MANIFEST)};`,
          `import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";`,
          `const worker = new Worker(${JSON.stringify(workerEntryPath)}, { type: "module" });`,
          `startGeneratedBrowserApp({`,
          `  config,`,
          `  systemManifest,`,
          `  workerEntry: worker,`,
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

export async function createApertureSystemManifest(options: {
  readonly root: string;
  readonly configFile?: string;
  readonly systemGlobs?: readonly string[];
}): Promise<ApertureSystemManifest> {
  const configFile = resolveConfigFile(options.root, options.configFile);
  const configSource = await readOptionalText(configFile);
  const diagnostics: ApertureVitePluginDiagnostic[] = [];
  const globs =
    options.systemGlobs ??
    parseSystemGlobs(configSource).map((glob) => normalizePath(glob));

  if (configSource === null && options.systemGlobs === undefined) {
    diagnostics.push({
      code: "aperture.config.notFound",
      file: configFile,
      message: `Aperture config file '${configFile}' was not found.`,
      suggestedFix:
        "Create aperture.config.ts or pass configFile to aperture().",
    });
  }

  const systems: DiscoveredApertureSystem[] = [];

  for (const glob of globs) {
    const files = await discoverGlob(options.root, glob);

    if (files.length === 0) {
      diagnostics.push({
        code: "aperture.systemGlob.empty",
        glob,
        message: `System glob '${glob}' did not match any files.`,
        suggestedFix:
          "Check the systems array in aperture.config.ts or create matching *.system.ts files.",
      });
    }

    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      const systemDiagnostics: ApertureVitePluginDiagnostic[] = [];
      const hasDefaultExport = /\bexport\s+default\b/.test(source);
      const priority = parseSchedulePriority(source);

      if (!hasDefaultExport) {
        systemDiagnostics.push({
          code: "aperture.system.missingDefaultExport",
          file,
          message: `System module '${file}' does not default-export a system class.`,
          suggestedFix:
            "Default-export a class extending createSystem() from @aperture-engine/app/systems.",
        });
      }

      if (priority === null) {
        systemDiagnostics.push({
          code: "aperture.system.invalidSchedule",
          file,
          message: `System module '${file}' has invalid schedule metadata.`,
          suggestedFix: "Use export const schedule = { priority: 0 }.",
        });
      }

      diagnostics.push(...systemDiagnostics);
      systems.push({
        file,
        moduleUrl: toModuleUrl(file),
        hasDefaultExport,
        schedule: { priority: priority ?? 0 },
        diagnostics: systemDiagnostics,
      });
    }
  }

  return {
    systems: systems.sort((a, b) => a.schedule.priority - b.schedule.priority),
    diagnostics,
  };
}

function workerSystemsModule(manifest: ApertureSystemManifest): string {
  const imports = manifest.systems
    .map(
      (system, index) =>
        `import * as SystemModule${index} from ${JSON.stringify(system.moduleUrl)};`,
    )
    .join("\n");
  const systems = manifest.systems
    .map(
      (system, index) =>
        `{ default: SystemModule${index}.default, schedule: SystemModule${index}.schedule ?? ${JSON.stringify(system.schedule)} }`,
    )
    .join(",\n  ");

  return [imports, `export const systems = [`, `  ${systems}`, `];`, ""].join(
    "\n",
  );
}

function resolveConfigFile(
  root: string,
  configFile: string | undefined,
): string {
  return path.resolve(root, configFile ?? "aperture.config.ts");
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

async function readOptionalText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

function parseSystemGlobs(source: string | null): string[] {
  if (source === null) {
    return [];
  }

  const systemsMatch = /\bsystems\s*:\s*\[([\s\S]*?)\]/m.exec(source);

  if (systemsMatch === null) {
    return [];
  }

  const body = systemsMatch[1] ?? "";
  const globs: string[] = [];
  const stringLiteral = /["'`]([^"'`]+)["'`]/g;
  let match: RegExpExecArray | null;

  while ((match = stringLiteral.exec(body)) !== null) {
    if (match[1] !== undefined) {
      globs.push(match[1]);
    }
  }

  return globs;
}

function parseSchedulePriority(source: string): number | null {
  if (!/\bexport\s+const\s+schedule\b/.test(source)) {
    return 0;
  }

  const priorityMatch = /\bpriority\s*:\s*(-?\d+(?:\.\d+)?)/m.exec(source);

  if (priorityMatch === null || priorityMatch[1] === undefined) {
    return null;
  }

  return Number(priorityMatch[1]);
}

async function discoverGlob(root: string, glob: string): Promise<string[]> {
  const normalizedGlob = normalizePath(glob);
  const base = globBase(root, normalizedGlob);
  const matcher = globToRegExp(normalizedGlob);
  const output: string[] = [];

  async function visit(directory: string): Promise<void> {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const absolute = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          await visit(absolute);
          continue;
        }

        const relative = normalizePath(path.relative(root, absolute));
        if (matcher.test(relative)) {
          output.push(absolute);
        }
      }
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { readonly code?: unknown }).code === "ENOENT"
      ) {
        return;
      }

      throw error;
    }
  }

  await visit(base);
  return output.sort((a, b) => a.localeCompare(b));
}

function globBase(root: string, glob: string): string {
  const wildcardIndex = glob.search(/[*?[\]]/);
  const prefix = wildcardIndex === -1 ? glob : glob.slice(0, wildcardIndex);
  const slash = prefix.lastIndexOf("/");
  const directory = slash === -1 ? "." : prefix.slice(0, slash);

  return path.resolve(root, directory);
}

function globToRegExp(glob: string): RegExp {
  let pattern = "^";

  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    const next = glob[index + 1];

    if (char === "*" && next === "*") {
      if (glob[index + 2] === "/") {
        pattern += "(?:.*/)?";
        index += 2;
        continue;
      }

      pattern += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      pattern += "[^/]*";
      continue;
    }

    if (char === "?") {
      pattern += ".";
      continue;
    }

    pattern += escapeRegExp(char ?? "");
  }

  pattern += "$";
  return new RegExp(pattern);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function toModuleUrl(file: string): string {
  return normalizePath(file);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}
