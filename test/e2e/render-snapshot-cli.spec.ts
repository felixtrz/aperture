import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { readPngImage, readPngImagePixel } from "./png.js";

const execFileAsync = promisify(execFile);
const CLI = path.resolve("packages/cli/dist/bin/aperture.js");
const FIXTURE_BUNDLE = path.resolve(
  "test/e2e/fixtures/procedural-cube.bundle.json",
);

// P2.4: prove the smaller-loop render path end to end — a snapshot bundle
// written by `aperture headless` becomes a real (non-blank) PNG via
// `aperture render`, on the same SwiftShader software path the rest of the
// WebGPU e2e suite uses. The command boots its own browser + static server,
// so it does not use the example webServer.
test.describe("aperture render CLI", () => {
  test("renders a non-blank PNG from a snapshot bundle", async () => {
    test.setTimeout(180_000);
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-render-e2e-"));
    const out = path.join(tempDir, "frame.png");

    try {
      await execFileAsync("node", [CLI, "render", FIXTURE_BUNDLE, "--out", out], {
        env: { ...process.env },
      });

      const fileStat = await stat(out);
      expect(fileStat.isFile()).toBe(true);
      expect(fileStat.size).toBeGreaterThan(1000);

      const png = await readFile(out);
      const image = readPngImage(png);
      expect(image.width).toBe(960);
      expect(image.height).toBe(640);

      // The procedural cube sits at the center of the frame; a successful render
      // lights it, so the center pixel must be clearly non-black.
      const center = readPngImagePixel(image, 0.5, 0.5);
      const luma = 0.2126 * center.r + 0.7152 * center.g + 0.0722 * center.b;
      expect(luma).toBeGreaterThan(20);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
