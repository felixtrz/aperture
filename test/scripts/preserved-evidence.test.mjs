import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyPreservedEvidence } from "../../scripts/check-preserved-evidence.mjs";
import { formatRepository } from "../../scripts/format-repository.mjs";

const directories = [];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const repo = fileURLToPath(new URL("../../", import.meta.url));

function fixture() {
  const root = mkdtempSync(
    path.join(os.tmpdir(), "aperture-preservation-test-"),
  );
  directories.push(root);
  const relative = "benchmarks/retained/scene.mjs";
  const source = "export const geometry={vertices:[1,2,3]}\n";
  mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
  writeFileSync(path.join(root, relative), source);
  writeFileSync(path.join(root, ".gitignore"), "");
  writeFileSync(path.join(root, ".prettierignore"), "");
  return {
    root,
    relative,
    source,
    inventory: {
      schema: "aperture.preserved-evidence.v1",
      baselineRevision: "a".repeat(40),
      files: { [relative]: sha256(source) },
    },
  };
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe("preserved evidence formatting boundary", () => {
  it("checks actual retained bytes and excludes only those exact paths", async () => {
    const { root, inventory, relative } = fixture();
    await expect(verifyPreservedEvidence(root, inventory)).resolves.toEqual([
      relative,
    ]);
  });

  it("rejects modified and missing retained files", async () => {
    const { root, inventory, relative } = fixture();
    await fs.appendFile(path.join(root, relative), "// changed\n");
    await expect(verifyPreservedEvidence(root, inventory)).rejects.toThrow(
      "Modified preserved evidence",
    );
    await fs.unlink(path.join(root, relative));
    await expect(verifyPreservedEvidence(root, inventory)).rejects.toThrow(
      "ENOENT",
    );
  });

  it("rejects redirected files even when target bytes match", async () => {
    const { root, inventory, relative, source } = fixture();
    await fs.writeFile(path.join(root, "external.mjs"), source);
    await fs.unlink(path.join(root, relative));
    await fs.symlink(
      path.join(root, "external.mjs"),
      path.join(root, relative),
    );
    await expect(verifyPreservedEvidence(root, inventory)).rejects.toThrow(
      "Redirected evidence",
    );
  });

  it("rejects paths that could hide package code or escape the inventory", async () => {
    const { root, inventory, source } = fixture();
    for (const relative of [
      "packages/app/src/index.ts",
      "../outside.mjs",
      "benchmarks/../packages/app/src/index.ts",
      "/benchmarks/scene.mjs",
      "benchmarks/**",
      "benchmarks/scene.mjs\npackages/**",
    ]) {
      await expect(
        verifyPreservedEvidence(root, {
          ...inventory,
          files: { [relative]: sha256(source) },
        }),
      ).rejects.toThrow("Invalid preserved evidence path");
    }
  });

  it("stops before Prettier can write when retained bytes fail verification", async () => {
    const { root, inventory, relative } = fixture();
    await fs.appendFile(path.join(root, relative), "// changed\n");
    const spawn = vi.fn();
    await expect(
      formatRepository("--write", { root, inventory, spawn }),
    ).rejects.toThrow("Modified preserved evidence");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("keeps new benchmark source covered by standard Prettier", async () => {
    const { root, inventory, relative, source } = fixture();
    const active = "benchmarks/new-trial/scene.mjs";
    await fs.mkdir(path.dirname(path.join(root, active)), { recursive: true });
    await fs.writeFile(
      path.join(root, active),
      "export const scene={house:true,car:true}\n",
    );
    let output = "";
    const spawn = (command, argv, options) => {
      const result = spawnSync(
        command,
        [
          path.join(repo, "node_modules/prettier/bin/prettier.cjs"),
          ...argv.slice(1),
        ],
        { ...options, stdio: "pipe", encoding: "utf8" },
      );
      output = result.stdout + result.stderr;
      return result;
    };
    expect(await formatRepository("--check", { root, inventory, spawn })).toBe(
      1,
    );
    expect(output).toContain(active);
    expect(output).not.toContain(relative);
    expect(await formatRepository("--write", { root, inventory, spawn })).toBe(
      0,
    );
    expect(await fs.readFile(path.join(root, relative), "utf8")).toBe(source);
    expect(await formatRepository("--check", { root, inventory, spawn })).toBe(
      0,
    );
  }, 15000);

  it("cross-checks the active recorder against its independent original freeze", async () => {
    const { root, inventory, relative } = fixture();
    const freeze =
      "benchmarks/crane-live-edits-20261003/harness/freeze-006.json";
    await fs.mkdir(path.dirname(path.join(root, freeze)), { recursive: true });
    const data = JSON.stringify({
      schema: "aperture.crane-live-harness-freeze.v1",
      tests: { passed: 24, failed: 0 },
      files: { "recorder.test.mjs": { sha256: "b".repeat(64) } },
    });
    await fs.writeFile(path.join(root, freeze), data);
    inventory.files[freeze] = sha256(data);
    await expect(verifyPreservedEvidence(root, inventory)).rejects.toThrow(
      "Frozen recorder pin mismatch",
    );
    expect(inventory.files[relative]).toBeDefined();
  });
});
