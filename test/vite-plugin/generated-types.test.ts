import { readFile, rm } from "node:fs/promises";
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

describe("generated types from evaluated configs (#68, #76)", () => {
  afterEach(async () => {
    await rm(path.join(FIXTURE_ROOT, ".aperture"), {
      recursive: true,
      force: true,
    });
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
    const rendered = renderApertureGeneratedTypes(entries ?? {
      actions: [],
      signals: [],
    });

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
    const file = await writeApertureGeneratedActionTypes({
      root: FIXTURE_ROOT,
    });

    const contents = await readFile(file, "utf8");
    // The config file itself only re-exports the factory result; the entries
    // must come from EVALUATING the config, not parsing its literals.
    expect(contents).toContain("readonly jump: InputButtonAction;");
    expect(contents).toContain("readonly move: InputAxis2dAction;");
    expect(contents).toContain("readonly score: Signal<number>;");
  });
});
