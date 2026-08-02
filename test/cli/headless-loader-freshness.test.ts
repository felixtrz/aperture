import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { loadApertureHeadlessApp } from "@aperture-engine/cli";

// The headless config loader serves app-local modules through a short-lived
// Vite SSR module graph precisely so that long-lived hosts (the MCP server)
// observe edits between loads. These tests exercise the two failure shapes
// that motivated it:
//
// 1. A *transitive* app module edited between loads must be re-evaluated —
//    Node's native ESM loader pins the first version for the process lifetime,
//    which surfaced as a misleading "does not provide an export named X".
// 2. An app that calls defineComponent() at module scope must survive a second
//    load in the same process — re-evaluation re-runs the definition, which
//    the idempotent component registry now tolerates.
//
// The app lives under the repo's gitignored tmp/ (not os.tmpdir()) so its
// engine imports resolve through this repo's node_modules.

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const appRoot = path.join(repoRoot, "tmp", `loader-freshness-${process.pid}`);
const sharedFile = path.join(appRoot, "src", "shared.ts");

async function writeProbeApp(probeValue: number): Promise<void> {
  await mkdir(path.join(appRoot, "src", "systems"), { recursive: true });
  await writeFile(
    path.join(appRoot, "aperture.headless.config.ts"),
    [
      'import { defineApertureConfig } from "@aperture-engine/app/config";',
      "",
      "export default defineApertureConfig({",
      '  mode: "headless",',
      '  systems: ["src/systems/**/*.system.ts"],',
      "  render: { defaultCamera: false, defaultLight: false },",
      "});",
      "",
    ].join("\n"),
  );
  await writeSharedModule(probeValue);
  await writeFile(
    path.join(appRoot, "src", "systems", "probe.system.ts"),
    [
      'import { createSystem } from "@aperture-engine/app/systems";',
      'import { probeComponent, probeValue } from "../shared.ts";',
      "",
      "export const observedProbeValue = probeValue;",
      "export const observedComponent = probeComponent;",
      "",
      "export default class ProbeSystem extends createSystem({ priority: 0 }) {}",
      "",
    ].join("\n"),
  );
}

async function writeSharedModule(probeValue: number): Promise<void> {
  await writeFile(
    sharedFile,
    [
      'import { defineComponent, EcsType } from "@aperture-engine/simulation";',
      "",
      `export const probeValue = ${probeValue};`,
      "",
      "export const probeComponent = defineComponent(",
      '  "test.loaderFreshness.probe",',
      "  { hits: { type: EcsType.Float32, default: 0 } },",
      ");",
      "",
    ].join("\n"),
  );
}

afterAll(async () => {
  await rm(appRoot, { recursive: true, force: true });
});

describe("loadApertureHeadlessApp module freshness", () => {
  it("control: Node's native import pins the first version of a module", async () => {
    // This is the failure mode the loader exists to avoid. If this control
    // ever starts observing the edit, the freshness test below has lost its
    // ability to detect a regression and both need a rethink.
    const controlDir = path.join(appRoot, "control");
    await mkdir(controlDir, { recursive: true });
    const moduleFile = path.join(controlDir, "pinned.mjs");
    await writeFile(moduleFile, "export const value = 1;\n");
    const first = (await import(pathToFileURL(moduleFile).href)) as {
      value: number;
    };
    await writeFile(moduleFile, "export const value = 2;\n");
    const second = (await import(pathToFileURL(moduleFile).href)) as {
      value: number;
    };
    expect(first.value).toBe(1);
    expect(second.value).toBe(1); // stale — cached by resolved URL
  });

  it("re-evaluates an edited transitive module on the next load", async () => {
    await writeProbeApp(1);
    const configFile = path.join(appRoot, "aperture.headless.config.ts");

    const first = await loadApertureHeadlessApp({ configFile });
    expect(first.systems.length).toBe(1);
    expect(
      (first.systems[0] as { observedProbeValue?: number }).observedProbeValue,
    ).toBe(1);

    // Edit ONLY the transitive module. The system file is untouched, so a
    // loader that re-imports the entry but serves cached transitive modules
    // still reports the old value here.
    await writeSharedModule(2);

    const second = await loadApertureHeadlessApp({ configFile });
    expect(
      (second.systems[0] as { observedProbeValue?: number }).observedProbeValue,
    ).toBe(2);
  }, 60_000);

  it("an app defining components at module scope survives a second load", async () => {
    await writeProbeApp(3);
    const configFile = path.join(appRoot, "aperture.headless.config.ts");

    const first = await loadApertureHeadlessApp({ configFile });
    const second = await loadApertureHeadlessApp({ configFile });

    // Re-evaluation re-ran defineComponent("test.loaderFreshness.probe", …);
    // the idempotent registry returns the same definition instead of throwing
    // "Component with id … already exists".
    const firstComponent = (first.systems[0] as { observedComponent?: unknown })
      .observedComponent;
    const secondComponent = (
      second.systems[0] as { observedComponent?: unknown }
    ).observedComponent;
    expect(firstComponent).toBeDefined();
    expect(secondComponent).toBeDefined();
  }, 60_000);
});
