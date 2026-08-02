import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { ApertureViteDevServer } from "../../packages/vite-plugin/src/dev-session.js";
import {
  installApertureSystemGraphHmr,
  refreshApertureGeneratedWorkerEntryForSystemGraphChange,
} from "../../packages/vite-plugin/src/system-graph-hmr.js";
import {
  APERTURE_VIRTUAL_MODULE_IDS,
  apertureGeneratedWorkerEntryFile,
} from "../../packages/vite-plugin/src/virtual-modules.js";
import { waitFor } from "../helpers/wait.js";

const tempRoots: string[] = [];

describe("Aperture Vite system graph HMR", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rewrites the physical worker entry when system files are added or removed", async () => {
    const root = await createFixtureRoot();
    const configFile = path.join(root, "aperture.config.ts");
    const firstSystem = path.join(root, "src/systems/first.system.ts");
    const secondSystem = path.join(root, "src/systems/second.system.ts");
    const server = createFakeServer(root);

    await refreshApertureGeneratedWorkerEntryForSystemGraphChange({
      root,
      configFile,
      file: configFile,
      server,
    });
    expect(await workerEntryContents(root)).toContain("first.system.ts");
    expect(await workerEntryContents(root)).not.toContain("second.system.ts");

    await writeSystem(secondSystem, "SecondSystem", 20);
    const addReport =
      await refreshApertureGeneratedWorkerEntryForSystemGraphChange({
        root,
        configFile,
        file: secondSystem,
        server,
      });
    expect(addReport.refreshed).toBe(true);
    expect(await workerEntryContents(root)).toContain("first.system.ts");
    expect(await workerEntryContents(root)).toContain("second.system.ts");

    await rm(firstSystem);
    const unlinkReport =
      await refreshApertureGeneratedWorkerEntryForSystemGraphChange({
        root,
        configFile,
        file: firstSystem,
        server,
      });
    expect(unlinkReport.refreshed).toBe(true);
    expect(await workerEntryContents(root)).not.toContain("first.system.ts");
    expect(await workerEntryContents(root)).toContain("second.system.ts");
    expect(server.invalidated).toEqual(
      expect.arrayContaining(
        APERTURE_VIRTUAL_MODULE_IDS.flatMap((id) => [id, `\0${id}`]),
      ),
    );
  });

  it("ignores non-system file changes and watches configured system roots", async () => {
    const root = await createFixtureRoot();
    const configFile = path.join(root, "aperture.config.ts");
    const server = createFakeServer(root);

    installApertureSystemGraphHmr(server, { root, configFile });
    await waitFor(() => server.watchAdds.length > 0);

    expect(server.watchEvents).toEqual(["add", "change", "unlink"]);
    expect(server.watchAdds.flat()).toEqual(
      expect.arrayContaining([configFile, path.join(root, "src/systems")]),
    );

    const report =
      await refreshApertureGeneratedWorkerEntryForSystemGraphChange({
        root,
        configFile,
        file: path.join(root, "src/unrelated.ts"),
        server,
      });

    expect(report.refreshed).toBe(false);
    expect(server.invalidated).toEqual([]);
  });

  it("skips rewriting a byte-identical worker entry and only reloads on change", async () => {
    const root = await createFixtureRoot();
    const configFile = path.join(root, "aperture.config.ts");
    const entryFile = apertureGeneratedWorkerEntryFile(root);
    const server = createFakeServer(root);

    const first = await refreshApertureGeneratedWorkerEntryForSystemGraphChange(
      { root, configFile, file: configFile, server },
    );
    expect(first.workerEntryChanged).toBe(true);
    // A genuine change must announce the reload itself: the generated output
    // directory is excluded from vite's watcher, so nothing else will.
    expect(server.fullReloads).toEqual([{ type: "full-reload", path: "*" }]);
    expect(server.invalidated).toContain(entryFile);

    await utimes(entryFile, 0, 0);
    const second =
      await refreshApertureGeneratedWorkerEntryForSystemGraphChange({
        root,
        configFile,
        file: configFile,
        server,
      });

    expect(second.refreshed).toBe(true);
    expect(second.workerEntryChanged).toBe(false);
    // Byte-identical content must not touch the file at all: a watcher treats
    // every write as a change, and a page-load-triggered rewrite then
    // full-reload-loops the dev server forever (load -> rewrite -> reload).
    expect((await stat(entryFile)).mtimeMs).toBe(0);
    expect(server.fullReloads).toHaveLength(1);
  });

  it("watches glob bases declared in an imported shared config", async () => {
    const root = await createSharedConfigFixtureRoot();
    const configFile = path.join(root, "aperture.config.ts");
    const server = createFakeServer(root);

    installApertureSystemGraphHmr(server, { root, configFile });
    await waitFor(() => server.watchAdds.length > 0);

    // The entry config declares no globs itself; they come from the imported
    // aperture.shared-config.ts factory, so glob discovery must follow the
    // import or new system files never fire watcher events.
    expect(server.watchAdds.flat()).toEqual(
      expect.arrayContaining([configFile, path.join(root, "src/systems")]),
    );
  });

  it("regenerates the worker entry for system files matching shared-config globs", async () => {
    const root = await createSharedConfigFixtureRoot();
    const configFile = path.join(root, "aperture.config.ts");
    const secondSystem = path.join(root, "src/systems/second.system.ts");
    const server = createFakeServer(root);

    await writeSystem(secondSystem, "SecondSystem", 20);
    const report =
      await refreshApertureGeneratedWorkerEntryForSystemGraphChange({
        root,
        configFile,
        file: secondSystem,
        server,
      });

    expect(report.refreshed).toBe(true);
    expect(report.workerEntryChanged).toBe(true);
    expect(await workerEntryContents(root)).toContain("first.system.ts");
    expect(await workerEntryContents(root)).toContain("second.system.ts");
    expect(server.fullReloads).toEqual([{ type: "full-reload", path: "*" }]);
  });
});

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-vite-hmr-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "src/systems"), { recursive: true });
  await writeFile(
    path.join(root, "aperture.config.ts"),
    [
      `import { defineApertureConfig } from "@aperture-engine/app/config";`,
      `export default defineApertureConfig({`,
      `  mode: "browser",`,
      `  systems: ["src/systems/**/*.system.ts"],`,
      `});`,
      "",
    ].join("\n"),
    "utf8",
  );
  await writeSystem(
    path.join(root, "src/systems/first.system.ts"),
    "First",
    10,
  );

  return root;
}

/**
 * Mirror the scaffold's shared-config pattern: aperture.config.ts only calls
 * a factory from aperture.shared-config.ts, and the systems globs live in the
 * imported module — invisible to a text parse of the entry config alone.
 */
async function createSharedConfigFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aperture-vite-hmr-"));
  tempRoots.push(root);
  await mkdir(path.join(root, "src/systems"), { recursive: true });
  await writeFile(
    path.join(root, "aperture.config.ts"),
    [
      `import { createApertureAppConfig } from "./aperture.shared-config.ts";`,
      ``,
      `export default createApertureAppConfig({ mode: "browser" });`,
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(root, "aperture.shared-config.ts"),
    [
      `import { defineApertureConfig } from "@aperture-engine/app/config";`,
      ``,
      `export function createApertureAppConfig(options: {`,
      `  readonly mode: "browser" | "headless";`,
      `}) {`,
      `  return defineApertureConfig({`,
      `    mode: options.mode,`,
      `    systems: ["src/systems/**/*.system.ts"],`,
      `  });`,
      `}`,
      "",
    ].join("\n"),
    "utf8",
  );
  await writeSystem(
    path.join(root, "src/systems/first.system.ts"),
    "First",
    10,
  );

  return root;
}

async function writeSystem(
  file: string,
  name: string,
  priority: number,
): Promise<void> {
  await writeFile(
    file,
    [
      `import { createSystem } from "@aperture-engine/app/systems";`,
      `export default class ${name} extends createSystem({ priority: ${priority} }) {}`,
      "",
    ].join("\n"),
    "utf8",
  );
}

async function workerEntryContents(root: string): Promise<string> {
  return readFile(apertureGeneratedWorkerEntryFile(root), "utf8");
}

function createFakeServer(root: string): ApertureViteDevServer & {
  readonly invalidated: string[];
  readonly watchAdds: string[][];
  readonly watchEvents: string[];
  readonly fullReloads: unknown[];
} {
  const modules = new Map(
    APERTURE_VIRTUAL_MODULE_IDS.flatMap((id) => [
      [id, { id }],
      [`\0${id}`, { id: `\0${id}` }],
    ]),
  );
  const workerEntryFile = apertureGeneratedWorkerEntryFile(root);
  const invalidated: string[] = [];
  const watchAdds: string[][] = [];
  const watchEvents: string[] = [];
  const fullReloads: unknown[] = [];

  return {
    config: { root },
    ws: {
      send(payload: unknown) {
        fullReloads.push(payload);
      },
    },
    moduleGraph: {
      getModuleById(id: string) {
        return modules.get(id);
      },
      getModulesByFile(file: string) {
        return file === workerEntryFile ? [{ id: file }] : undefined;
      },
      invalidateModule(module: unknown) {
        invalidated.push((module as { readonly id: string }).id);
      },
    },
    watcher: {
      add(files: string | readonly string[]) {
        watchAdds.push(Array.isArray(files) ? [...files] : [files]);
      },
      on(event: string) {
        watchEvents.push(event);
      },
    },
    invalidated,
    watchAdds,
    watchEvents,
    fullReloads,
  } as ApertureViteDevServer & {
    readonly invalidated: string[];
    readonly watchAdds: string[][];
    readonly watchEvents: string[];
    readonly fullReloads: unknown[];
  };
}
