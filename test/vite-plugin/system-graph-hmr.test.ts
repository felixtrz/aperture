import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error("Timed out waiting for predicate.");
}

function createFakeServer(root: string): ApertureViteDevServer & {
  readonly invalidated: string[];
  readonly watchAdds: string[][];
  readonly watchEvents: string[];
} {
  const modules = new Map(
    APERTURE_VIRTUAL_MODULE_IDS.flatMap((id) => [
      [id, { id }],
      [`\0${id}`, { id: `\0${id}` }],
    ]),
  );
  const invalidated: string[] = [];
  const watchAdds: string[][] = [];
  const watchEvents: string[] = [];

  return {
    config: { root },
    ws: {},
    moduleGraph: {
      getModuleById(id: string) {
        return modules.get(id);
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
  } as ApertureViteDevServer & {
    readonly invalidated: string[];
    readonly watchAdds: string[][];
    readonly watchEvents: string[];
  };
}
