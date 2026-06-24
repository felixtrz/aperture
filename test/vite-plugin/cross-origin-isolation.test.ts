import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS,
  type ApertureViteDevServer,
  aperture,
} from "../../packages/vite-plugin/src/index.js";

const tempRoots: string[] = [];

describe("Aperture Vite plugin cross-origin isolation", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("emits COOP/COEP headers for the dev server and preview by default", () => {
    const plugin = aperture();
    const config = plugin.config?.();

    expect(config?.server?.headers).toEqual(
      APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS,
    );
    expect(config?.preview?.headers).toEqual(
      APERTURE_CROSS_ORIGIN_ISOLATION_HEADERS,
    );
    // The transport requires a cross-origin-isolated document for
    // SharedArrayBuffer; assert the exact header contract.
    expect(config?.server?.headers).toMatchObject({
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
  });

  it("omits the headers when cross-origin isolation is opted out", () => {
    const plugin = aperture({ crossOriginIsolation: false });
    const config = plugin.config?.();

    // Headers are gated on cross-origin isolation...
    expect(config?.server).toBeUndefined();
    expect(config?.preview).toBeUndefined();
    // ...but the worker format + dep pre-bundling are always configured
    // (see GH #24 / GH #31).
    expect(config?.worker).toEqual({ format: "es" });
    expect(config?.optimizeDeps?.include).toEqual(
      expect.arrayContaining(["@aperture-engine/app/systems"]),
    );
  });

  it("pins the worker format to es and pre-bundles the Aperture entries", () => {
    const config = aperture().config?.();

    expect(config?.worker).toEqual({ format: "es" });
    expect(config?.optimizeDeps?.include).toEqual(
      expect.arrayContaining([
        "@aperture-engine/app/config",
        "@aperture-engine/app/systems",
        "@aperture-engine/app/browser",
        "@aperture-engine/app/worker",
      ]),
    );
  });

  it("skips dev-server hooks during build", async () => {
    const root = await createFixtureRoot();
    const plugin = aperture();
    const server = createFakeServer(root);

    plugin.configResolved?.({ root, command: "build" });
    await waitForGeneratedTypes(root);
    plugin.configureServer?.(server);

    expect(server.watchEvents).toEqual([]);
    expect(server.wsEvents).toEqual([]);
  });

  it("installs HMR without devtools when AI mode is disabled", async () => {
    const root = await createFixtureRoot();
    const plugin = aperture({
      ai: { mode: "off" },
      configFile: "aperture.config.ts",
    });
    const server = createFakeServer(root);

    plugin.configResolved?.({
      root,
      command: "serve",
      server: { host: "127.0.0.1", port: 4173 },
    });
    await waitForGeneratedTypes(root);
    plugin.configureServer?.(server);

    expect(server.watchEvents).toEqual(["add", "change", "unlink"]);
    expect(server.wsEvents).toEqual([]);
  });

  it("registers devtools hooks and writes the dev session when enabled", async () => {
    const root = await createFixtureRoot();
    const plugin = aperture();
    const server = createFakeServer(root, { listening: true });

    plugin.configResolved?.({
      root,
      command: "serve",
      server: { host: "127.0.0.1", port: 5173 },
    });
    await waitForGeneratedTypes(root);
    plugin.configureServer?.(server);

    expect(server.watchEvents).toEqual(["add", "change", "unlink"]);
    expect(server.wsEvents).toEqual(["aperture:devtools"]);

    const session = JSON.parse(
      await waitForFile(path.join(root, ".aperture/runtime/session.json")),
    ) as { readonly url?: string; readonly bridge?: unknown };

    expect(session.url).toBe("http://127.0.0.1:5173/");
    expect(session.bridge).toBeDefined();
  });

  it("resolves virtual modules and injects the browser entry into HTML", async () => {
    const root = await createFixtureRoot();
    const plugin = aperture({
      ai: { mode: "off" },
      configFile: "aperture.config.ts",
    });

    plugin.configResolved?.({ root, command: "serve" });
    await waitForGeneratedTypes(root);

    expect(plugin.resolveId?.("virtual:aperture/browser-entry?worker")).toBe(
      "\0virtual:aperture/browser-entry?worker",
    );
    expect(plugin.resolveId?.("/src/main.ts")).toBeNull();

    const configModule = await plugin.load?.("\0virtual:aperture/config");
    expect(configModule).toContain("export { default }");

    const systemManifest = await plugin.load?.(
      "\0virtual:aperture/system-manifest",
    );
    expect(systemManifest).toContain("export const diagnostics");

    const workerSystems = await plugin.load?.(
      "\0virtual:aperture/worker-systems",
    );
    expect(workerSystems).toContain("export const systems");

    const workerEntry = await plugin.load?.("\0virtual:aperture/worker-entry");
    expect(workerEntry).toContain("startGeneratedSimulationWorker");

    const browserEntry = await plugin.load?.(
      "\0virtual:aperture/browser-entry",
    );
    expect(browserEntry).toContain("startGeneratedBrowserApp");
    expect(browserEntry).toContain("apertureDevtoolsEnabled = false");
    await expect(plugin.load?.("\0virtual:aperture/not-real")).resolves.toBe(
      null,
    );

    const transform = plugin.transformIndexHtml as {
      readonly handler: (html: string) => string;
    };
    const injectedHtml = transform.handler("plain");

    expect(transform.handler("<html><body></body></html>")).toContain(
      'import "virtual:aperture/browser-entry"',
    );
    expect(injectedHtml).toContain('import "virtual:aperture/browser-entry"');
    expect(transform.handler(injectedHtml)).toBe(injectedHtml);
  });
});

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-vite-plugin-"));
  tempRoots.push(root);
  await writeFile(
    path.join(root, "aperture.config.ts"),
    [
      `import { defineApertureConfig } from "@aperture-engine/app/config";`,
      `export default defineApertureConfig({`,
      `  mode: "browser",`,
      `  systems: [],`,
      `  input: {`,
      `    actions: {`,
      `      jump: ["Space"],`,
      `      move: { kind: "axis2d" },`,
      `      ignored: 1,`,
      `      method() {},`,
      `    },`,
      `  },`,
      `});`,
      "",
    ].join("\n"),
    "utf8",
  );
  return root;
}

async function waitForGeneratedTypes(root: string): Promise<void> {
  await waitForFile(path.join(root, ".aperture/generated/aperture-env.d.ts"));
}

async function waitForFile(file: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      return await readFile(file, "utf8");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  throw new Error(`Timed out waiting for ${file}.`);
}

function createFakeServer(
  root: string,
  options: { readonly listening?: boolean } = {},
): ApertureViteDevServer & {
  readonly watchEvents: string[];
  readonly wsEvents: string[];
} {
  const watchEvents: string[] = [];
  const wsEvents: string[] = [];
  return {
    config: {
      root,
      server: {
        port: 5173,
      },
    },
    httpServer: {
      address() {
        return options.listening === true
          ? { address: "127.0.0.1", family: "IPv4", port: 5173 }
          : null;
      },
      once() {},
    },
    ws: {
      on(event) {
        wsEvents.push(event);
      },
    },
    watcher: {
      add() {},
      on(event: string) {
        watchEvents.push(event);
      },
    },
    watchEvents,
    wsEvents,
  } as ApertureViteDevServer & {
    readonly watchEvents: string[];
    readonly wsEvents: string[];
  };
}
