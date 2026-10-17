import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import {
  preflightApertureSnapshotBundle,
  type ApertureRenderBundle,
} from "../../packages/cli/src/headless/bundle.js";

it("bundles fitted polygon surfaces through ordinary built-package Node exports", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "aperture-polygons-"));
  try {
    const output = path.join(temp, "car.json");
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ["test/fixtures/polygon-authoring/verify.mjs", output],
      {
        cwd: path.resolve(import.meta.dirname, "../.."),
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      },
    );
    expect(JSON.parse(stdout.trim())).toEqual({
      verified: true,
      output,
      meshDraws: 30,
      placeholders: 0,
      gpuVerified: false,
    });
    const bundle = JSON.parse(
      await readFile(output, "utf8"),
    ) as ApertureRenderBundle;
    expect(preflightApertureSnapshotBundle(bundle).ok).toBe(true);
    expect(bundle.closure.roots).toContain("mesh:car.body.mesh");
    expect(bundle.closure.roots).toContain("mesh:car.glazing.mesh");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}, 90000);
