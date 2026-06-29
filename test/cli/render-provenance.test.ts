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
const { renderBundleToPng } =
  await import("../../packages/cli/src/render/driver.js");

let tempDir: string | undefined;

afterEach(async () => {
  vi.clearAllMocks();

  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

interface TestSourceAssetEntry {
  readonly handle: { readonly kind: string; readonly id: string };
  readonly provenance?: "loaded" | "placeholder";
}

function sourceAssetEntry(
  kind: string,
  id: string,
  provenance?: "loaded" | "placeholder",
): TestSourceAssetEntry {
  return {
    handle: { kind, id },
    ...(provenance === undefined ? {} : { provenance }),
  };
}

async function writeBundle(
  entries: readonly TestSourceAssetEntry[],
): Promise<string> {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-prov-"));
  const file = path.join(tempDir, "bundle.json");
  const placeholderIds = entries
    .filter((entry) => entry.provenance === "placeholder")
    .map((entry) => `${entry.handle.kind}:${entry.handle.id}`);
  await writeFile(
    file,
    JSON.stringify({
      format: "aperture.render-bundle",
      version: 1,
      engine: {
        apertureVersion: "0.0.0",
        snapshotSchema: "aperture.render-snapshot.v1",
        assetSchema: "aperture.source-assets.v1",
        createdBy: "test",
      },
      frame: 0,
      renderTarget: {
        width: 64,
        height: 64,
        colorSpace: "srgb",
        sampleCount: 4,
      },
      requirements: { webgpuFeatures: [], textureFormats: [] },
      assetProvenance: {
        real: entries.length - placeholderIds.length,
        placeholderCount: placeholderIds.length,
        placeholderIds,
      },
      snapshot: {
        codec: "json-typed-array-v1",
        value: {
          meshDraws: [
            {
              mesh: { kind: "mesh", id: "robot" },
              material: { kind: "material", id: "floorColor" },
            },
          ],
        },
      },
      assets: {
        schema: "aperture.source-assets.v1",
        completeness: "complete",
        allowPlaceholders: true,
        entries: entries.map((entry) => ({
          handle: entry.handle,
          label: entry.handle.id,
          status: "ready",
          version: 1,
          asset: null,
          dependencies: [],
          diagnostics: [],
          ...(entry.provenance === undefined
            ? {}
            : { provenance: entry.provenance }),
        })),
      },
      closure: {
        roots: ["material:floorColor", "mesh:robot"],
        referenced: ["material:floorColor", "mesh:robot"],
        missing: [],
        unready: [],
        placeholders: placeholderIds.sort(),
      },
      diagnostics: [],
      digest: {
        algorithm: "fnv1a32-stable-json-v1",
        hash: "00000000",
        byteLength: 0,
      },
    }),
  );
  return file;
}

async function runRender(
  bundleFile: string,
  options: { readonly allowPlaceholders?: boolean } = {},
): Promise<{ stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  await runRenderCommand({
    argv: [
      bundleFile,
      "--out",
      path.join(tempDir!, "frame.png"),
      "--allow-blank",
      ...(options.allowPlaceholders === true ? ["--allow-placeholders"] : []),
    ],
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

describe("aperture render placeholder-asset preflight (PD.6)", () => {
  it("rejects placeholder assets unless they are explicitly allowed", async () => {
    const bundleFile = await writeBundle([
      sourceAssetEntry("mesh", "robot", "placeholder"),
      sourceAssetEntry("material", "floorColor", "placeholder"),
    ]);

    await expect(runRender(bundleFile)).rejects.toMatchObject({
      code: "aperture.render.incompleteBundle",
    });
    expect(renderBundleToPng).not.toHaveBeenCalled();
  });

  it("warns when allowed placeholder assets are rendered", async () => {
    const bundleFile = await writeBundle([
      sourceAssetEntry("mesh", "robot", "placeholder"),
      sourceAssetEntry("material", "floorColor", "placeholder"),
    ]);

    const { stderr } = await runRender(bundleFile, {
      allowPlaceholders: true,
    });
    expect(stderr).toContain("aperture.render.placeholderAssets");
    expect(stderr).toContain("robot");
    expect(stderr).toContain("floorColor");
    expect(renderBundleToPng).toHaveBeenCalledWith(
      expect.objectContaining({ width: 64, height: 64 }),
    );

    // The PNG is still written (warning, not failure).
    const png = await readFile(path.join(tempDir!, "frame.png"));
    expect(png.byteLength).toBeGreaterThan(0);
  });

  it("does not warn for a fully-real bundle", async () => {
    const bundleFile = await writeBundle([
      sourceAssetEntry("mesh", "robot"),
      sourceAssetEntry("material", "floorColor"),
    ]);

    const { stderr } = await runRender(bundleFile);
    expect(stderr).toBe("");
  });
});
