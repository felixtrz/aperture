import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runApertureCli } from "@aperture-engine/cli";

const FIXTURE_ROOT = fileURLToPath(
  new URL("../fixtures/codegen-factory", import.meta.url),
);

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
    await rm(path.join(FIXTURE_ROOT, ".aperture"), {
      recursive: true,
      force: true,
    });
  });

  it("prints help", async () => {
    const help = await runCli(["codegen", "--help"], FIXTURE_ROOT);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("aperture codegen");
    expect(help.stdout).toContain(".aperture/generated");
  });

  it("regenerates typed action and signal maps outside a vite build", async () => {
    const result = await runCli(["codegen"], FIXTURE_ROOT);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Wrote generated Aperture types to ");

    const contents = await readFile(
      path.join(FIXTURE_ROOT, ".aperture/generated/aperture-env.d.ts"),
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
