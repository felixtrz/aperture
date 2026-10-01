import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  aperture,
  writeApertureGeneratedActionTypes,
} from "@aperture-engine/vite-plugin";
import { runApertureCli } from "@aperture-engine/cli";

const TMP_BASE = fileURLToPath(new URL("../../tmp/vitest", import.meta.url));
const roots: string[] = [];

async function fixture(): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  const root = await mkdtemp(path.join(TMP_BASE, "codegen-refresh-"));
  roots.push(root);
  await writeFile(path.join(root, "package.json"), '{"type":"module"}');
  await writeFile(
    path.join(root, "aperture.config.ts"),
    'import { createConfig } from "./shared.ts"; export default createConfig();',
  );
  await writeFile(path.join(root, "shared.ts"), factory("before"));
  return root;
}

function factory(name: string): string {
  return `import { defineApertureConfig, input, signal } from "@aperture-engine/app/config";
    export function createConfig() {
      return defineApertureConfig({ mode: "headless",
        input: { actions: { ${name}: input.button([input.key("Space")]) } },
        signals: { ${name}: signal.number(0) }
      });
    }`;
}

async function generated(root: string): Promise<string> {
  return readFile(await writeApertureGeneratedActionTypes({ root }), "utf8");
}

function expectEntries(contents: string, name: string): void {
  expect(contents).toContain(`readonly ${name}: InputButtonAction;`);
  expect(contents).toContain(`readonly ${name}: Signal<number>;`);
}

describe("same-process generated type refresh", () => {
  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it("reevaluates shared factories without touching the importing config", async () => {
    const root = await fixture();
    const shared = path.join(root, "shared.ts");
    const original = await stat(shared);
    expectEntries(await generated(root), "before");
    await writeFile(shared, factory("after"));
    // Refresh depends on evaluation, not timestamps (editors can preserve them).
    await utimes(shared, original.atime, original.mtime);
    const updated = await generated(root);
    expectEntries(updated, "after");
    expect(updated).not.toContain("readonly before:");
  }, 30_000);

  it("refreshes nested dependencies and recovers from a cached import failure", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "shared.ts"),
      'export { createConfig } from "./nested.ts";',
    );
    await writeFile(path.join(root, "nested.ts"), factory("nestedBefore"));
    expectEntries(await generated(root), "nestedBefore");
    await writeFile(
      path.join(root, "nested.ts"),
      'throw new Error("incomplete edit");',
    );
    const failed = await generated(root);
    expect(failed).not.toContain("readonly nestedBefore:");
    await writeFile(path.join(root, "nested.ts"), factory("recovered"));
    const recovered = await generated(root);
    expectEntries(recovered, "recovered");
    expect(recovered).not.toContain("readonly nestedBefore:");
  }, 30_000);

  it("refreshes CommonJS dependencies beneath an ESM factory", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "shared.ts"),
      'import name from "./nested.cjs"; export function createConfig() { return { input: { actions: { [name]: { kind: "button" } } }, signals: { [name]: { kind: "number" } } }; }',
    );
    await writeFile(
      path.join(root, "nested.cjs"),
      'module.exports = require("./leaf.cjs");',
    );
    await writeFile(
      path.join(root, "leaf.cjs"),
      'module.exports = "cjsBefore";',
    );
    expectEntries(await generated(root), "cjsBefore");
    await writeFile(
      path.join(root, "leaf.cjs"),
      'module.exports = "cjsAfter";',
    );
    const updated = await generated(root);
    expectEntries(updated, "cjsAfter");
    expect(updated).not.toContain("readonly cjsBefore:");
  }, 30_000);

  it("ignores config-originated ready and metadata messages before factory exports", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "shared.ts"),
      `
      import { parentPort } from "node:worker_threads";
      parentPort?.postMessage({ ready: true });
      parentPort?.postMessage({ input: { actions: { wrong: { kind: "axis1d" } } }, signals: { wrong: { kind: "string" } } });
      ${factory("correct")}
    `,
    );
    const contents = await generated(root);
    expectEntries(contents, "correct");
    expect(contents).not.toContain("readonly wrong:");
  }, 30_000);

  it("retains action kinds, signal kinds, and the metadata-only boundary", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "shared.ts"),
      `export function createConfig() {
      const circular = {}; circular.self = circular;
      return { callback() {}, circular,
        input: { actions: {
          button: { kind: "button", callback() {} },
          throttle: { kind: "axis1d" }, move: { kind: "axis2d" },
          invalid: { kind() {} }
        } },
        signals: { count: { kind: "number" }, label: { kind: "string" },
          ready: { kind: "boolean" }, selected: { kind: "ref", value: circular },
          invalid: { kind: Symbol("invalid") }
        }
      };
    }`,
    );
    const contents = await generated(root);
    expect(contents).toContain("readonly button: InputButtonAction;");
    expect(contents).toContain("readonly throttle: InputAxis1dAction;");
    expect(contents).toContain("readonly move: InputAxis2dAction;");
    expect(contents).toContain("readonly count: Signal<number>;");
    expect(contents).toContain("readonly label: Signal<string>;");
    expect(contents).toContain("readonly ready: Signal<boolean>;");
    expect(contents).toContain("readonly selected: Signal<unknown>;");
    expect(contents).not.toContain("readonly invalid:");
  }, 30_000);

  it("keeps the AST fallback when config evaluation is unavailable", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "aperture.config.ts"),
      `
      import { defineApertureConfig, input } from "@aperture-engine/app/config";
      export default defineApertureConfig({ mode: "browser", baseUrl: import.meta.env.BASE_URL,
        input: { actions: { fallback: input.button([input.key("Space")]) } }
      });`,
    );
    const contents = await generated(root);
    expect(contents).toContain("readonly fallback: InputButtonAction;");
    expect(contents).toContain("interface ApertureGeneratedSignalMap {\n  }");
  }, 30_000);

  it("refreshes the sibling headless factory after browser evaluation fails", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "aperture.config.ts"),
      'import { createConfig } from "./shared.ts"; const config = createConfig(); config.baseUrl = import.meta.env.BASE_URL; export default config;',
    );
    await writeFile(
      path.join(root, "aperture.headless.config.ts"),
      'import { createConfig } from "./shared.ts"; export default createConfig();',
    );
    expectEntries(await generated(root), "before");
    await writeFile(path.join(root, "shared.ts"), factory("headlessAfter"));
    const updated = await generated(root);
    expectEntries(updated, "headlessAfter");
    expect(updated).not.toContain("readonly before:");
  }, 30_000);

  it("refreshes through repeated CLI calls and Vite virtual-module loads", async () => {
    const root = await fixture();
    const options = {
      argv: ["codegen"],
      cwd: root,
      stdout: () => {},
      stderr: () => {},
    };
    expect(await runApertureCli(options)).toBe(0);
    await writeFile(path.join(root, "shared.ts"), factory("cliAfter"));
    expect(await runApertureCli(options)).toBe(0);
    const output = path.join(root, ".aperture/generated/aperture-env.d.ts");
    expectEntries(await readFile(output, "utf8"), "cliAfter");

    const plugin = aperture();
    plugin.configResolved?.({ root });
    await plugin.load?.("virtual:aperture/config");
    await writeFile(path.join(root, "shared.ts"), factory("viteAfter"));
    await plugin.load?.("virtual:aperture/config");
    const updated = await readFile(output, "utf8");
    expectEntries(updated, "viteAfter");
    expect(updated).not.toContain("readonly cliAfter:");
  }, 30_000);
});
