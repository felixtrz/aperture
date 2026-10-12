import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { RealmSourceManifest } from "./realm-protocol.js";
import { ApertureCliError } from "../errors.js";

/** Captures exactly the source returned by Node's native loader; delegates its TS semantics. */
export function captureHeadlessRealmSource(appParentUrl: string): {
  manifest(): RealmSourceManifest;
  dispose(): void;
} {
  const files = new Map<
    string,
    { url: string; sha256: string; bytes: number }
  >();
  const bindings = new Map<
    string,
    {
      specifier: string;
      url: string;
      provenance: "app-anchor" | "tooling-caller";
    }
  >();
  let appAnchor: string | null = null;
  let projectAnchor = false;
  let installationRoot: string | null = null;
  const packages = new Map<string, string>();
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      const originalParentURL = context.parentURL;
      const engine = specifier.startsWith("@aperture-engine/");
      const ecs = specifier === "elics" || specifier.startsWith("elics/");
      if (!engine && !ecs) return nextResolve(specifier, context);
      if (appAnchor === null) {
        try {
          appAnchor = nextResolve("@aperture-engine/app", {
            ...context,
            parentURL: appParentUrl,
          }).url;
          projectAnchor = true;
        } catch (error: unknown) {
          if (!missingModule(error)) throw error;
          // Select the CLI SDK as a whole when no project app exists.
          appAnchor = nextResolve("@aperture-engine/app", {
            ...context,
            parentURL: import.meta.url,
          }).url;
        }
        packages.set(
          "@aperture-engine/app",
          packageRoot(appAnchor, "@aperture-engine/app"),
        );
        const installedAt = appAnchor.indexOf("/node_modules/");
        if (projectAnchor && installedAt >= 0)
          installationRoot = appAnchor.slice(
            0,
            installedAt + "/node_modules/".length,
          );
      }
      const name = engine
        ? specifier.split("/").slice(0, 2).join("/")
        : "elics";
      const knownRoot = packages.get(name);
      // The app need not directly depend on every transitive runtime package.
      // Only a selected package may introduce its own dependency. CLI caller
      // paths are never an independent runtime fallback once a graph is chosen.
      const selectedParent =
        originalParentURL !== undefined &&
        (installationRoot === null ||
          originalParentURL.startsWith(installationRoot)) &&
        [...packages.entries()].some(
          ([name, root]) =>
            name !== "@aperture-engine/cli" &&
            name !== "@aperture-engine/vite-plugin" &&
            originalParentURL.startsWith(root),
        );
      const parents =
        knownRoot !== undefined
          ? [`${knownRoot}package.json`]
          : [
              ...(projectAnchor ? [appParentUrl] : []),
              appAnchor,
              ...(selectedParent ? [originalParentURL!] : []),
            ];
      let result: ReturnType<typeof nextResolve> | undefined;
      let failure: unknown;
      let provenance: "app-anchor" | "tooling-caller" = "app-anchor";
      for (const parentURL of [...new Set(parents)]) {
        try {
          result = nextResolve(specifier, { ...context, parentURL });
          break;
        } catch (error: unknown) {
          failure = error;
          if (!missingModule(error)) break; // Never hide incompatible exports.
        }
      }
      if (
        result === undefined &&
        (name === "@aperture-engine/vite-plugin" ||
          name === "@aperture-engine/cli") &&
        missingModule(failure)
      ) {
        result = nextResolve(specifier, {
          ...context,
          parentURL: import.meta.url,
        });
        provenance = "tooling-caller";
      }
      if (result === undefined) {
        const error = new ApertureCliError(
          "aperture.headless.incoherentSdk",
          `Runtime '${specifier}' cannot resolve within the selected app SDK '${appAnchor}'. Install a complete compatible project SDK; mixing runtime packages with the CLI installation is not supported.`,
        );
        Object.defineProperty(error, "cause", { value: failure });
        throw error;
      }
      const root = packageRoot(result.url, name);
      if (knownRoot !== undefined && knownRoot !== root)
        throw new ApertureCliError(
          "aperture.headless.incoherentSdk",
          `Runtime '${name}' resolved to multiple physical packages in one headless realm.`,
        );
      packages.set(name, root);
      const previous = bindings.get(specifier);
      if (previous !== undefined && previous.url !== result.url)
        throw new ApertureCliError(
          "aperture.headless.incoherentSdk",
          `Runtime '${specifier}' resolved to multiple physical modules in one headless realm.`,
        );
      bindings.set(specifier, { specifier, url: result.url, provenance });
      return result;
    },
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      if (
        url.startsWith("file:") &&
        !url.includes("/node_modules/") &&
        result.source != null
      ) {
        const data =
          typeof result.source === "string"
            ? Buffer.from(result.source)
            : result.source instanceof ArrayBuffer
              ? Buffer.from(result.source)
              : Buffer.from(
                  result.source.buffer,
                  result.source.byteOffset,
                  result.source.byteLength,
                );
        if (!files.has(url) && files.size >= 2048)
          throw new ApertureCliError(
            "aperture.headless.sourceLimit",
            "Headless source manifest exceeds 2048 native file modules.",
          );
        files.set(url, {
          url,
          sha256: createHash("sha256").update(data).digest("hex"),
          bytes: data.byteLength,
        });
      }
      return result;
    },
  });
  let previousKey = "";
  let previous: RealmSourceManifest | null = null;
  return {
    manifest() {
      const entries = [...files.values()].sort((a, b) =>
        a.url.localeCompare(b.url),
      );
      const anchors = [...bindings.values()].sort((a, b) =>
        a.specifier.localeCompare(b.specifier),
      );
      const key = JSON.stringify({
        files: entries,
        appAnchor,
        bindings: anchors,
      });
      if (previous !== null && key === previousKey) return previous;
      previousKey = key;
      previous = {
        scope: "native-file-modules-outside-node_modules",
        appAnchor,
        bindings: anchors,
        files: entries,
        revision: createHash("sha256").update(key).digest("hex"),
      };
      return previous;
    },
    dispose() {
      hook.deregister();
    },
  };
}
function missingModule(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND"
  );
}

/** Native resolution already selected the module; identify its actual package. */
function packageRoot(url: string, expectedName: string): string {
  let directory = path.dirname(fileURLToPath(url));
  for (let depth = 0; depth < 64; depth += 1) {
    try {
      const metadata: unknown = JSON.parse(
        readFileSync(path.join(directory, "package.json"), "utf8"),
      );
      if (
        metadata !== null &&
        typeof metadata === "object" &&
        "name" in metadata &&
        metadata.name === expectedName
      )
        return pathToFileURL(`${directory}${path.sep}`).href;
    } catch {
      /* Walk only the resolved module's physical ancestry. */
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new ApertureCliError(
    "aperture.headless.incoherentSdk",
    `Resolved '${expectedName}' has no matching physical package metadata: '${url}'.`,
  );
}
