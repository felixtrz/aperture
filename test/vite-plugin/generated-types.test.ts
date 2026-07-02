import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  apertureGeneratedTypeEntriesFromConfig,
  renderApertureGeneratedTypes,
  writeApertureGeneratedActionTypes,
} from "@aperture-engine/vite-plugin";
import { createApertureAppConfig } from "../fixtures/codegen-factory/aperture.shared-config.ts";

const FIXTURE_ROOT = fileURLToPath(
  new URL("../fixtures/codegen-factory", import.meta.url),
);
// Gitignored scratch area INSIDE the repo: the fixture config imports
// @aperture-engine/app/config, which only resolves through the repo's
// node_modules chain, so an os.tmpdir() copy would not evaluate.
const TMP_BASE = fileURLToPath(new URL("../../tmp/vitest", import.meta.url));

const tempRoots: string[] = [];

/**
 * Copy the fixture into a fresh temp root before mutating it. Committed
 * fixtures are shared, read-only inputs: test/cli/codegen-command exercises
 * the same fixture from a parallel vitest worker, so writing (or cleaning)
 * .aperture inside the committed fixture races that worker.
 */
async function copyFixture(): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  const root = await mkdtemp(path.join(TMP_BASE, "codegen-factory-"));
  tempRoots.push(root);
  for (const file of await readdir(FIXTURE_ROOT)) {
    await copyFile(path.join(FIXTURE_ROOT, file), path.join(root, file));
  }
  return root;
}

describe("generated types from evaluated configs (#68, #76)", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("extracts action and signal entries from an evaluated factory config", () => {
    const entries = apertureGeneratedTypeEntriesFromConfig(
      createApertureAppConfig({ mode: "headless" }),
    );

    expect(entries?.actions).toEqual([
      { name: "jump", kind: "button" },
      { name: "throttle", kind: "axis1d" },
      { name: "move", kind: "axis2d" },
    ]);
    expect(entries?.signals).toEqual([
      { name: "score", kind: "number" },
      { name: "label", kind: "string" },
      { name: "goalReached", kind: "boolean" },
      { name: "selectedEntity", kind: "ref" },
    ]);
  });

  it("renders typed action and signal map augmentations", () => {
    const entries = apertureGeneratedTypeEntriesFromConfig(
      createApertureAppConfig({ mode: "headless" }),
    );
    const rendered = renderApertureGeneratedTypes(
      entries ?? {
        actions: [],
        signals: [],
      },
    );

    expect(rendered).toContain("readonly jump: InputButtonAction;");
    expect(rendered).toContain("readonly throttle: InputAxis1dAction;");
    expect(rendered).toContain("readonly move: InputAxis2dAction;");
    expect(rendered).toContain("interface ApertureGeneratedSignalMap {");
    expect(rendered).toContain("readonly score: Signal<number>;");
    expect(rendered).toContain("readonly label: Signal<string>;");
    expect(rendered).toContain("readonly goalReached: Signal<boolean>;");
    expect(rendered).toContain("readonly selectedEntity: Signal<unknown>;");
  });

  it("writes a non-empty map for a factory config that AST parsing cannot see (#68)", async () => {
    const root = await copyFixture();
    const file = await writeApertureGeneratedActionTypes({
      root,
    });

    const contents = await readFile(file, "utf8");
    // The config file itself only re-exports the factory result; the entries
    // must come from EVALUATING the config, not parsing its literals.
    expect(contents).toContain("readonly jump: InputButtonAction;");
    expect(contents).toContain("readonly move: InputAxis2dAction;");
    expect(contents).toContain("readonly score: Signal<number>;");
  });
});
