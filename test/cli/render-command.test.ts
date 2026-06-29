import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runRenderCommand } from "@aperture-engine/cli";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

async function runInProcess(
  argv: readonly string[],
): Promise<{ exitCode: number; stdout: string }> {
  let stdout = "";
  const exitCode = await runRenderCommand({
    argv,
    cwd: process.cwd(),
    stdout: (text) => {
      stdout += text;
    },
  });
  return { exitCode, stdout };
}

async function expectRejectedCode(
  argv: readonly string[],
  code: string,
): Promise<void> {
  await expect(runInProcess(argv)).rejects.toMatchObject({ code });
}

async function writeTemp(name: string, contents: string): Promise<string> {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "aperture-render-"));
  const file = path.join(tempDir, name);
  await writeFile(file, contents);
  return file;
}

describe("aperture render command — argument handling (P2.3)", () => {
  it("prints help and exits 0", async () => {
    const result = await runInProcess(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--out");
    expect(result.stdout).toContain("--width");
    expect(result.stdout).toContain("--allow-placeholders");
    expect(result.stdout).toContain("--json");
  });

  it("requires a bundle path", async () => {
    await expectRejectedCode(
      ["--out", "frame.png"],
      "aperture.render.missingSnapshot",
    );
  });

  it("requires --out", async () => {
    await expectRejectedCode(["bundle.json"], "aperture.render.missingOutput");
  });

  it("rejects unknown options", async () => {
    await expectRejectedCode(
      ["bundle.json", "--out", "frame.png", "--bogus"],
      "aperture.render.unknownOption",
    );
  });

  it("rejects a non-positive --width", async () => {
    await expectRejectedCode(
      ["bundle.json", "--out", "frame.png", "--width", "0"],
      "aperture.render.invalidOption",
    );
  });

  it("rejects more than one bundle path", async () => {
    await expectRejectedCode(
      ["a.json", "b.json", "--out", "frame.png"],
      "aperture.render.tooManyArguments",
    );
  });

  it("reports a missing bundle file", async () => {
    await expectRejectedCode(
      [
        path.join(os.tmpdir(), "does-not-exist-bundle.json"),
        "--out",
        "frame.png",
      ],
      "aperture.render.snapshotNotFound",
    );
  });

  it("rejects a file that is not an Aperture render bundle", async () => {
    const notABundle = await writeTemp(
      "not-a-bundle.json",
      '{"hello":"world"}',
    );
    await expectRejectedCode(
      [notABundle, "--out", path.join(tempDir!, "frame.png")],
      "aperture.render.invalidBundle",
    );
  });

  it("rejects invalid JSON", async () => {
    const broken = await writeTemp("broken.json", "{not json");
    await expectRejectedCode(
      [broken, "--out", path.join(tempDir!, "frame.png")],
      "aperture.render.invalidBundle",
    );
  });

  it("rejects a bundle with an unsupported version", async () => {
    const futureBundle = await writeTemp(
      "future.json",
      JSON.stringify({
        format: "aperture.render-bundle",
        version: 99,
        snapshot: { codec: "json-typed-array-v1", value: {} },
        assets: {
          schema: "aperture.source-assets.v1",
          completeness: "complete",
          allowPlaceholders: false,
          entries: [],
        },
      }),
    );
    await expectRejectedCode(
      [futureBundle, "--out", path.join(tempDir!, "frame.png")],
      "aperture.render.unsupportedBundleVersion",
    );
  });

  it("rejects a bundle whose snapshot asset closure is incomplete", async () => {
    const incompleteBundle = await writeTemp(
      "incomplete.json",
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
        snapshot: {
          codec: "json-typed-array-v1",
          value: {
            meshDraws: [
              {
                mesh: { kind: "mesh", id: "missingCube" },
                material: { kind: "material", id: "missingMaterial" },
              },
            ],
          },
        },
        assets: {
          schema: "aperture.source-assets.v1",
          completeness: "complete",
          allowPlaceholders: false,
          entries: [],
        },
        closure: {
          roots: ["material:missingMaterial", "mesh:missingCube"],
          referenced: ["material:missingMaterial", "mesh:missingCube"],
          missing: ["material:missingMaterial", "mesh:missingCube"],
          unready: [],
          placeholders: [],
        },
      }),
    );

    await expectRejectedCode(
      [incompleteBundle, "--out", path.join(tempDir!, "frame.png")],
      "aperture.render.incompleteBundle",
    );
  });

  it("rejects unsupported render-target requirements before rendering", async () => {
    const unsupportedTargetBundle = await writeTemp(
      "unsupported-target.json",
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
          colorSpace: "display-p3",
          sampleCount: 8,
        },
        requirements: { webgpuFeatures: [], textureFormats: [] },
        snapshot: {
          codec: "json-typed-array-v1",
          value: {},
        },
        assets: {
          schema: "aperture.source-assets.v1",
          completeness: "complete",
          allowPlaceholders: false,
          entries: [],
        },
        closure: {
          roots: [],
          referenced: [],
          missing: [],
          unready: [],
          placeholders: [],
        },
      }),
    );

    await expect(
      runInProcess([
        unsupportedTargetBundle,
        "--out",
        path.join(tempDir!, "frame.png"),
      ]),
    ).rejects.toMatchObject({
      code: "aperture.render.incompleteBundle",
      message: expect.stringContaining(
        "unsupported renderTarget.colorSpace 'display-p3'",
      ),
    });
  });
});
