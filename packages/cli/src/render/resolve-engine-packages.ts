import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// The render harness runs in a browser and resolves bare specifiers through an
// import map. To work from ANY install layout (pnpm strict, npm, a packed
// tarball) we resolve each engine/vendor package by walking `node_modules` from
// the CLI's own location and reading each package's `exports` map with browser/
// import conditions.
//
// We cannot use `require.resolve` (the engine packages export only `import`, so
// CJS resolution throws ERR_PACKAGE_PATH_NOT_EXPORTED) and we cannot rely on a
// single anchor (pnpm strict hoisting means a transitive package is only
// findable from the package that declares it). So we chain: app from the CLI,
// the engine packages from app, and each vendor dep from the engine package
// that depends on it.

export interface EngineMount {
  /** URL prefix the static server maps, e.g. "/_engine/render/". */
  readonly prefix: string;
  /** Absolute (realpath) package root directory served under the prefix. */
  readonly dir: string;
}

export interface ResolvedEnginePackages {
  readonly mounts: readonly EngineMount[];
  /** Import-map: bare specifier → served URL. */
  readonly importMap: Readonly<Record<string, string>>;
}

type AnchorName = "cli" | "app" | "simulation" | "webgpu";

interface SpecifierEntry {
  readonly spec: string;
  readonly anchor: AnchorName;
}

// Candidate specifiers the harness graph may import. Resolution is best-effort:
// a specifier that does not resolve is omitted rather than failing — an unused
// import-map entry is harmless, a missing one is not.
const CANDIDATES: readonly SpecifierEntry[] = [
  { spec: "@aperture-engine/render", anchor: "app" },
  { spec: "@aperture-engine/app/asset-mirror", anchor: "cli" },
  { spec: "@aperture-engine/runtime", anchor: "app" },
  { spec: "@aperture-engine/particles", anchor: "app" },
  { spec: "@aperture-engine/physics", anchor: "app" },
  { spec: "@aperture-engine/webgpu", anchor: "app" },
  { spec: "@aperture-engine/simulation", anchor: "app" },
  { spec: "@aperture-engine/math", anchor: "simulation" },
  { spec: "@preact/signals-core", anchor: "app" },
  { spec: "@aperture-engine/math/kernel", anchor: "simulation" },
  { spec: "@aperture-engine/webgpu/test-support", anchor: "webgpu" },
  { spec: "elics", anchor: "simulation" },
  { spec: "wgpu-matrix", anchor: "webgpu" },
];

export function resolveEnginePackages(
  fromUrl: string = import.meta.url,
): ResolvedEnginePackages {
  const cliDir = path.dirname(fileURLToPath(fromUrl));
  const anchorDirs = buildAnchorDirs(cliDir);

  const mounts = new Map<string, EngineMount>();
  const importMap: Record<string, string> = {};

  for (const { spec, anchor } of CANDIDATES) {
    const fromDir = anchorDirs[anchor];
    if (fromDir === undefined) {
      continue;
    }

    const pkgName = packageNameOf(spec);
    const pkgRoot = findPackageDir(fromDir, pkgName);
    if (pkgRoot === undefined) {
      continue;
    }

    const subpath = subpathOf(spec, pkgName);
    const entryFile = resolvePackageExport(pkgRoot, subpath);
    if (entryFile === undefined || !existsSync(entryFile)) {
      continue;
    }

    const mountKey = mountKeyOf(pkgName);
    const prefix = `/_engine/${mountKey}/`;
    mounts.set(mountKey, { prefix, dir: pkgRoot });
    const relative = path
      .relative(pkgRoot, entryFile)
      .split(path.sep)
      .join("/");
    importMap[spec] = `${prefix}${relative}`;
  }

  return { mounts: [...mounts.values()], importMap };
}

function buildAnchorDirs(cliDir: string): Partial<Record<AnchorName, string>> {
  const anchors: Partial<Record<AnchorName, string>> = { cli: cliDir };

  const app = findPackageDir(cliDir, "@aperture-engine/app");
  if (app === undefined) {
    return anchors;
  }
  anchors.app = app;

  const simulation = findPackageDir(app, "@aperture-engine/simulation");
  if (simulation !== undefined) {
    anchors.simulation = simulation;
  }
  const webgpu = findPackageDir(app, "@aperture-engine/webgpu");
  if (webgpu !== undefined) {
    anchors.webgpu = webgpu;
  }

  return anchors;
}

/** Walk `node_modules` upward from `fromDir` to find a package, returning its realpath. */
function findPackageDir(fromDir: string, pkgName: string): string | undefined {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", ...pkgName.split("/"));
    if (existsSync(path.join(candidate, "package.json"))) {
      return realpathSync(candidate);
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

function resolvePackageExport(
  pkgRoot: string,
  subpath: string,
): string | undefined {
  let pkg: { exports?: unknown; module?: string; main?: string };
  try {
    pkg = JSON.parse(
      readFileSync(path.join(pkgRoot, "package.json"), "utf8"),
    ) as {
      exports?: unknown;
      module?: string;
      main?: string;
    };
  } catch {
    return undefined;
  }

  const fromExports = resolveExports(pkg.exports, subpath);
  if (fromExports !== undefined) {
    return path.resolve(pkgRoot, fromExports);
  }

  // Fall back to module/main only for the package root.
  if (subpath === ".") {
    const main = pkg.module ?? pkg.main;
    if (main !== undefined) {
      return path.resolve(pkgRoot, main);
    }
  }

  return undefined;
}

function resolveExports(exports: unknown, subpath: string): string | undefined {
  if (exports === undefined || exports === null) {
    return undefined;
  }
  if (typeof exports === "string") {
    return subpath === "." ? exports : undefined;
  }
  if (typeof exports !== "object") {
    return undefined;
  }

  const record = exports as Record<string, unknown>;

  // A bare conditions object (no subpath keys) only maps the package root.
  const isSubpathMap = Object.keys(record).some((key) => key.startsWith("."));
  if (!isSubpathMap) {
    return subpath === "." ? selectCondition(record) : undefined;
  }

  const target = record[subpath];
  return target === undefined ? undefined : selectCondition(target);
}

function selectCondition(target: unknown): string | undefined {
  if (typeof target === "string") {
    return target;
  }
  if (typeof target !== "object" || target === null) {
    return undefined;
  }

  const record = target as Record<string, unknown>;
  for (const condition of ["browser", "import", "module", "default"]) {
    if (condition in record) {
      const resolved = selectCondition(record[condition]);
      if (resolved !== undefined) {
        return resolved;
      }
    }
  }
  return undefined;
}

function packageNameOf(spec: string): string {
  const segments = spec.split("/");
  return spec.startsWith("@")
    ? `${segments[0] ?? ""}/${segments[1] ?? ""}`
    : (segments[0] ?? spec);
}

function subpathOf(spec: string, pkgName: string): string {
  const rest = spec.slice(pkgName.length);
  return rest.length === 0 ? "." : `.${rest}`;
}

function mountKeyOf(pkgName: string): string {
  return pkgName.replace(/^@/u, "").replace(/\//gu, "-");
}
