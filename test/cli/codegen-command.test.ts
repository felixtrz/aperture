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
import { runApertureCli } from "@aperture-engine/cli";

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
 * fixtures are shared, read-only inputs: test/vite-plugin/generated-types
 * exercises the same fixture from a parallel vitest worker, so writing (or
 * cleaning) .aperture inside the committed fixture races that worker.
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

async function runCli(
  argv: readonly string[],
  cwd: string,
): Promise<{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const exitCode = await runApertureCli({
    argv,
    cwd,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { exitCode, stdout, stderr };
}

describe("aperture codegen command (#76)", () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints help", async () => {
    const help = await runCli(["codegen", "--help"], FIXTURE_ROOT);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("aperture codegen");
    expect(help.stdout).toContain(".aperture/generated");
  });

  it("regenerates typed action and signal maps outside a vite build", async () => {
    const root = await copyFixture();
    const result = await runCli(["codegen"], root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Wrote generated Aperture types to ");

    const contents = await readFile(
      path.join(root, ".aperture/generated/aperture-env.d.ts"),
      "utf8",
    );
    expect(contents).toContain("readonly jump: InputButtonAction;");
    expect(contents).toContain("readonly move: InputAxis2dAction;");
    expect(contents).toContain("readonly score: Signal<number>;");
    expect(contents).toContain("readonly goalReached: Signal<boolean>;");
  });

  it("reports a missing config with a structured error", async () => {
    const missing = await runCli(
      ["codegen", "does-not-exist.config.ts"],
      FIXTURE_ROOT,
    );
    expect(missing.exitCode).not.toBe(0);
    expect(missing.stderr).toContain("aperture.codegen.configNotFound");
  });
});
