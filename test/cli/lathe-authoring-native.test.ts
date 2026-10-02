import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  preflightApertureSnapshotBundle,
  type ApertureRenderBundle,
} from "../../packages/cli/src/headless/bundle.js";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("../..", import.meta.url));

describe("native lathe package consumer", () => {
  it("authors, edits and bundles lathe shapes using built facade and factory exports", async () => {
    const temporary = await mkdtemp(
      path.join(os.tmpdir(), "aperture-lathe-native-"),
    );
    try {
      const output = path.join(temporary, "bundle.json");
      const { stdout } = await execFileAsync(
        process.execPath,
        [path.join(root, "test/fixtures/lathe-authoring/verify.mjs"), output],
        { cwd: root, timeout: 60_000, maxBuffer: 1024 * 1024 },
      );
      expect(JSON.parse(stdout.trim())).toMatchObject({
        verified: true,
        output,
        meshDraws: 3,
        vertices: 288,
        triangles: 96,
        editedVersion: 2,
        placeholders: 0,
        gpuVerified: false,
      });
      const bundle = JSON.parse(
        await readFile(output, "utf8"),
      ) as ApertureRenderBundle;
      expect(preflightApertureSnapshotBundle(bundle).ok).toBe(true);
      expect(bundle.closure.roots).toContain("mesh:bowl.mesh");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }, 90_000);
});
