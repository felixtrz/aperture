import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the browser driver so the command's provenance-warning path runs without
// launching Playwright.
vi.mock("../../packages/cli/src/render/driver.js", () => ({
  renderBundleToPng: vi.fn(async () => ({
    png: Buffer.from("89504e470d0a1a0a", "hex"),
    frame: 0,
  })),
}));

const { runRenderCommand } = await import("@aperture-engine/cli");

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

async function writeBundle(provenance: {
  real: number;
  placeholderCount: number;
  placeholderIds: string[];
}): Promise<string> {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-prov-"));
  const file = path.join(tempDir, "bundle.json");
  await writeFile(
    file,
    JSON.stringify({
      format: "aperture-render-snapshot",
      version: 1,
      frame: 0,
      assetProvenance: provenance,
      snapshot: {},
      sourceAssets: { entries: [] },
    }),
  );
  return file;
}

async function runRender(
  bundleFile: string,
): Promise<{ stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  await runRenderCommand({
    argv: [bundleFile, "--out", path.join(tempDir!, "frame.png"), "--allow-blank"],
    cwd: process.cwd(),
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { stdout, stderr };
}

describe("aperture render placeholder-asset warning (PD.6)", () => {
  it("warns when the bundle was rendered with placeholder assets", async () => {
    const bundleFile = await writeBundle({
      real: 1,
      placeholderCount: 2,
      placeholderIds: ["robot", "floorColor"],
    });

    const { stderr } = await runRender(bundleFile);
    expect(stderr).toContain("aperture.render.placeholderAssets");
    expect(stderr).toContain("robot");
    expect(stderr).toContain("floorColor");

    // The PNG is still written (warning, not failure).
    const png = await readFile(path.join(tempDir!, "frame.png"));
    expect(png.byteLength).toBeGreaterThan(0);
  });

  it("does not warn for a fully-real bundle", async () => {
    const bundleFile = await writeBundle({
      real: 2,
      placeholderCount: 0,
      placeholderIds: [],
    });

    const { stderr } = await runRender(bundleFile);
    expect(stderr).toBe("");
  });
});
