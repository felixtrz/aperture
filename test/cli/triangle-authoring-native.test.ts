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

describe("native triangle-list package consumer", () => {
  it("authors roof/ramp geometry with built exports and real GLB bundle closure", async () => {
    const temporary = await mkdtemp(
      path.join(os.tmpdir(), "aperture-triangle-native-"),
    );
    try {
      const output = path.join(temporary, "bundle.json");
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          path.join(root, "test/fixtures/triangle-authoring/verify.mjs"),
          output,
        ],
        { cwd: root, timeout: 60_000, maxBuffer: 1024 * 1024 },
      );
      const report: unknown = JSON.parse(stdout.trim());
      expect(report).toMatchObject({
        verified: true,
        output,
        meshDraws: 3,
        flatRoofVertices: 24,
        indexedRampVertices: 4,
        indexedRampIndices: 6,
        placeholders: 0,
        gpuVerified: false,
      });
      const bundle = JSON.parse(
        await readFile(output, "utf8"),
      ) as ApertureRenderBundle;
      expect(preflightApertureSnapshotBundle(bundle).ok).toBe(true);
      expect(bundle.closure.roots).toEqual(
        expect.arrayContaining([
          "mesh:triangle.roof.mesh",
          "mesh:triangle.ramp.mesh",
          "mesh:model:mesh:0:primitive:0",
        ]),
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }, 90_000);
});
