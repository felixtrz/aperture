import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execute = promisify(execFile);
const TMP_BASE = fileURLToPath(new URL("../../tmp/vitest", import.meta.url));
const BUILT_PLUGIN = new URL(
  "../../packages/vite-plugin/dist/index.js",
  import.meta.url,
).href;

it("refreshes built codegen in native Node and exits despite config logs, errors, and live handles", async () => {
  await mkdir(TMP_BASE, { recursive: true });
  const root = await mkdtemp(path.join(TMP_BASE, "codegen-native-"));
  try {
    // No Vitest aliases or import cache participate in this child. A natural
    // process exit proves all successful/failed config workers were disposed.
    // --input-type also covers inherited Node flags with the worker bootstrap.
    const { stdout, stderr } = await execute(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
        import assert from "node:assert/strict";
        import { readFile, writeFile } from "node:fs/promises";
        import path from "node:path";
        import { writeApertureGeneratedActionTypes } from ${JSON.stringify(BUILT_PLUGIN)};
        const root = ${JSON.stringify(root)};
        const config = path.join(root, "aperture.config.ts");
        const shared = path.join(root, "shared.ts");
        await writeFile(path.join(root, "package.json"), '{"type":"module"}');
        await writeFile(config, 'export { default } from "./shared.ts";');
        const liveHandles = 'import { parentPort } from "node:worker_threads"; parentPort?.postMessage({ ready: true }); parentPort?.postMessage({ input: { actions: { wrong: { kind: "axis1d" } } }, signals: {} }); console.log("CONFIG_STDOUT"); console.error("CONFIG_STDERR"); setInterval(() => {}, 1000);';
        async function generate() {
          return readFile(await writeApertureGeneratedActionTypes({ root }), "utf8");
        }
        for (const name of ["nativeBefore", "nativeAfter"]) {
          await writeFile(shared, liveHandles + 'export default { callback() {}, input: { actions: { ' + name + ': { kind: "button" } } }, signals: { ' + name + ': { kind: "ref", value() {} } } };');
          const contents = await generate();
          assert.ok(contents.includes('readonly ' + name + ': InputButtonAction;'));
          assert.ok(contents.includes('readonly ' + name + ': Signal<unknown>;'));
          assert.ok(!contents.includes("readonly wrong:"));
          if (name === "nativeAfter") assert.ok(!contents.includes("readonly nativeBefore:"));
        }
        await writeFile(shared, liveHandles + 'throw new Error("failed config");');
        assert.ok(!(await generate()).includes("readonly nativeAfter:"));
        await writeFile(shared, liveHandles + 'process.exit(7);');
        assert.ok(!(await generate()).includes("readonly nativeAfter:"));
        await writeFile(shared, 'export default { input: { actions: { recovered: { kind: "axis2d" } } }, signals: { recovered: { kind: "boolean" } } };');
        const recovered = await generate();
        assert.ok(recovered.includes("readonly recovered: InputAxis2dAction;"));
        assert.ok(recovered.includes("readonly recovered: Signal<boolean>;"));
        console.log("CODEGEN_NATIVE_OK");
      `,
      ],
      { cwd: root, timeout: 20_000, maxBuffer: 1024 * 1024 },
    );
    expect(stdout).toContain("CONFIG_STDOUT");
    expect(stderr).toContain("CONFIG_STDERR");
    expect(stdout.trim().endsWith("CODEGEN_NATIVE_OK")).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
