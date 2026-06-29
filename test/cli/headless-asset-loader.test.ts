import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createNodeApertureAssetLoader } from "@aperture-engine/cli";
import { createApertureHeadlessRunner } from "@aperture-engine/app/headless";
import { asset, defineApertureConfig } from "@aperture-engine/app/config";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import type { ApertureSystemModule } from "@aperture-engine/app/advanced";

// A procedural cube system that does NOT depend on any external asset, so the
// snapshot is faithful regardless of asset placeholdering.
const cubeSystem: ApertureSystemModule = {
  default: class CubeScene extends createSystem({ priority: 0 }) {
    override init(): void {
      this.spawn.camera({
        key: "camera.main",
        transform: { translation: [0, 1, 6], lookAt: [0, 0, 0] },
        fovYDegrees: 60,
      });
      this.spawn.mesh({
        key: "cube",
        mesh: mesh.box({ size: [1, 1, 1] }),
        material: material.standard(),
        transform: { translation: [0, 0, 0] },
      });
    }
  },
};

describe("createNodeApertureAssetLoader (PD.4/PD.5)", () => {
  it("a procedural-only app records no placeholders and draws the cube", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader(),
    });

    const { snapshot } = runner.step(1 / 60, 0);
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(manifest.placeholders.count).toBe(0);
    expect(snapshot.meshDraws.length).toBe(1);
  });

  it("an external-asset app boots without invalidUrl and marks placeholders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
          floorColor: asset.texture("/assets/checker.png", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader(),
    });

    expect(runner.app.context.assets.gltf("robot").ready.value).toBe(true);
    expect(runner.app.context.assets.texture("floorColor").ready.value).toBe(
      true,
    );

    const manifest = runner.app.lowLevel.assets.createManifestReport();
    expect(manifest.placeholders.count).toBeGreaterThanOrEqual(2);
    expect([...manifest.placeholders.ids].sort()).toEqual(
      expect.arrayContaining(["floorColor", "robot"]),
    );

    // The procedural cube still renders even though external assets are stubbed.
    expect(runner.step(1 / 60, 0).snapshot.meshDraws.length).toBe(1);
  });

  it("strict mode loads local PNG texture assets with real provenance", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          floorColor: asset.texture("/assets/aperture-base-color-checker.png", {
            preload: "blocking",
            mimeType: "image/png",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/developer-api"),
      }),
    });

    const handle = runner.app.context.assets.texture("floorColor").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const texture = entry?.asset as
      | {
          readonly width?: number;
          readonly sourceData?: { readonly bytes?: Uint8Array };
        }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(texture?.width).toBeGreaterThan(0);
    expect(texture?.sourceData?.bytes?.byteLength).toBeGreaterThan(0);
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode rejects HTTP assets unless explicitly allowed", async () => {
    await expect(
      createApertureHeadlessRunner({
        config: defineApertureConfig({
          mode: "headless",
          render: { defaultCamera: false, defaultLight: false },
          assets: {
            floorColor: asset.texture("https://assets.test/checker.png", {
              preload: "blocking",
              mimeType: "image/png",
            }),
          },
        }),
        systems: [cubeSystem],
        assetLoader: createNodeApertureAssetLoader({
          mode: "strict",
        }),
      }),
    ).rejects.toThrow(/unless allowHttp is enabled/);
  });

  it("strict mode loads HTTP assets only when allowHttp is enabled", async () => {
    const pngBytes = await readFile(
      path.resolve(
        "examples/developer-api/public/assets/aperture-base-color-checker.png",
      ),
    );
    const previousFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(pngBytes, {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "image/png" },
      });
    }) as typeof fetch;

    try {
      const runner = await createApertureHeadlessRunner({
        config: defineApertureConfig({
          mode: "headless",
          render: { defaultCamera: false, defaultLight: false },
          assets: {
            floorColor: asset.texture("https://assets.test/checker.png", {
              preload: "blocking",
              mimeType: "image/png",
            }),
          },
        }),
        systems: [cubeSystem],
        assetLoader: createNodeApertureAssetLoader({
          mode: "strict",
          allowHttp: true,
        }),
      });

      const handle =
        runner.app.context.assets.texture("floorColor").renderHandle;
      const entry = runner.app.lowLevel.assets.get(handle);
      const texture = entry?.asset as
        | {
            readonly sourceData?: { readonly bytes?: Uint8Array };
          }
        | null
        | undefined;

      expect(calls).toEqual(["https://assets.test/checker.png"]);
      expect(entry?.status).toBe("ready");
      expect(entry?.provenance).toBe("loaded");
      expect(texture?.sourceData?.bytes?.byteLength).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it("strict mode loads local JPEG texture assets with real provenance", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          floorColor: asset.texture(
            "assets/aperture-jpeg-base-color-checker.jpg",
            {
              preload: "blocking",
              mimeType: "image/jpeg",
            },
          ),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples"),
      }),
    });

    const handle = runner.app.context.assets.texture("floorColor").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const texture = entry?.asset as
      | {
          readonly width?: number;
          readonly sourceData?: { readonly bytes?: Uint8Array };
        }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(texture?.width).toBeGreaterThan(0);
    expect(texture?.sourceData?.bytes?.byteLength).toBeGreaterThan(0);
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode loads HDR environment assets with embedded equirect payloads", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          studio: asset.hdr(syntheticHdrDataUrl(), { preload: "blocking" }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
      }),
    });

    const handle = runner.app.context.assets.hdr("studio").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const environment = entry?.asset as
      | {
          readonly kind?: string;
          readonly equirectSource?: {
            readonly width?: number;
            readonly height?: number;
            readonly data?: Uint8Array;
          };
          readonly source?: { readonly kind?: string };
        }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(environment?.kind).toBe("environment-map");
    expect(environment?.source?.kind).toBe("hdr-rgbe");
    expect(environment?.equirectSource?.width).toBe(4);
    expect(environment?.equirectSource?.height).toBe(2);
    expect(environment?.equirectSource?.data).toBeInstanceOf(Uint8Array);
    expect(environment?.equirectSource?.data?.byteLength).toBe(4 * 2 * 4);
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode loads local WGSL shader assets with real provenance", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          water: asset.shader("/shaders/generated-water.wgsl", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/developer-api"),
      }),
    });

    const handle = runner.app.context.assets.shader("water").renderHandle;
    const entry = runner.app.lowLevel.assets.get(handle);
    const shader = entry?.asset as
      | { readonly source?: string }
      | null
      | undefined;

    expect(entry?.status).toBe("ready");
    expect(entry?.provenance).toBe("loaded");
    expect(shader?.source).toContain("@");
    expect(
      runner.app.lowLevel.assets.createManifestReport().placeholders.count,
    ).toBe(0);
  });

  it("strict mode loads local GLB source assets without placeholders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          robot: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/developer-api"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("robot");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads external glTF buffers relative to the glTF file", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          external: asset.gltf("assets/external-cube.gltf", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("external");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.sourceKind).toBe("gltf");
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads GLB source assets with JPEG textures", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          textured: asset.gltf("assets/uri-jpeg-texture.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("textured");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.texture).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads Draco-compressed GLB source assets with local decoders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          draco: asset.gltf("draco-heart.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/assets"),
        decoderAssetsDir: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("draco");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode loads meshopt-compressed GLB source assets with local decoders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          meshopt: asset.gltf("meshopt-cube.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/assets"),
        decoderAssetsDir: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("meshopt");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.mesh).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });

  it("strict mode rejects Basis/KTX2 GLB textures without local decoders", async () => {
    await expect(
      createApertureHeadlessRunner({
        config: defineApertureConfig({
          mode: "headless",
          render: { defaultCamera: false, defaultLight: false },
          assets: {
            basis: asset.gltf("basis-ktx2-texture.glb", {
              preload: "blocking",
            }),
          },
        }),
        systems: [cubeSystem],
        assetLoader: createNodeApertureAssetLoader({
          mode: "strict",
          root: path.resolve("examples/assets"),
        }),
      }),
    ).rejects.toThrow(/BasisU-compressed KTX2 textures require/);
  });

  it("hybrid mode records placeholders for unsupported decoder paths", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          basis: asset.gltf("basis-ktx2-texture.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "hybrid",
        root: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("basis");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(manifest.placeholders.ids).toContain("basis");
  });

  it("strict mode loads Basis/KTX2 GLB textures with local decoders", async () => {
    const runner = await createApertureHeadlessRunner({
      config: defineApertureConfig({
        mode: "headless",
        render: { defaultCamera: false, defaultLight: false },
        assets: {
          basis: asset.gltf("basis-ktx2-texture.glb", {
            preload: "blocking",
          }),
        },
      }),
      systems: [cubeSystem],
      assetLoader: createNodeApertureAssetLoader({
        mode: "strict",
        root: path.resolve("examples/assets"),
        decoderAssetsDir: path.resolve("examples/assets"),
      }),
    });

    const gltf = runner.app.context.assets.gltf("basis");
    const manifest = runner.app.lowLevel.assets.createManifestReport();

    expect(gltf.ready.value).toBe(true);
    expect(gltf.scene.value?.meshRegistration.written.length).toBeGreaterThan(
      0,
    );
    expect(manifest.byKind.texture).toBeGreaterThan(0);
    expect(manifest.placeholders.count).toBe(0);
  });
});

function syntheticHdrDataUrl(): string {
  const width = 4;
  const height = 2;
  const rgbe = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    rgbe[offset] = 128;
    rgbe[offset + 1] = 96;
    rgbe[offset + 2] = 64;
    rgbe[offset + 3] = 129;
  }

  const header = new TextEncoder().encode(
    `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`,
  );
  const bytes = new Uint8Array(header.byteLength + rgbe.byteLength);
  bytes.set(header, 0);
  bytes.set(rgbe, header.byteLength);

  return `data:image/vnd.radiance;base64,${Buffer.from(bytes).toString(
    "base64",
  )}`;
}
